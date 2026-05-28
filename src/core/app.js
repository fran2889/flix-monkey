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
import { Title } from './title.js';
import { DECORATION_DEBOUNCE_MS } from './constants.js';
import { ConfigManager } from './config-manager.js';
import { logger } from './logger.js';
import { debounce, runIdle } from './utils.js';

export class FlixMonkeyApp {
    #api;
    #cache;
    #renderer;
    #surfaces;
    #inFlight = new Map();
    #debouncedDecorate;

    constructor(cache, api, renderer, surfaces) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
        this.#debouncedDecorate = debounce(() => {
            runIdle(() => this.decorateRoot(document));
        }, DECORATION_DEBOUNCE_MS);
    }

    async clearCache() {
        await this.#cache.clear();
    }

    async resetDisabledClients() {
        return await this.#api.resetDisabledClients();
    }

    async #decorateContainer(container, displayTitle, fadeable) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const dedupKey = displayTitle.toLowerCase();

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container, displayTitle);

        // Yield to the event loop so the browser can paint the loading overlay
        // before executing potentially synchronous microtasks. GM storage APIs
        // (like GM_getValue) can be synchronously blocking in some userscript managers,
        // which is the reason for the explicit yield before cache reads.
        await new Promise(resolve => setTimeout(resolve, 0));

        let promise = this.#inFlight.get(dedupKey);
        if (!promise) {
            promise = (async () => {
                return await this.#api.getData(displayTitle);
            })().finally(() => this.#inFlight.delete(dedupKey));
            this.#inFlight.set(dedupKey, promise);
        }

        const data = await promise;
        if (!this.#renderer.hasOverlay(container)) {
            this.#renderer.injectOverlay(container, data ?? Title.notFound(displayTitle));
            this.#renderer.applyFade(container, data, fadeable);
        }
    }

    decorateRoot(root) {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable }) => {
            this.#decorateContainer(container, title, fadeable);
        });
    }

    static #isNavigationPatched = false;
    static #originalPushState = history.pushState;
    static #originalReplaceState = history.replaceState;

    /** @internal for testing only */
    static resetInternalState() {
        FlixMonkeyApp.#isNavigationPatched = false;
        history.pushState = FlixMonkeyApp.#originalPushState;
        history.replaceState = FlixMonkeyApp.#originalReplaceState;
        OverlayRenderer.resetInternalState();
    }

    #initNavigationObservers() {
        if (FlixMonkeyApp.#isNavigationPatched) return;
        FlixMonkeyApp.#isNavigationPatched = true;

        history.pushState = (...args) => {
            FlixMonkeyApp.#originalPushState.apply(history, args);
            this.#debouncedDecorate();
        };
        history.replaceState = (...args) => {
            FlixMonkeyApp.#originalReplaceState.apply(history, args);
            this.#debouncedDecorate();
        };

        window.addEventListener('popstate', () => this.#debouncedDecorate());

        const observer = new MutationObserver(mutations => {
            const hasElements = mutations.some(m =>
                Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE)
            );
            if (hasElements) this.#debouncedDecorate();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    init() {
        this.#renderer.injectStyles();
        this.#initNavigationObservers();
        this.decorateRoot(document);
    }
}

export function startApp(adapter) {
    const configManager = new ConfigManager(adapter);

    const cache = new CacheManager(adapter, configManager);
    const disabledManager = new DisabledClientsManager(adapter);
    const api = new ApiClientManager(cache, disabledManager, adapter, configManager);
    const renderer = new OverlayRenderer(configManager);
    const surfaces = new SurfaceManager();
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces);
    logger.setConfig(configManager);
    app.init();
    return {
        clearCache: () => app.clearCache(),
        resetDisabledClients: () => app.resetDisabledClients(),
    };
}
