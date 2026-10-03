/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * @typedef {Object} SurfaceDefinition
 * @property {string} titleSelector - CSS selector for title elements
 * @property {(element: Element) => string|null|undefined} getTitle - Callback that returns the title text
 * @property {(element: Element) => Element|null|undefined} getContainer - Callback that returns the container
 * @property {(container: Element, element: Element) => void} [decorateContainer] - Callback that decorates the resolved container
 * @property {boolean} [fadeable=false] - Whether this surface supports fading
 * @property {boolean} [showFadeToggle=false] - Whether to show fade toggle button
 */

/**
 * @typedef {Object} DiscoveredSurface
 * @property {Element} container
 * @property {string} title
 * @property {boolean} fadeable
 * @property {boolean} showFadeToggle
 */

const titleFromAttribute = attribute => element => element.getAttribute(attribute);
const containerFromClosest = selector => element => element.closest(selector);
const containerFromParent = element => element.parentElement;

export class SurfaceManager {
    #SURFACES;
    #logger;

    /**
     * @param {import('../logger.js').Logger} logger - Receives selector and container-resolution failures.
     * @param {Object<string, SurfaceDefinition>} surfaceDefs - Definitions used for DOM discovery.
     */
    constructor(logger, surfaceDefs) {
        this.#SURFACES = Object.values(surfaceDefs);
        this.#logger = logger;
    }

    /**
     * Returns unique, valid surfaces discovered below root. Invalid selectors are ignored and
     * missing containers fall back to the title element's parent.
     *
     * @param {Element|Document} root
     * @returns {DiscoveredSurface[]}
     */
    discover(root) {
        const seen = new Set();
        const results = [];
        this.#SURFACES.forEach(surface => {
            let titleEls;
            try {
                titleEls = root.querySelectorAll(surface.titleSelector);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const rawTitle = surface.getTitle(titleEl);
                const title = rawTitle?.trim() ?? null;
                if (!title) return;
                let container = surface.getContainer(titleEl);
                if (!container) {
                    this.#logger.warn(`Surface container resolver failed for ${title}, falling back to parentElement`);
                    container = titleEl.parentElement;
                }
                if (!container || seen.has(container)) return;
                surface.decorateContainer?.(container, titleEl);
                seen.add(container);
                results.push({
                    container,
                    title,
                    fadeable: surface.fadeable ?? false,
                    showFadeToggle: surface.showFadeToggle ?? false,
                });
            });
        });
        return results;
    }
}

export { containerFromClosest, containerFromParent, titleFromAttribute };
