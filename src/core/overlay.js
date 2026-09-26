/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { createLoadingOverlayElement, createOverlayElement } from './ui/overlay-elements.js';
import { buildOverlayStyles } from './ui/overlay-styles.js';

export { FADE_STATE_LABELS } from './ui/overlay-elements.js';

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;
    #onEditClick;
    #onRefreshClick;

    /**
     * @param {import('./config-manager.js').ConfigManager} config - Application configuration
     * @param {((displayTitle: string) => void)|null} [onEditClick] - Edit icon click handler
     * @param {((displayTitle: string) => void)|null} [onRefreshClick] - Refresh icon click handler
     */
    constructor(config, onEditClick = null, onRefreshClick = null) {
        this.#config = config;
        this.#onEditClick = onEditClick;
        this.#onRefreshClick = onRefreshClick;
    }

    injectStyles() {
        const existing = document.getElementById('fm-overlay-styles');
        const cssText = buildOverlayStyles({
            overlayClass: this.#OVERLAY_CLASS,
            corner: this.#config.get('overlayCorner'),
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

    injectLoadingOverlay(container) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(createLoadingOverlayElement(this.#OVERLAY_CLASS, this.#LOADING_CLASS));
    }

    injectOverlay(container, titleObj, fadeToggleState = null, onFadeToggleClick = null, topTenOffset = null) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        const overlay = createOverlayElement(titleObj, {
            overlayClass: this.#OVERLAY_CLASS,
            showRtRating: this.#config.getBool('showRtRating'),
            showMcRating: this.#config.getBool('showMcRating'),
            showFadeToggle: this.#config.getBool('enableFadeToggle'),
            fadeToggleState,
            onFadeToggleClick,
            onEditClick: this.#onEditClick,
            onRefreshClick: this.#onRefreshClick,
        });
        const corner = this.#config.get('overlayCorner');
        if (topTenOffset && corner.includes('left')) {
            overlay.style.left = `calc(${topTenOffset} + 6px)`;
        }
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
