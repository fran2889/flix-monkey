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
export class SurfaceManager {
    #logger;
    constructor(logger) {
        this.#logger = logger;
    }

    /*
     * Surface priority order: title-card → search → previewModal-mini → previewModal-detail.
     * A container matched by an earlier surface is added to `seen` and skipped by
     * all later surfaces, so declaration order determines which definition "wins".
     */
    #SURFACES = [
        {
            // Browse and genre page row cards. `.fallback-text` is the text title
            // Netflix renders for cards whose thumbnail has no baked-in title logo.
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.title-card',
            fadeable: true,
        },
        {
            // Search result grid cards. The card element itself carries the full
            // title via aria-label; there is no separate fallback-text here.
            titleSelectors: '[data-uia="standard-card"]',
            getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
            containerSel: '[data-uia="standard-card"]',
            fadeable: true,
        },
        {
            // Hover mini-modal (card mouse-over). Scoped to `.mini-modal` so the
            // detail-modal surface can target the same player container independently.
            titleSelectors: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
            getTitle: el => el.getAttribute('alt')?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
        },
        {
            // Full "More Info" detail modal. The boxart <img alt> inside the player
            // container is the only selector that matches in both mini and detail contexts.
            titleSelectors: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
            getTitle: el => el.getAttribute('alt')?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
        },
    ];

    discover(root) {
        const seen = new Set();
        const results = [];
        this.#SURFACES.forEach(surface => {
            let titleEls;
            try {
                titleEls = root.querySelectorAll(surface.titleSelectors);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const title = surface.getTitle(titleEl);
                if (!title) return;
                let container = titleEl.closest(surface.containerSel);
                if (!container) {
                    this.#logger.warn('Surface container selector failed, falling back to parentElement', {
                        selector: surface.containerSel,
                    });
                    container = titleEl.parentElement;
                }
                if (!container || seen.has(container)) return;
                seen.add(container);
                results.push({ container, title, fadeable: surface.fadeable ?? false });
            });
        });
        return results;
    }
}
