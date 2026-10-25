/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';
import type { BaseApiClient } from './api/base-api-client';
import { AgregarrApiClient, type ApiClientDeps, OmdbApiClient, XmdbApiClient } from './api/index';
import { ApiClientManager, type ApiClientManager as ApiClientManagerType } from './api-manager';
import { CacheManager, type CacheManager as CacheManagerType } from './cache/index';
import { ConfigManager } from './config/index';
import { ApiSource, DECORATION_DEBOUNCE_MS, INFLIGHT_TIMEOUT_MS } from './constants';
import { DisabledClientsManager, type DisabledClientsManager as DisabledClientsManagerType } from './disabled-clients';
import {
    FadeManager,
    type FadeManager as FadeManagerType,
    type FadeOverrideState,
    nextFadeState,
} from './fade-manager';
import { IdOverrideManager, type IdOverrideManager as IdOverrideManagerType } from './id-override-manager';
import { Logger } from './logger';
import { OverlayRenderer, type OverlayRenderer as OverlayRendererType } from './overlay';
import { ServiceRegistry } from './services/index';
import type { SurfaceManager } from './surfaces/index';
import type { Title } from './title';
import { FADE_STATE_LABELS } from './ui/overlay-elements';
import { debounce, runIdle, slugify } from './utils/index';

/** Main application class coordinating rating overlay functionality. */
export class FlixMonkeyApp {
    readonly #api: ApiClientManagerType;
    readonly #cache: CacheManagerType;
    readonly #renderer: OverlayRendererType;
    readonly #surfaces: SurfaceManager;
    readonly #logger: Logger;
    readonly #inFlight = new Map<string, Promise<Title>>();
    readonly #pendingRoots = new Set<Element | Document>();
    readonly #debouncedDecorate: () => void;
    #observer: MutationObserver | undefined;
    #initialised = false;
    #boundDisconnect: (() => void) | undefined;
    #navigationPatched = false;
    #originalPushState: ((..._args: unknown[]) => void) | undefined;
    #originalReplaceState: ((..._args: unknown[]) => void) | undefined;
    #popstateHandler: (() => void) | undefined;
    readonly #fadeManager: FadeManagerType;
    readonly #overrideManager: IdOverrideManagerType;

