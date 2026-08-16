/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { createLoadingOverlayElement, createOverlayElement } from './ui/overlay-elements.js';
import { buildOverlayStyles } from './ui/overlay-styles.js';

export { FADE_STATE_LABELS } from './ui/overlay-elements.js';

/**
 * @typedef {Object} ServicePresentation
 * @property {string[]} [TOP_10_SELECTORS]
 * @property {string} [TOP_10_OFFSET]
 */

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;
    #serviceConstants;

    /**
     * @param {import('./config-manager.js').ConfigManager} config - Application configuration
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

    clearAllOverlays() {
        document.querySelectorAll(`.${this.#OVERLAY_CLASS}`).forEach(el => {
            el.parentElement?.removeAttribute(this.#OVERLAY_ATTR);
            el.remove();
        });
    }

    ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    injectLoadingOverlay(container) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(createLoadingOverlayElement(this.#OVERLAY_CLASS, this.#LOADING_CLASS));
    }

    removeLoadingOverlay(container) {
        container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
    }

    isLoading(container) {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

    injectOverlay(container, titleObj, fadeToggleState = null, onFadeToggleClick = null) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        const overlay = createOverlayElement(titleObj, {
            overlayClass: this.#OVERLAY_CLASS,
            showRtRating: this.#config.getBool('showRtRating'),
            showMcRating: this.#config.getBool('showMcRating'),
            showFadeToggle: this.#config.getBool('enableFadeToggle'),
            fadeToggleState,
            onFadeToggleClick,
        });
        container.appendChild(overlay);
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }
}
