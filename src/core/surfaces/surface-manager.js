/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

const titleFromAttribute = attribute => element => element.getAttribute(attribute);
const containerFromClosest = selector => element => element.closest(selector);
const containerFromParent = element => element.parentElement;

/**
 * Manages discovery and identification of streaming service surfaces for rating overlay injection.
 */
export class SurfaceManager {
    #SURFACES;
    #logger;

    /**
     * Subclasses supply their service's surface definitions; this class owns discovery.
     *
     * @param {import('../logger.js').Logger} logger - Receives selector and container-resolution failures.
     * @param {object} surfaceDefs - Definitions used for DOM discovery.
     */
    constructor(logger, surfaceDefs) {
        this.#SURFACES = Object.values(surfaceDefs);
        this.#logger = logger;
    }

    /**
     * Returns unique, valid surfaces discovered below root. Invalid selectors are ignored and
     * missing containers fall back to the title element's parent.
     *
     * @param {Element|Document} root - Element or document searched for surfaces.
     * @returns {import('../types/surfaces.js').DiscoveredSurface[]} Unique surfaces with a usable container and title.
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
