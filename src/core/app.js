/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { AgregarrApiClient, OmdbApiClient, XmdbApiClient } from './api/index.js';
import { ApiClientManager } from './api-manager.js';
import { CacheManager } from './cache/index.js';
import { ConfigManager } from './config/index.js';
import { ApiSource, DECORATION_DEBOUNCE_MS, INFLIGHT_TIMEOUT_MS } from './constants.js';
import { DisabledClientsManager } from './disabled-clients.js';
import { FadeManager, nextFadeState } from './fade-manager.js';
import { IdOverrideManager } from './id-override-manager.js';
import { Logger } from './logger.js';
import { OverlayRenderer } from './overlay.js';
import { ServiceRegistry } from './services/index.js';
import { FADE_STATE_LABELS } from './ui/overlay-elements.js';
import { debounce, runIdle, slugify } from './utils/index.js';

/** Main application class coordinating rating overlay functionality. */
export class FlixMonkeyApp {
    #api;
    #cache;
    #renderer;
    #surfaces;
    #logger;
    #inFlight = new Map();
    #pendingRoots = new Set();
    #debouncedDecorate;
    #observer = null;
    #initialised = false;
    #boundDisconnect = null;
    #navigationPatched = false;
    #originalPushState = null;
    #originalReplaceState = null;
    #popstateHandler = null;
    #fadeManager;
    #overrideManager;

