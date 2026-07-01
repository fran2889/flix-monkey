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
 * Surface definitions for Netflix DOM discovery.
 * Each surface defines selectors and metadata for finding title elements and their containers.
 */
const TITLE_CARD = Object.freeze({
    // Browse and genre page row cards. The <a> element carries the full title via aria-label.
    titleSelector: '.title-card a[aria-label]',
    containerSelector: '.title-card',
    titleAttribute: 'aria-label',
    fadeable: true,
    showFadeToggle: false,
});

const SEARCH_CARD = Object.freeze({
    // Search result grid cards. The card element itself carries the full title via aria-label.
    titleSelector: '[data-uia="standard-card"]',
    containerSelector: '[data-uia="standard-card"]',
    titleAttribute: 'aria-label',
    fadeable: true,
    showFadeToggle: false,
});

const PREVIEW_MINI = Object.freeze({
    // Hover mini-modal (card mouse-over). Scoped to .mini-modal so the detail-modal surface
    // can target the same player container independently.
    titleSelector: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
    containerSelector: '.previewModal--player_container',
    titleAttribute: 'alt',
    fadeable: false,
    showFadeToggle: true,
});

const PREVIEW_DETAIL = Object.freeze({
    // Full "More Info" detail modal. The boxart <img alt> inside the player container
    // is the only selector that matches in both mini and detail contexts.
    titleSelector: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
    containerSelector: '.previewModal--player_container',
    titleAttribute: 'alt',
    fadeable: false,
    showFadeToggle: false,
});

/**
 * Named surface definitions for use in tests and external code.
 * Access surfaces by property name for type-safe access without string lookups.
 */
export const Surfaces = Object.freeze({
    TITLE_CARD,
    SEARCH_CARD,
    PREVIEW_MINI,
    PREVIEW_DETAIL,
});

/**
 * Surface definitions in priority order for discovery.
 * Earlier surfaces have priority; containers matched by earlier surfaces are skipped by later ones.
 */
export const SURFACE_DEFS = Object.freeze([TITLE_CARD, SEARCH_CARD, PREVIEW_MINI, PREVIEW_DETAIL]);

export class SurfaceManager {
    #logger;
    constructor(logger) {
        this.#logger = logger;
    }

    #SURFACES = SURFACE_DEFS;

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
                const title = titleEl.getAttribute(surface.titleAttribute)?.trim() ?? null;
                if (!title) return;
                let container = titleEl.closest(surface.containerSelector);
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