    /**
     * @param logger - Logger instance
     * @param cache - Cache manager instance
     * @param fadeManager - Fade manager instance
     * @param overrideManager - ID override manager instance
     * @param renderer - Overlay renderer instance
     * @param surfaces - Surface manager instance
     * @param api - API client manager instance
     */
    // eslint-disable-next-line @typescript-eslint/max-params -- single wiring point, and startApp() is its only caller
    constructor(
        logger: Logger,
        cache: CacheManagerType,
        fadeManager: FadeManagerType,
        overrideManager: IdOverrideManagerType,
        renderer: OverlayRendererType,
        surfaces: SurfaceManager,
        api: ApiClientManagerType
    ) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
        this.#fadeManager = fadeManager;
        this.#logger = logger;
        this.#overrideManager = overrideManager;
        this.#debouncedDecorate = debounce(() => {
            const roots = this.#pendingRoots.size > 0 ? [...this.#pendingRoots] : [document];
            this.#pendingRoots.clear();
            runIdle(() => roots.forEach(root => this.#decorateRoot(root)));
        }, DECORATION_DEBOUNCE_MS);
    }

    /** Bootstraps styling, navigation observers, initial decoration, and teardown wiring. */
    init(): void {
        // Guards against duplicate observers and unload listeners; never reset.
        if (this.#initialised) throw new Error('FlixMonkeyApp already initialised');
        this.#initialised = true;
        this.#renderer.injectStyles();
        this.#initNavigationObservers();
        this.#decorateRoot(document);
        this.#boundDisconnect = (): void => this.#disconnect();
        window.addEventListener('beforeunload', this.#boundDisconnect);
    }

    /**
     * Sets or updates the IMDb ID override for a title from user input.
     * @param displayTitle - The title to set override for
     * @param imdbId - Current IMDb ID from API, used as the prompt default when no override exists.
     */
    async #handleEditClick(displayTitle: string, imdbId?: string): Promise<void> {
        const currentOverride = await this.#overrideManager.getImdbId(displayTitle);
        const userInput = prompt(`IMDb ID for ${displayTitle}:`, currentOverride ?? imdbId ?? '');
        if (userInput === null) return;

        const extracted = this.#extractImdbId(userInput);
        if (!extracted) {
            alert('Invalid IMDb ID. Must be tt followed by numbers (e.g., tt0133093)');
            return;
        }

        const dedupKey = slugify(displayTitle);
        await this.#overrideManager.setImdbId(displayTitle, extracted);
        await this.#cache.delete(dedupKey);
        this.#redecorateTitle(dedupKey, displayTitle);
    }

    /**
     * Clears the single cache entry for a title and re-decorates it.
     * @param displayTitle - The title to refresh
     */
    async #handleRefreshClick(displayTitle: string): Promise<void> {
        const dedupKey = slugify(displayTitle);
        await this.#cache.delete(dedupKey);
        this.#redecorateTitle(dedupKey, displayTitle);
    }

    #initNavigationObservers(): void {
        if (this.#navigationPatched) return;
        this.#navigationPatched = true;

        this.#originalPushState = history.pushState as (..._args: unknown[]) => void;
        this.#originalReplaceState = history.replaceState as (..._args: unknown[]) => void;

        history.pushState = (...args: unknown[]): void => {
            this.#originalPushState?.apply(history, args);
            this.#debouncedDecorate();
        };
        history.replaceState = (...args: unknown[]): void => {
            this.#originalReplaceState?.apply(history, args);
            this.#debouncedDecorate();
        };

        this.#popstateHandler = (): void => this.#debouncedDecorate();
        window.addEventListener('popstate', this.#popstateHandler);

        this.#observer = new MutationObserver(mutations => {
            try {
                let hasElements = false;
                for (const m of mutations) {
                    for (const n of m.addedNodes) {
                        if (n.nodeType === Node.ELEMENT_NODE) {
                            hasElements = true;
                            this.#pendingRoots.add(m.target as Element);
                        }
                    }
                }
                if (hasElements) this.#debouncedDecorate();
            } catch (err) {
                this.#logger.error('Mutation observer error', err);
            }
        });
        this.#observer.observe(document.body, { childList: true, subtree: true });
    }

    #decorateRoot(root: Element | Document): void {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable, showFadeToggle }) => {
            this.#decorateContainer(container, title, fadeable, showFadeToggle).catch(err =>
                this.#logger.error(`Failed to decorate "${title}"`, err)
            );
        });
    }

    async #decorateContainer(
        container: Element,
        displayTitle: string,
        fadeable: boolean,
        showFadeToggle: boolean
    ): Promise<void> {
        if (this.#renderer.hasOverlay(container as HTMLElement) || this.#renderer.isLoading(container as HTMLElement))
            return;

        const dedupKey = slugify(displayTitle);

        this.#renderer.ensureRelative(container as HTMLElement);
        this.#renderer.injectLoadingOverlay(container as HTMLElement, displayTitle);

        /*
         * Yield to the event loop so the browser can paint the loading overlay
         * before executing potentially synchronous microtasks. GM storage APIs
         * (like GM_getValue) can be synchronously blocking in some userscript managers,
         * which is the reason for the explicit yield before cache reads.
         */
        await new Promise(resolve => setTimeout(resolve, 0));

        const fadeOverride = fadeable || showFadeToggle ? await this.#fadeManager.getOverride(dedupKey) : undefined;
        const request = this.#getTitleRequest(dedupKey, displayTitle);

        try {
            const data = await request;
            this.#renderTitle(container, data, { dedupKey, fadeable, showFadeToggle, fadeOverride });
        } finally {
            this.#renderer.removeLoadingOverlay(container as HTMLElement);
        }
    }

    async #getTitleRequest(dedupKey: string, displayTitle: string): Promise<Title> {
        const existing = this.#inFlight.get(dedupKey);
        if (existing) return existing;

        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('inflight timeout')), INFLIGHT_TIMEOUT_MS);
        });
        const request = Promise.race([this.#api.getData(displayTitle), timeout]).finally(() => {
            this.#inFlight.delete(dedupKey);
        });
        this.#inFlight.set(dedupKey, request);
        return request;
    }

    #renderTitle(
        container: Element,
        data: Title,
        {
            dedupKey,
            fadeable,
            showFadeToggle,
            fadeOverride,
        }: {
            dedupKey: string;
            fadeable: boolean;
            showFadeToggle: boolean;
            fadeOverride: FadeOverrideState;
        }
    ): void {
        if (this.#renderer.hasOverlay(container as HTMLElement) || !document.contains(container)) return;

        const shouldFade = fadeable && this.#fadeManager.shouldFade(fadeOverride, data.imdbRating);
        this.#renderer.applyFade(container as HTMLElement, shouldFade);
        (container as HTMLElement).dataset.fmKey = dedupKey;
        this.#renderer.injectOverlay(container as HTMLElement, data, {
            displayTitle: data.displayTitle,
            onEditClick: (dt: string): void => {
                this.#handleEditClick(dt, data.imdbId).catch(err =>
                    this.#logger.error(`Failed to edit IMDb ID for "${dt}"`, err)
                );
            },
            onRefreshClick: (dt: string): void => {
                this.#handleRefreshClick(dt).catch(err =>
                    this.#logger.error(`Failed to refresh ratings for "${dt}"`, err)
                );
            },
            fadeToggleState: showFadeToggle ? fadeOverride : undefined,
            onFadeToggleClick: showFadeToggle
                ? (el: HTMLElement): void => {
                      this.#handleFadeToggleClick(dedupKey, data.imdbRating, el).catch(
                          /* istanbul ignore next */ () => undefined
                      );
                  }
                : undefined,
        });
    }

    async #handleFadeToggleClick(
        dedupKey: string,
        imdbRating: number | undefined,
        toggleBadgeEl: HTMLElement
    ): Promise<void> {
        const domState = toggleBadgeEl.dataset.state;
        const currentState: FadeOverrideState = domState === 'always' || domState === 'never' ? domState : undefined;
        const nextState = nextFadeState(currentState);
        await this.#fadeManager.setOverride(dedupKey, nextState);
        toggleBadgeEl.dataset.state = nextState ?? 'auto';
        toggleBadgeEl.title = `Fade: ${FADE_STATE_LABELS[nextState ?? 'auto']}`;
        const icon = toggleBadgeEl.querySelector('.fm-fade-toggle-icon');
        if (icon) {
            icon.textContent = nextState === undefined ? '⭐' : '👁️';
            icon.classList.toggle('fm-fade-toggle--faded', nextState === 'always');
        }
        const shouldFade = this.#fadeManager.shouldFade(nextState, imdbRating);
        document.querySelectorAll(`[data-fm-key="${dedupKey}"]`).forEach(c => {
            this.#renderer.applyFade(c as HTMLElement, shouldFade);
        });
    }

    /**
     * Forces re-decoration of all titles on the current page.
     */
    redecorate(): void {
        this.#renderer.injectStyles();
        this.#renderer.clearAllOverlays();
        this.#decorateRoot(document);
    }

    #disconnect(): void {
        this.#observer?.disconnect();
        this.#observer = undefined;
        if (this.#boundDisconnect) {
            window.removeEventListener('beforeunload', this.#boundDisconnect);
            this.#boundDisconnect = undefined;
        }
        if (this.#navigationPatched) {
            if (this.#originalPushState) {
                history.pushState = this.#originalPushState;
            }
            if (this.#originalReplaceState) {
                history.replaceState = this.#originalReplaceState;
            }
            if (this.#popstateHandler) {
                window.removeEventListener('popstate', this.#popstateHandler);
            }
            this.#navigationPatched = false;
        }
    }

    /**
     * Extract IMDb ID from user input (direct ID or URL).
     * @param input - User input
     * @returns Extracted IMDb ID or undefined if invalid
     */
    #extractImdbId(input: string): string | undefined {
        if (!input) return undefined;
        const trimmed = input.trim();
        if (/^tt\d+$/.test(trimmed)) {
            return trimmed;
        }
        const imdbUrlRegex = /(?:www\.)?imdb\.com\/title\/tt(\d+)/;
        const match = imdbUrlRegex.exec(trimmed);
        if (match) {
            return `tt${match[1]}`;
        }
        return undefined;
    }

    /**
     * Re-decorate all containers for a specific title.
     * @param dedupKey - The slugified title key
     * @param displayTitle - The original display title (used for consistent API calls)
     */
    #redecorateTitle(dedupKey: string, displayTitle: string): void {
        // querySelectorAll only yields nodes inside the document, so no containment check is needed.
        document.querySelectorAll(`[data-fm-key="${dedupKey}"]`).forEach(container => {
            delete (container as HTMLElement).dataset.fmInjected;
            this.#renderer.removeLoadingOverlay(container as HTMLElement);
            this.#decorateContainer(container, displayTitle, false, false).catch(err =>
                this.#logger.error(`Failed to redecorate "${displayTitle}"`, err)
            );
        });
    }

    get cacheManager(): CacheManagerType {
        return this.#cache;
    }

    get disabledManager(): DisabledClientsManagerType {
        return this.#api.disabledManager;
    }
}