    /**
     * @param {import('./logger.js').Logger} logger
     * @param {import('./cache/index.js').CacheManager} cache
     * @param {import('./fade-manager.js').FadeManager} fadeManager
     * @param {import('./id-override-manager.js').IdOverrideManager} overrideManager
     * @param {import('./overlay.js').OverlayRenderer} renderer
     * @param {import('./surfaces/index.js').SurfaceManager} surfaces
     * @param {import('./api-manager.js').ApiClientManager} api
     */
    constructor(logger, cache, fadeManager, overrideManager, renderer, surfaces, api) {
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
    init() {
        // Guards against duplicate observers and unload listeners; never reset.
        if (this.#initialised) throw new Error('FlixMonkeyApp already initialised');
        this.#initialised = true;
        this.#renderer.injectStyles();
        this.#initNavigationObservers();
        this.#decorateRoot(document);
        this.#boundDisconnect = () => this.#disconnect();
        window.addEventListener('beforeunload', this.#boundDisconnect);
    }

    /**
     * Sets or updates the IMDb ID override for a title from user input.
     * @param {string} displayTitle - The title to set override for
     * @param {string|null} [imdbId=null] - Current IMDb ID from API, used as the prompt default when no override exists
     */
    async #handleEditClick(displayTitle, imdbId = null) {
        const currentOverride = await this.#overrideManager.getImdbId(displayTitle);
        const userInput = prompt(`IMDb ID for ${displayTitle}:`, currentOverride || imdbId || '');
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
     * @param {string} displayTitle - The title to refresh
     */
    async #handleRefreshClick(displayTitle) {
        const dedupKey = slugify(displayTitle);
        await this.#cache.delete(dedupKey);
        this.#redecorateTitle(dedupKey, displayTitle);
    }

    #initNavigationObservers() {
        if (this.#navigationPatched) return;
        this.#navigationPatched = true;

        this.#originalPushState = history.pushState;
        this.#originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            this.#originalPushState.apply(history, args);
            this.#debouncedDecorate();
        };
        history.replaceState = (...args) => {
            this.#originalReplaceState.apply(history, args);
            this.#debouncedDecorate();
        };

        this.#popstateHandler = () => this.#debouncedDecorate();
        window.addEventListener('popstate', this.#popstateHandler);

        this.#observer = new MutationObserver(mutations => {
            try {
                let hasElements = false;
                for (const m of mutations) {
                    for (const n of m.addedNodes) {
                        if (n.nodeType === Node.ELEMENT_NODE) {
                            hasElements = true;
                            this.#pendingRoots.add(m.target);
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

    #decorateRoot(root) {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable, showFadeToggle }) => {
            this.#decorateContainer(container, title, fadeable, showFadeToggle).catch(err =>
                this.#logger.error(`Failed to decorate "${title}"`, err)
            );
        });
    }

    async #decorateContainer(container, displayTitle, fadeable, showFadeToggle) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const dedupKey = slugify(displayTitle);

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container, displayTitle);

        /*
         * Yield to the event loop so the browser can paint the loading overlay
         * before executing potentially synchronous microtasks. GM storage APIs
         * (like GM_getValue) can be synchronously blocking in some userscript managers,
         * which is the reason for the explicit yield before cache reads.
         */
        await new Promise(resolve => setTimeout(resolve, 0));

        const fadeOverride = fadeable || showFadeToggle ? await this.#fadeManager.getOverride(dedupKey) : null;
        const request = this.#getTitleRequest(dedupKey, displayTitle);

        try {
            const data = await request;
            this.#renderTitle(container, data, { dedupKey, fadeable, showFadeToggle, fadeOverride });
        } finally {
            this.#renderer.removeLoadingOverlay(container);
        }
    }

    #getTitleRequest(dedupKey, displayTitle) {
        const existing = this.#inFlight.get(dedupKey);
        if (existing) return existing;

        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('inflight timeout')), INFLIGHT_TIMEOUT_MS);
        });
        const request = Promise.race([this.#api.getData(displayTitle), timeout]).finally(() => {
            this.#inFlight.delete(dedupKey);
        });
        this.#inFlight.set(dedupKey, request);
        return request;
    }

    #renderTitle(container, data, { dedupKey, fadeable, showFadeToggle, fadeOverride }) {
        if (this.#renderer.hasOverlay(container) || !document.contains(container)) return;

        const shouldFade = fadeable && this.#fadeManager.shouldFade(fadeOverride, data.imdbRating);
        this.#renderer.applyFade(container, shouldFade);
        container.dataset.fmKey = dedupKey;
        const onFadeToggleClick = showFadeToggle
            ? el => this.#handleFadeToggleClick(dedupKey, data.imdbRating, el)
            : null;
        const displayTitle = data.displayTitle;
        this.#renderer.injectOverlay(
            container,
            data,
            showFadeToggle ? fadeOverride : null,
            onFadeToggleClick,
            (displayTitle, imdbId) => this.#handleEditClick(displayTitle, imdbId),
            displayTitle => this.#handleRefreshClick(displayTitle),
            displayTitle
        );
    }

    async #handleFadeToggleClick(dedupKey, imdbRating, toggleBadgeEl) {
        const domState = toggleBadgeEl.dataset.state;
        const currentState = domState === 'auto' ? null : domState;
        const nextState = nextFadeState(currentState);
        await this.#fadeManager.setOverride(dedupKey, nextState);
        toggleBadgeEl.dataset.state = nextState ?? 'auto';
        toggleBadgeEl.title = `Fade: ${FADE_STATE_LABELS[nextState ?? 'auto']}`;
        const icon = toggleBadgeEl.querySelector('.fm-fade-toggle-icon');
        icon.textContent = nextState === null ? '⭐' : '👁️';
        icon.classList.toggle('fm-fade-toggle--faded', nextState === 'always');
        const shouldFade = this.#fadeManager.shouldFade(nextState, imdbRating);
        document.querySelectorAll(`[data-fm-key="${dedupKey}"]`).forEach(c => {
            this.#renderer.applyFade(c, shouldFade);
        });
    }

    /**
     * Forces re-decoration of all titles on the current page.
     */
    redecorate() {
        this.#renderer.injectStyles();
        this.#renderer.clearAllOverlays();
        this.#decorateRoot(document);
    }

    #disconnect() {
        this.#observer?.disconnect();
        this.#observer = null;
        if (this.#boundDisconnect) {
            window.removeEventListener('beforeunload', this.#boundDisconnect);
            this.#boundDisconnect = null;
        }
        if (this.#navigationPatched) {
            history.pushState = this.#originalPushState;
            history.replaceState = this.#originalReplaceState;
            window.removeEventListener('popstate', this.#popstateHandler);
            this.#navigationPatched = false;
        }
    }

    /**
     * Extract IMDb ID from user input (direct ID or URL).
     * @param {string} input - User input
     * @returns {string|null} Extracted IMDb ID or null if invalid
     */
    #extractImdbId(input) {
        if (!input) return null;
        const trimmed = input.trim();
        if (/^tt\d+$/.test(trimmed)) {
            return trimmed;
        }
        const imdbUrlRegex = /(?:www\.)?imdb\.com\/title\/tt(\d+)/;
        const match = imdbUrlRegex.exec(trimmed);
        if (match) {
            return `tt${match[1]}`;
        }
        return null;
    }

    /**
     * Re-decorate all containers for a specific title.
     * @param {string} dedupKey - The slugified title key
     * @param {string} displayTitle - The original display title (used for consistent API calls)
     */
    #redecorateTitle(dedupKey, displayTitle) {
        // querySelectorAll only yields nodes inside the document, so no containment check is needed.
        document.querySelectorAll(`[data-fm-key="${dedupKey}"]`).forEach(container => {
            delete container.dataset.fmInjected;
            this.#renderer.removeLoadingOverlay(container);
            this.#decorateContainer(container, displayTitle, false, false).catch(err =>
                this.#logger.error(`Failed to redecorate "${displayTitle}"`, err)
            );
        });
    }

    /** @returns {CacheManager} */
    get cacheManager() {
        return this.#cache;
    }

    /** @returns {DisabledClientsManager} */
    get disabledManager() {
        return this.#api.disabledManager;
    }
}

