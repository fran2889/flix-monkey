/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../types/overlay';
import type { ConfigManager } from './config/config-manager';
import type { Title } from './title';
import { createLoadingOverlayElement, createOverlayElement } from './ui/overlay-elements';
import { buildOverlayStyles } from './ui/overlay-styles';

/** Valid overlay corner positions. */
type OverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Handles creation and management of rating overlay DOM elements.
 */
export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config: ConfigManager;
    #serviceConstants: ServicePresentation;

    /**
     * @param config - Application configuration
     * @param serviceConstants - Service-specific presentation constants. Default: empty object.
     */
    constructor(config: ConfigManager, serviceConstants: ServicePresentation = {}) {
        this.#config = config;
        this.#serviceConstants = serviceConstants;
    }

    /**
     * Injects CSS styles for rating overlays into the document head.
     */
    injectStyles(): void {
        const existing = document.getElementById('fm-overlay-styles');
        const cssText = buildOverlayStyles({
            overlayClass: this.#OVERLAY_CLASS,
            corner: this.#config.get('overlayCorner') as OverlayCorner,
            top10Selectors: [...(this.#serviceConstants.TOP_10_SELECTORS ?? [])],
            top10Offset: this.#serviceConstants.TOP_10_OFFSET ?? '50%',
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
     * @param container - DOM element to check.
     * @returns Whether the container has an overlay.
     */
    hasOverlay(container: HTMLElement): boolean {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    /**
     * Checks if a container currently shows a loading indicator.
     *
     * @param container - DOM element to check.
     * @returns Whether the container is loading.
     */
    isLoading(container: HTMLElement): boolean {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

    /**
     * Ensures container has relative positioning for absolute-positioned overlays.
     *
     * @param container - DOM element to check and potentially modify.
     */
    ensureRelative(container: HTMLElement): void {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    /**
     * Injects the loading placeholder, which links to an IMDb search for the title.
     *
     * @param container - Surface container to inject into.
     * @param displayTitle - Title as shown by the streaming service, used as the IMDb search term.
     */
    injectLoadingOverlay(container: HTMLElement, displayTitle: string): void {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(createLoadingOverlayElement(this.#OVERLAY_CLASS, this.#LOADING_CLASS, displayTitle));
    }

    /**
     * Replaces any existing overlay in `container` with a fully rendered one.
     *
     * @param container - Surface container to inject into.
     * @param titleObj - Resolved title data to render.
     * @param fadeToggleState - Stored fade override, or null for auto.
     * @param onFadeToggleClick - Fade toggle handler, or null when the toggle is hidden.
     * @param onEditClick - Edit icon handler.
     * @param onRefreshClick - Refresh icon handler.
     * @param displayTitle - Title as shown by the streaming service; also the IMDb search term.
     */
    injectOverlay(
        container: HTMLElement,
        titleObj: Title,
        fadeToggleState: 'always' | 'never' | null,
        onFadeToggleClick: ((_element: HTMLElement) => void) | null,
        onEditClick: (_displayTitle: string) => void,
        onRefreshClick: (_displayTitle: string) => void,
        displayTitle: string
    ): void {
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
            corner: this.#config.get('overlayCorner') as OverlayCorner,
        });
        container.appendChild(overlay);
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    /**
     * Removes loading indicator from a container.
     *
     * @param container - DOM element to clean up.
     */
    removeLoadingOverlay(container: HTMLElement): void {
        container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
    }

    /**
     * Applies or removes fade styling based on the fade state.
     *
     * @param container - DOM element to apply fade to.
     * @param shouldFade - Whether the container should be faded.
     */
    applyFade(container: HTMLElement, shouldFade: boolean): void {
        container.classList.toggle('fm-faded', shouldFade);
    }

    /**
     * Removes all rating overlays from the document.
     */
    clearAllOverlays(): void {
        document.querySelectorAll(`.${this.#OVERLAY_CLASS}`).forEach(el => {
            el.parentElement?.removeAttribute(this.#OVERLAY_ATTR);
            el.remove();
        });
    }
}