/**
 * Builds the API client for the provider selected in config.
 *
 * @param deps - Dependencies shared by every API client.
 * @returns Client for the configured provider, defaulting to Agregarr.
 */
function createApiClient(deps: ApiClientDeps): BaseApiClient {
    const provider = deps.config.get('apiClient').trim().toLowerCase();
    const clientMap = {
        [ApiSource.AGREGARR]: AgregarrApiClient,
        [ApiSource.XMDB]: XmdbApiClient,
        [ApiSource.OMDB]: OmdbApiClient,
    };
    const ClientClass = clientMap[provider as keyof typeof clientMap] ?? AgregarrApiClient;
    return new ClientClass(deps);
}

/**
 * Starts the application for the detected streaming service.
 *
 * @param adapter - Platform adapter
 * @returns FlixMonkeyApp or undefined if service not detected or not enabled
 */
export function startApp(adapter: PlatformAdapter): FlixMonkeyApp | undefined {
    const currentService = ServiceRegistry.detect();
    if (!currentService) {
        return undefined;
    }

    const logger = new Logger(adapter);
    const configManager = new ConfigManager(adapter, logger);
    if (!currentService.isEnabled(configManager)) {
        return undefined;
    }
    const cache = new CacheManager(adapter, configManager, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const overrideManager = new IdOverrideManager(adapter);
    const clientDeps: ApiClientDeps = {
        adapter,
        config: configManager,
        disabledManager,
        logger,
        overrideManager,
    };
    const client = createApiClient(clientDeps);
    const api = new ApiClientManager(logger, cache, disabledManager, client);
    const surfaces = new currentService.SurfaceManager(logger);
    const renderer = new OverlayRenderer(configManager, currentService.constants);
    const fadeManager = new FadeManager(adapter, configManager);
    const app = new FlixMonkeyApp(logger, cache, fadeManager, overrideManager, renderer, surfaces, api);
    app.init();
    return app;
}
