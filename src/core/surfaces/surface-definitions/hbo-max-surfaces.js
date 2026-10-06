/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { containerFromParent, SurfaceManager } from '../surface-manager.js';

const HBO_MAX_TITLE_PATTERNS = Object.freeze([
    /^Number \d+: (.+)\. \d+ of \d+\.?$/u,
    /^(.+)\. Row \d+ of \d+, Column \d+ of \d+\.?/u,
    /^(.+)\. \d+ of \d+(?:\. (?:Just Added|New|New Episode|Leaving Soon))?\.?$/u,
]);
const HBO_MAX_WATCH_TITLE_PATTERNS = Object.freeze([
    /^Watch (.+)\. Season \d+(?=, |: |\. |$)/u,
    /^Watch (.+)[.,] Episode \d+(?=, |: |\. |$)/u,
]);

/**
 * Extracts and normalizes aria-label from HBO Max tile.
 *
 * @param {HTMLElement} tile - HBO Max content tile element.
 * @returns {string|null} Normalized aria-label text or null.
 */
function getNormalizedHboMaxAriaLabel(tile) {
    return tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
}

/**
 * Extracts title from HBO Max tile element using pattern matching on aria-label.
 *
 * @param {HTMLElement} tile - DOM element representing an HBO Max content tile.
 * @returns {string|null} Extracted title or null if not found.
 */
export function extractHboMaxTitle(tile) {
    const label = getNormalizedHboMaxAriaLabel(tile);
    if (!label) return null;

    if (tile.dataset.sonicType === 'video') {
        for (const pattern of HBO_MAX_WATCH_TITLE_PATTERNS) {
            const title = label.match(pattern)?.[1]?.trim();
            if (title) return title;
        }
        return null;
    }

    if (!['movie', 'show', 'mini-series'].includes(tile.dataset.sonicType)) return null;

    for (const pattern of HBO_MAX_TITLE_PATTERNS) {
        const title = label.match(pattern)?.[1]?.trim();
        if (title) return title;
    }
    return null;
}

/**
 * Checks if an HBO Max tile represents a Top 10 item.
 *
 * @param {HTMLElement} tile - HBO Max content tile element.
 * @returns {boolean} True if the tile is a Top 10 item.
 */
function isHboMaxTop10Tile(tile) {
    const label = getNormalizedHboMaxAriaLabel(tile);
    return /^Number\s+\d+:\s+/u.test(label ?? '');
}

const HBO_MAX_SURFACES = Object.freeze({
    TILE: Object.freeze({
        titleSelector: 'a[data-testid$="_tile"][data-sonic-type]',
        getTitle: extractHboMaxTitle,
        getContainer: containerFromParent,
        decorateContainer: (container, tile) => {
            container.classList.toggle('fm-hbo-top-10', isHboMaxTop10Tile(tile));
        },
        fadeable: true,
        showFadeToggle: true,
    }),
});

/**
 * HBO Max specific surface manager for discovering HBO Max streaming service surfaces.
 */
export class HboMaxSurfaceManager extends SurfaceManager {
    /**
     * Creates HBO Max surface manager with HBO Max-specific surfaces.
     *
     * @param {import('../../logger.js').Logger} logger - For logging surface discovery issues.
     */
    constructor(logger) {
        super(logger, HBO_MAX_SURFACES);
    }
}
