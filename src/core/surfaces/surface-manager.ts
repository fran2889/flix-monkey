/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DiscoveredSurface, SurfaceDefinition } from '../../types/surfaces';
import type { Logger } from '../logger';

/**
 * Creates a resolver that reads a title from the given attribute.
 *
 * @param attribute - Attribute containing the title.
 * @returns Resolver returning the attribute value, or undefined when absent.
 */
export const titleFromAttribute =
    (attribute: string) =>
    (element: Element): string | undefined => {
        const value = element.getAttribute(attribute);
        return value ?? undefined;
    };

/**
 * Creates a resolver that finds the closest ancestor matching a selector.
 *
 * @param selector - Selector for the surface container.
 * @returns Resolver returning the closest matching element, or undefined.
 */
export const containerFromClosest =
    (selector: string) =>
    (element: Element): Element | undefined => {
        return element.closest(selector) ?? undefined;
    };

/**
 * Resolves the parent element of a title element.
 *
 * @param element - Title element.
 * @returns Parent element, or undefined when the element has no parent.
 */
export const containerFromParent = (element: Element): Element | undefined => {
    return element.parentElement ?? undefined;
};

/**
 * Manages discovery and identification of streaming service surfaces for rating overlay injection.
 */
export class SurfaceManager {
    readonly #SURFACES: SurfaceDefinition[];
    readonly #logger: Logger;

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
                const title = rawTitle?.trim();
                if (!title) return;
                let container = surface.getContainer(titleEl);
                if (!container) {
                    this.#logger.warn(`Surface container resolver failed for ${title}, falling back to parentElement`);
                    container = titleEl.parentElement ?? undefined;
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