/**
 * Builds the API client for the provider selected in config.
 *
 * @param {import('../platform/adapter.js').PlatformAdapter} adapter - Platform adapter for HTTP and storage.
 * @param {import('./config/config-manager.js').ConfigManager} config - Application configuration.
 * @param {import('./disabled-clients.js').DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
 * @param {import('./logger.js').Logger} logger - Required; client construction and fallback paths log.
 * @param {import('./id-override-manager.js').IdOverrideManager} overrideManager - Manager for ID overrides.
 * @returns {import('./api/base-api-client.js').BaseApiClient} Client for the configured provider, defaulting to Agregarr.
 */
function createApiClient(adapter, config, disabledManager, logger, overrideManager) {
    const provider = config.get('apiClient').trim().toLowerCase();
    const clientMap = {
        [ApiSource.AGREGARR]: AgregarrApiClient,
        [ApiSource.XMDB]: XmdbApiClient,
        [ApiSource.OMDB]: OmdbApiClient,
    };
    const ClientClass = clientMap[provider] ?? AgregarrApiClient;
    return new ClientClass(adapter, config, disabledManager, logger, overrideManager);
}

/**
 * @param {import('../platform/adapter.js').PlatformAdapter} adapter
 * @returns {FlixMonkeyApp|null}
 */
export function startApp(adapter) {
    const currentService = ServiceRegistry.detect();
    if (!currentService) {
        return null;
    }

    const logger = new Logger(adapter);
    const configManager = new ConfigManager(adapter, logger);
    if (!currentService.isEnabled(configManager)) {
        return null;
    }
    const cache = new CacheManager(adapter, configManager, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const overrideManager = new IdOverrideManager(adapter);
    const client = createApiClient(adapter, configManager, disabledManager, logger, overrideManager);
    const api = new ApiClientManager(logger, cache, disabledManager, client);
    const surfaces = new currentService.SurfaceManager(logger);
    const renderer = new OverlayRenderer(configManager, currentService.constants);
    const fadeManager = new FadeManager(adapter, configManager);
    const app = new FlixMonkeyApp(logger, cache, fadeManager, overrideManager, renderer, surfaces, api);
    app.init();
    return app;
}
