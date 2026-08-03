/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @typedef {Object} SurfaceDefinition
 * @property {string} titleSelector - CSS selector for title elements
 * @property {string} containerSelector - CSS selector for container elements
 * @property {string} [titleAttribute] - Attribute name containing the title text
 * @property {(element: Element) => string|null|undefined} [getTitle] - Callback that returns the title text
 * @property {(element: Element) => Element|null|undefined} [getContainer] - Callback that returns the container
 * @property {boolean} fadeable - Whether this surface supports fading
 * @property {boolean} showFadeToggle - Whether to show fade toggle button
 */

/**
 * Netflix-specific surface definitions for various UI surfaces.
 * Named properties allow for easy reference: NETFLIX_SURFACES.TITLE_CARD, etc.
 */
export const NETFLIX_SURFACES = Object.freeze({
    /**
     * Browse and genre page row cards. The <a> element carries the full title via aria-label.
     */
    TITLE_CARD: Object.freeze({
        titleSelector: '.title-card a[aria-label]',
        containerSelector: '.title-card',
        titleAttribute: 'aria-label',
        fadeable: true,
        showFadeToggle: false,
    }),
    /**
     * Search result grid cards. The card element itself carries the full title via aria-label.
     */
    SEARCH_CARD: Object.freeze({
        titleSelector: '[data-uia="standard-card"]',
        containerSelector: '[data-uia="standard-card"]',
        titleAttribute: 'aria-label',
        fadeable: true,
        showFadeToggle: false,
    }),
    /** Browse-page Continue Watching cards. */
    PROGRESS_CARD: Object.freeze({
        titleSelector: '[data-uia="progress-card"][aria-label]',
        containerSelector: '[data-uia="progress-card"]',
        titleAttribute: 'aria-label',
        fadeable: true,
        showFadeToggle: false,
    }),
    /** Browse-page Top 10 cards. */
    RANKED_CARD: Object.freeze({
        titleSelector: '[data-uia="ranked-card"][aria-label]',
        containerSelector: '[data-uia="ranked-card"]',
        titleAttribute: 'aria-label',
        fadeable: true,
        showFadeToggle: false,
    }),
    /**
     * Hover mini-modal (card mouse-over). Scoped to .mini-modal so the detail-modal surface
     * can target the same player container independently.
     */
    PREVIEW_MINI: Object.freeze({
        titleSelector: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
        containerSelector: '.previewModal--player_container',
        titleAttribute: 'alt',
        fadeable: false,
        showFadeToggle: true,
    }),
    /**
     * Full "More Info" detail modal. The boxart <img alt> inside the player container
     * is the only selector that matches in both mini and detail contexts.
     */
    PREVIEW_DETAIL: Object.freeze({
        titleSelector: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
        containerSelector: '.previewModal--player_container',
        titleAttribute: 'alt',
        fadeable: false,
        showFadeToggle: false,
    }),
});

/**
 * Base surface manager - generic discovery logic that works for any streaming platform.
 * Accepts either an array of surface definitions or a named object (values will be used).
 */
export class SurfaceManager {
    #SURFACES;
    #logger;

    /**
     * @param {Object<string, SurfaceDefinition>} surfaceDefs - Named surface definitions object
     * @param {import('./logger.js').Logger} logger - Logger instance
     */
    constructor(surfaceDefs, logger) {
        this.#SURFACES = Object.values(surfaceDefs);
        this.#logger = logger;
    }

    /**
     * Discovers all surface containers with titles in the given root element.
     *
     * @param {Element|Document} root - The root element to search within
     * @returns {Array<{container: Element, title: string, fadeable: boolean, showFadeToggle: boolean}>}
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
                const rawTitle = surface.getTitle
                    ? surface.getTitle(titleEl)
                    : titleEl.getAttribute(surface.titleAttribute);
                const title = rawTitle?.trim() ?? null;
                if (!title) return;
                let container = surface.getContainer?.(titleEl);
                if (!container) container = titleEl.closest(surface.containerSelector);
                if (!container) {
                    this.#logger.warn('Surface container selector failed, falling back to parentElement', {
                        selector: surface.containerSelector,
                    });
                    container = titleEl.parentElement;
                }
                if (!container || seen.has(container)) return;
                seen.add(container);
                results.push({
                    container,
                    title,
                    fadeable: surface.fadeable,
                    showFadeToggle: surface.showFadeToggle,
                });
            });
        });
        return results;
    }
}

/**
 * Netflix surface manager - discovers surfaces specific to Netflix UI.
 */
export class NetflixSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(NETFLIX_SURFACES, logger);
    }
}

/**
 * Extracts a title from an HBO Max tile aria-label.
 *
 * @param {Element} tile - HBO Max tile element
 * @returns {string|null} Extracted title, or null if the tile is unsupported
 */
export function extractHboMaxTitle(tile) {
    const label = tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
    if (!label) return null;

    if (tile.dataset.sonicType === 'video') {
        const match = label.match(/^Watch\s+(.+?)[.,]\s+(?:Season|Episode)\s+\d+(?=(?:[,.]\s|:\s|[,.]$))/u);
        return match?.[1]?.trim() || null;
    }
    if (!['movie', 'show', 'mini-series'].includes(tile.dataset.sonicType)) return null;

    const match =
        label.match(/^Number\s+\d+:\s+(.+?)\.\s+\d+\s+\D+\s+\d+(?:\.|$)/u) ??
        label.match(/^(.+?)\.\s+Row\s+\d+\s+of\s+\d+,\s+Column\s+\d+\s+of\s+\d+(?:\.|$)/u) ??
        label.match(/^(.+?)\.\s+\d+\s+\D+\s+\d+(?:\.|$)/u);
    return match?.[1]?.trim() || null;
}

function isHboMaxTop10Tile(tile) {
    const label = tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
    return /^Number\s+\d+:\s+/u.test(label ?? '');
}

/**
 * HBO Max-specific surface definitions for browse page tiles.
 */
export const HBO_MAX_SURFACES = Object.freeze({
    TILE: Object.freeze({
        titleSelector: 'a[data-testid$="_tile"][data-sonic-type]',
        containerSelector: 'a[data-testid$="_tile"][data-sonic-type]',
        getTitle: extractHboMaxTitle,
        getContainer: tile => {
            const container = tile.parentElement;
            container?.classList.toggle('fm-hbo-top-10', isHboMaxTop10Tile(tile));
            return container;
        },
        fadeable: true,
        showFadeToggle: false,
    }),
});

/**
 * HBO Max surface manager - discovers surfaces specific to the HBO Max UI.
 */
export class HboMaxSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(HBO_MAX_SURFACES, logger);
    }
}
