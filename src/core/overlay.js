/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { createLoadingOverlayElement, createOverlayElement } from './ui/overlay-elements.js';
import { buildOverlayStyles } from './ui/overlay-styles.js';

/**
 * Handles creation and management of rating overlay DOM elements.
 */
export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;
    #serviceConstants;

    /**
     * Creates a renderer bound to application configuration.
     *
     * @param {import('./config/config-manager.js').ConfigManager} config - Application configuration.
     * @param {import('../types/overlay.js').ServicePresentation} [serviceConstants={}] - Service-specific presentation constants.
     */
    constructor(config, serviceConstants = {}) {
        this.#config = config;
        this.#serviceConstants = serviceConstants;
    }

    /**
     * Injects CSS styles for rating overlays into the document head.
     */
    injectStyles() {
        const existing = document.getElementById('fm-overlay-styles');
        const cssText = buildOverlayStyles({
            overlayClass: this.#OVERLAY_CLASS,
            corner: this.#config.get('overlayCorner'),
            top10Selectors: this.#serviceConstants.TOP_10_SELECTORS,
            top10Offset: this.#serviceConstants.TOP_10_OFFSET,
        });
        if (existing) {
            existing.textContent = cssText;
        } else {
            const style = document.createElement('style');
            style.id = 'fm-overlay-styles';
            style.textContent = cssText;
            document.head.appendChild(style);
        }
    }

    /**
     * Checks if a container already has a rating overlay.
     *
     * @param {HTMLElement} container - DOM element to check.
     * @returns {boolean} True when the overlay marker attribute is present.
     */
    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    /**
     * Checks if a container currently shows a loading indicator.
     *
     * @param {HTMLElement} container - DOM element to check.
     * @returns {boolean} True when a loading element is present in the container.
     */
    isLoading(container) {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

    /**
     * Ensures container has relative positioning for absolute-positioned overlays.
     *
     * @param {HTMLElement} container - DOM element to check and potentially modify.
     */
    ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    /**
     * Injects the loading placeholder, which links to an IMDb search for the title.
     *
     * @param {HTMLElement} container - Surface container to inject into.
     * @param {string} displayTitle - Title as shown by the streaming service, used as the IMDb search term.
     */
    injectLoadingOverlay(container, displayTitle) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(createLoadingOverlayElement(this.#OVERLAY_CLASS, this.#LOADING_CLASS, displayTitle));
    }

    /**
     * Replaces any existing overlay in `container` with a fully rendered one.
     *
     * @param {HTMLElement} container - Surface container to inject into.
     * @param {import('./title.js').Title} titleObj - Resolved title data to render.
     * @param {'always'|'never'|null} fadeToggleState - Stored fade override, or null for auto.
     * @param {((state: string|null) => void)|null} onFadeToggleClick - Fade toggle handler, or null when the toggle is hidden.
     * @param {((displayTitle: string, imdbId: string|null) => void)|null} onEditClick - Edit icon handler, or null to omit the icon.
     * @param {((displayTitle: string) => void)|null} onRefreshClick - Refresh icon handler, or null to omit the icon.
     * @param {string} displayTitle - Title as shown by the streaming service; also the IMDb search term.
     */
    injectOverlay(container, titleObj, fadeToggleState, onFadeToggleClick, onEditClick, onRefreshClick, displayTitle) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        const overlay = createOverlayElement(titleObj, {
            overlayClass: this.#OVERLAY_CLASS,
            showRtRating: this.#config.getBool('showRtRating'),
            showMcRating: this.#config.getBool('showMcRating'),
            showFadeToggle: this.#config.getBool('enableFadeToggle'),
            fadeToggleState,
            onFadeToggleClick,
            onEditClick,
            onRefreshClick,
            displayTitle,
            corner: this.#config.get('overlayCorner'),
        });
        container.appendChild(overlay);
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    /**
     * Removes loading indicator from a container.
     *
     * @param {HTMLElement} container - DOM element to clean up.
     */
    removeLoadingOverlay(container) {
        container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
    }

    /**
     * Applies or removes fade styling based on the fade state.
     *
     * @param {HTMLElement} container - DOM element to apply fade to.
     * @param {boolean} shouldFade - Whether the container should be faded.
     */
    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }

    /**
     * Removes all rating overlays from the document.
     */
    clearAllOverlays() {
        document.querySelectorAll(`.${this.#OVERLAY_CLASS}`).forEach(el => {
            el.parentElement?.removeAttribute(this.#OVERLAY_ATTR);
            el.remove();
        });
    }
}
