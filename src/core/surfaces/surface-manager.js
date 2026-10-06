/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

const titleFromAttribute = attribute => element => element.getAttribute(attribute);
const containerFromClosest = selector => element => element.closest(selector);
const containerFromParent = element => element.parentElement;

export class SurfaceManager {
    #SURFACES;
    #logger;

    /**
     * @param {import('../logger.js').Logger} logger - Receives selector and container-resolution failures.
     * @param {Object<string, import('../types/surfaces.js').SurfaceDefinition>} surfaceDefs - Definitions used for DOM discovery.
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
     * @returns {import('../types/surfaces.js').DiscoveredSurface[]}
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
