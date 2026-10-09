/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DiscoveredSurface, SurfaceDefinition } from '../../types/surfaces';
import type { Logger } from '../logger';

const titleFromAttribute =
    (attribute: string) =>
    (element: Element): string | null => {
        const value = element.getAttribute(attribute);
        return value !== null ? value : null;
    };

const containerFromClosest =
    (selector: string) =>
    (element: Element): Element | null => {
        return element.closest(selector);
    };

const containerFromParent = (element: Element): Element | null => {
    return element.parentElement;
};

/**
 * Manages discovery and identification of streaming service surfaces for rating overlay injection.
 */
export class SurfaceManager {
    #SURFACES: SurfaceDefinition[];
    #logger: Logger;

    /**
     * @param logger - Receives selector and container-resolution failures.
     * @param surfaceDefs - Definitions used for DOM discovery.
     */
    constructor(logger: Logger, surfaceDefs: Record<string, SurfaceDefinition>) {
        this.#SURFACES = Object.values(surfaceDefs);
        this.#logger = logger;
    }

    /**
     * Returns unique, valid surfaces discovered below root. Invalid selectors are ignored and
     * missing containers fall back to the title element's parent.
     *
     * @param root - The root element to search within.
     * @returns Array of discovered surfaces.
     */
    discover(root: Element | Document): DiscoveredSurface[] {
        const seen = new Set<Element>();
        const results: DiscoveredSurface[] = [];
        this.#SURFACES.forEach(surface => {
            let titleEls: Element[];
            try {
                titleEls = Array.from(root.querySelectorAll(surface.titleSelector));
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const rawTitle = surface.getTitle(titleEl);
                const title = rawTitle?.trim() ?? null;
                if (!title) return;
                let container: Element | null = surface.getContainer(titleEl) ?? null;
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
