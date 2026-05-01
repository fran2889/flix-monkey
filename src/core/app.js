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
        const cached = await this.#cache.read(displayTitle, domYear);
        if (cached !== null) {
            this.#renderer.ensureRelative(container);
            this.#renderer.injectOverlay(container, cached);
            this.#renderer.applyFade(container, cached, fadeable);
            return;
        }

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container, displayTitle);

        const dedupKey = `${displayTitle.toLowerCase()}_${domYear ?? ''}`;
        let promise = this.#inFlight.get(dedupKey);
        if (!promise) {
            promise = this.#api.getData(displayTitle, domYear).finally(() => this.#inFlight.delete(dedupKey));
            this.#inFlight.set(dedupKey, promise);
        }

        const data = await promise;
        this.#renderer.ensureRelative(container);
        this.#renderer.injectOverlay(container, data ?? Title.notFound(displayTitle));
        this.#renderer.applyFade(container, data, fadeable);
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
