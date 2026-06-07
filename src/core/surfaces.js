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

    // Surface priority order: title-card → search → bob → previewModal → jawBone.
    // A container matched by an earlier surface is added to `seen` and skipped by
    // all later surfaces, so declaration order determines which definition "wins".
    #SURFACES = [
        {
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.title-card',
            fadeable: true,
        },
        {
            titleSelectors: '[data-uia="standard-card"]',
            getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
            containerSel: '[data-uia="standard-card"]',
            fadeable: true,
        },
        {
            titleSelectors: '.bob-title',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.bob-container',
            fadeable: false,
        },
        {
            titleSelectors: [
                '.previewModal--player-titleTreatmentWrapper img[alt]',
                '.previewModal--player_container img[alt]',
                '[data-uia="previewModal-title"]',
                '.previewModal--boxarttitle',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
        },
        {
            titleSelectors: [
                '.jawBone img[alt]',
                '.jawBoneContainer img[alt]',
                '.previewModal--detailsMetadata img[alt]',
                '.jawBone .image-fallback-text',
                '.jawBoneContainer .image-fallback-text',
                '.previewModal--detailsMetadata h3',
                '.previewModal--detailsMetadata .title',
                '.previewModal--detailsMetadata [data-uia="previewModal-title"]',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
            containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
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
                    this.#logger.debug('Surface container selector failed, falling back to parentElement', {
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
