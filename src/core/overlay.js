/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { createLoadingOverlayElement, createOverlayElement } from './ui/overlay-elements.js';
import { buildOverlayStyles } from './ui/overlay-styles.js';

/**
 * @typedef {Object} ServicePresentation
 * @property {readonly string[]} [TOP_10_SELECTORS]
 * @property {string} [TOP_10_OFFSET]
 */

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;
    #serviceConstants;

    /**
     * @param {import('./config/config-manager.js').ConfigManager} config - Application configuration
     * @param {ServicePresentation} [serviceConstants={}] - Service-specific presentation constants.
     */
    constructor(config, serviceConstants = {}) {
        this.#config = config;
        this.#serviceConstants = serviceConstants;
    }

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

    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    isLoading(container) {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

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

    removeLoadingOverlay(container) {
        container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
    }

    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }

    clearAllOverlays() {
        document.querySelectorAll(`.${this.#OVERLAY_CLASS}`).forEach(el => {
            el.parentElement?.removeAttribute(this.#OVERLAY_ATTR);
            el.remove();
        });
    }
}
