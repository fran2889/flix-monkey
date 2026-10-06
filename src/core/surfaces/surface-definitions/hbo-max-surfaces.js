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
 *
 */
function getNormalizedHboMaxAriaLabel(tile) {
    return tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
}

/**
 *
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
 *
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
 *
 */
export class HboMaxSurfaceManager extends SurfaceManager {
    /**
     *
     */
    constructor(logger) {
        super(logger, HBO_MAX_SURFACES);
    }
}
