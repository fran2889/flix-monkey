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
import { NAVIGATION_DEBOUNCE_MS } from './constants.js';

class FlixMonkeyApp {
    #cache;
    #api;
    #renderer;
    #surfaces;
    #inFlight = new Map();

    constructor(cache, api, renderer, surfaces) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
    }

    async #decorateContainer(container, displayTitle, fadeable) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const domYear = this.#surfaces.extractYear(container);
        const dedupKey = `${displayTitle.toLowerCase()}_${domYear ?? ''}`;
        
        let promise = this.#inFlight.get(dedupKey);
        if (!promise) {
            promise = (async () => {
                const cached = await this.#cache.read(displayTitle, domYear);
                if (cached !== null) return cached;
                return await this.#api.getData(displayTitle, domYear);
            })().finally(() => this.#inFlight.delete(dedupKey));
            this.#inFlight.set(dedupKey, promise);
        }

        const data = await promise;
        if (!this.#renderer.hasOverlay(container)) {
            this.#renderer.ensureRelative(container);
            this.#renderer.injectOverlay(container, data ?? Title.notFound(displayTitle));
            this.#renderer.applyFade(container, data, fadeable);
        }
    }

    decorateRoot(root) {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable }) => {
            this.#decorateContainer(container, title, fadeable);
        });
    }

    #initNavigationObservers() {
        if (history._fmPatched) return;
        history._fmPatched = true;
        const { pushState, replaceState } = history;

        history.pushState = (...args) => {
            pushState.apply(history, args);
            setTimeout(() => this.decorateRoot(document), NAVIGATION_DEBOUNCE_MS);
        };
        history.replaceState = (...args) => {
            replaceState.apply(history, args);
            setTimeout(() => this.decorateRoot(document), NAVIGATION_DEBOUNCE_MS);
        };
        window.addEventListener('popstate', () =>
            setTimeout(() => this.decorateRoot(document), NAVIGATION_DEBOUNCE_MS)
        );

        const observer = new MutationObserver(mutations => {
            mutations.forEach(({ addedNodes }) => {
                addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) this.decorateRoot(node);
                });
            });
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
    const cache = new CacheManager(adapter);
    const disabledManager = new DisabledClientsManager(adapter);
    const api = new ApiClientManager(cache, disabledManager, adapter);
    const renderer = new OverlayRenderer();
    const surfaces = new SurfaceManager();
    window.fmApi = api;
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces);
    app.init();
    return { api, cache };
}
