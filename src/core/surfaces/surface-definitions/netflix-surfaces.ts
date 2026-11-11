/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SurfaceDefinition } from '../../../types/surfaces';
import type { Logger } from '../../logger';
import { containerFromClosest, SurfaceManager, titleFromAttribute } from '../surface-manager';

/**
 * Extracts the title from a Netflix More Like This tile.
 *
 * @param element - A `.titleCard--container` element.
 * @returns The trimmed accessible label, the trimmed artwork alt, or undefined.
 */
export function extractNetflixMoreLikeThisTitle(element: Element): string | undefined {
    const label = element.getAttribute('aria-label')?.trim();
    if (label) return label;

    const artwork = element.querySelector('.titleCard-imageWrapper img[alt]') ?? element.querySelector('img[alt]');
    const alt = artwork?.getAttribute('alt')?.trim();
    return alt === '' ? undefined : alt;
}

const containerFromMoreLikeThisArtwork = (element: Element): Element | undefined => {
    return element.querySelector('.titleCard-imageWrapper') ?? element;
};

export const NETFLIX_SURFACES: Record<string, SurfaceDefinition> = Object.freeze({
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
    // Title detail modal "More Like This" recommendations: the tile carries the label and the
    // artwork wrapper is the badge anchor. Ordinary browse-card fade behavior applies.
    MORE_LIKE_THIS: Object.freeze({
        titleSelector: '.moreLikeThis--wrapper .titleCard--container',
        getTitle: extractNetflixMoreLikeThisTitle,
        getContainer: containerFromMoreLikeThisArtwork,
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

/**
 * Netflix-specific surface manager for discovering and managing Netflix UI surfaces.
 */
export class NetflixSurfaceManager extends SurfaceManager {
    constructor(logger: Logger) {
        super(logger, NETFLIX_SURFACES);
    }
}
