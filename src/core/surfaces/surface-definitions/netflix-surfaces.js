/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { containerFromClosest, SurfaceManager, titleFromAttribute } from '../surface-manager.js';

export const NETFLIX_SURFACES = Object.freeze({
    // Browse and genre page row cards: the <a> element carries the full title via aria-label.
    TITLE_CARD: Object.freeze({
        titleSelector: '.title-card a[aria-label]',
        getTitle: titleFromAttribute('aria-label'),
        getContainer: containerFromClosest('.title-card'),
        fadeable: true,
        showFadeToggle: false,
    }),
    // Search result grid cards: the card element itself carries the full title via aria-label.
    SEARCH_CARD: Object.freeze({
        titleSelector: '[data-uia="standard-card"]',
        getTitle: titleFromAttribute('aria-label'),
        getContainer: containerFromClosest('[data-uia="standard-card"]'),
        fadeable: true,
        showFadeToggle: false,
    }),
    // Browse-page Continue Watching cards.
    PROGRESS_CARD: Object.freeze({
        titleSelector: '[data-uia="progress-card"][aria-label]',
        getTitle: titleFromAttribute('aria-label'),
        getContainer: containerFromClosest('[data-uia="progress-card"]'),
        fadeable: true,
        showFadeToggle: false,
    }),
    // Browse-page Top 10 cards.
    RANKED_CARD: Object.freeze({
        titleSelector: '[data-uia="ranked-card"][aria-label]',
        getTitle: titleFromAttribute('aria-label'),
        getContainer: containerFromClosest('[data-uia="ranked-card"]'),
        fadeable: true,
        showFadeToggle: false,
    }),
    // Hover mini-modal: scope to .mini-modal so the detail modal can target the player container independently.
    PREVIEW_MINI: Object.freeze({
        titleSelector: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
        getTitle: titleFromAttribute('alt'),
        getContainer: containerFromClosest('.previewModal--player_container'),
        fadeable: false,
        showFadeToggle: true,
    }),
    // Full "More Info" modal: the boxart img[alt] is the only selector shared by mini and detail contexts.
    PREVIEW_DETAIL: Object.freeze({
        titleSelector: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
        getTitle: titleFromAttribute('alt'),
        getContainer: containerFromClosest('.previewModal--player_container'),
        fadeable: false,
        showFadeToggle: false,
    }),
});

export class NetflixSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(NETFLIX_SURFACES, logger);
    }
}
