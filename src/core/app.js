/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { CacheManager } from './cache.js';
import { DisabledClientsManager } from './disabled-clients.js';
import { ApiClientManager } from './api-manager.js';
import { OverlayRenderer } from './overlay.js';
import { SurfaceManager } from './surfaces.js';
import { DECORATION_DEBOUNCE_MS, INFLIGHT_TIMEOUT_MS, ApiSource } from './constants.js';
import { ConfigManager } from './config-manager.js';
import { FadeManager } from './fade-manager.js';
import { Logger } from './logger.js';
import { debounce, runIdle, slugify } from './utils.js';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient, AgregarrApiClient } from './api-clients.js';

export class FlixMonkeyApp {
    #api;
    #cache;
    #renderer;
    #surfaces;
    #fade;
    #config;
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

    constructor(cache, api, renderer, surfaces, fade, config, logger) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
        this.#fade = fade;
        this.#config = config;
        this.#logger = logger;
        this.#debouncedDecorate = debounce(() => {
            const roots = this.#pendingRoots.size > 0 ? [...this.#pendingRoots] : [document];
            this.#pendingRoots.clear();
            runIdle(() => roots.forEach(root => this.decorateRoot(root)));
        }, DECORATION_DEBOUNCE_MS);
    }

    disconnect() {
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

    async clearCache() {
        await this.#cache.clear();
    }

    async resetDisabledClients() {
        return await this.#api.resetDisabledClients();
    }

    async #decorateContainer(container, displayTitle, fadeable, showToggle = false) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const dedupKey = slugify(displayTitle);

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container);

        await new Promise(resolve => setTimeout(resolve, 0));

        const fadeOverride = await this.#fade.getOverride(dedupKey);
        if (fadeOverride !== null) {
            this.#renderer.applyFade(container, this.#fade.shouldFade(fadeOverride, null, fadeable));
        }

        let promise = this.#inFlight.get(dedupKey);
        if (!promise) {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('inflight timeout')), INFLIGHT_TIMEOUT_MS)
            );
            promise = Promise.race([this.#api.getData(displayTitle), timeoutPromise]).finally(() =>
                this.#inFlight.delete(dedupKey)
            );
            this.#inFlight.set(dedupKey, promise);
        }

        try {
            const data = await promise;
            if (!this.#renderer.hasOverlay(container) && document.contains(container)) {
                const isRatingFaded = this.#fade.shouldFade(null, data?.rating, showToggle || fadeable);
                const shouldFade = this.#fade.shouldFade(fadeOverride, data?.rating, fadeable);

                const enableToggle = showToggle && this.#config.get('enableFadeToggle', true);
                let toggleOptions = null;
                if (enableToggle) {
                    const toggleState = this.#fade.getToggleState(fadeOverride, isRatingFaded);
                    toggleOptions = {
                        state: toggleState,
                        onClick: () => this.#handleToggleClick(container, dedupKey, data, fadeable),
                    };
                }

                this.#renderer.injectOverlay(container, data, toggleOptions);
                this.#renderer.applyFade(container, shouldFade);
                if (fadeable) {
                    container.dataset.fmDedupKey = dedupKey;
                }
            }
        } finally {
            this.#renderer.removeLoadingOverlay(container);
        }
    }

    async #handleToggleClick(container, dedupKey, data, fadeable) {
        const toggle = container.querySelector('.fm-fade-toggle');
        if (!toggle) return;

        const currentState = toggle.dataset.state;
        const nextState = this.#fade.nextToggleState(currentState);
        const newOverride = this.#fade.stateToOverride(nextState);

        await this.#fade.setOverride(dedupKey, newOverride);

        toggle.dataset.state = nextState;
        const shouldFade = this.#fade.shouldFade(newOverride, data?.rating, fadeable);
        this.#renderer.applyFade(container, shouldFade);
        const siblingFade = this.#fade.shouldFade(newOverride, data?.rating, true);
        document.querySelectorAll(`[data-fm-dedup-key="${dedupKey}"]`).forEach(sibling => {
            this.#renderer.applyFade(sibling, siblingFade);
        });
    }

    decorateRoot(root) {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable, showToggle = false }) => {
            this.#decorateContainer(container, title, fadeable, showToggle).catch(err =>
                this.#logger.error('Failed to decorate container', err)
            );
        });
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

    init() {
        // #initialised is never reset: one app instance, one lifetime.
        if (this.#initialised) throw new Error('FlixMonkeyApp already initialised');
        this.#initialised = true;
        this.#renderer.injectStyles();
        this.#initNavigationObservers();
        this.decorateRoot(document);
        this.#boundDisconnect = () => this.disconnect();
        window.addEventListener('beforeunload', this.#boundDisconnect);
    }
}

function createApiClient(config, disabledManager, adapter, logger) {
    const provider = (config.get('apiClient') ?? 'agregarr').trim().toLowerCase();
    const clientMap = {
        [ApiSource.AGREGARR]: AgregarrApiClient,
        [ApiSource.XMDB]: XmdbApiClient,
        [ApiSource.OMDB]: OmdbApiClient,
        [ApiSource.IMDBAPI]: ImdbApiDevClient,
    };
    const ClientClass = clientMap[provider] ?? AgregarrApiClient;
    return new ClientClass(disabledManager, adapter, config, logger);
}

export function startApp(adapter) {
    const logger = new Logger(adapter);
    const configManager = new ConfigManager(adapter, logger);
    const cache = new CacheManager(adapter, configManager, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const client = createApiClient(configManager, disabledManager, adapter, logger);
    const api = new ApiClientManager(cache, disabledManager, client, logger);
    const renderer = new OverlayRenderer(configManager);
    const surfaces = new SurfaceManager(logger);
    const fade = new FadeManager(adapter, configManager);
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces, fade, configManager, logger);
    app.init();
    return {
        clearCache: () => app.clearCache(),
        resetDisabledClients: () => app.resetDisabledClients(),
        disconnect: () => app.disconnect(),
        refreshStyles: () => renderer.injectStyles(),
        cacheManager: cache,
        disabledManager: disabledManager,
    };
}
