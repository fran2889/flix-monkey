/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SurfaceDefinition } from '../../../types/surfaces';
import { containerFromParent, SurfaceManager } from '../surface-manager';

const HBO_MAX_TITLE_PATTERNS = Object.freeze([
    /^Number \d+: (.+)\. \d+ of \d+\.?$/u,
    /^(.+)\. Row \d+ of \d+, Column \d+ of \d+\.?/u,
    /^(.+)\. \d+ of \d+(?:\. (?:Just Added|New|New Episode|Leaving Soon))?\.?$/u,
]) as RegExp[];
const HBO_MAX_WATCH_TITLE_PATTERNS = Object.freeze([
    /^Watch (.+)\. Season \d+(?=, |: |\. |$)/u,
    /^Watch (.+)[.,] Episode \d+(?=, |: |\. |$)/u,
]) as RegExp[];

/**
 * Extracts and normalizes aria-label from HBO Max tile.
 *
 * @param element - HBO Max content tile element.
 * @returns Normalized aria-label text or null.
 */
function getNormalizedHboMaxAriaLabel(element: Element): string | null {
    const label = element.getAttribute('aria-label');
    if (label === null) return null;
    return label.replace(/[\u2066-\u2069]/g, '').trim();
}

/**
 * Extracts title from HBO Max tile element using pattern matching on aria-label.
 *
 * @param element - DOM element representing an HBO Max content tile.
 * @returns Extracted title or null if not found.
 */
export function extractHboMaxTitle(element: Element): string | null {
    const label = getNormalizedHboMaxAriaLabel(element);
    if (!label) return null;

    const tile = element as HTMLElement;
    if (tile.dataset.sonicType === 'video') {
        for (const pattern of HBO_MAX_WATCH_TITLE_PATTERNS) {
            const title = label.match(pattern)?.[1]?.trim();
            if (title) return title;
        }
        return null;
    }

    if (!['movie', 'show', 'mini-series'].includes(tile.dataset.sonicType ?? '')) return null;

    for (const pattern of HBO_MAX_TITLE_PATTERNS) {
        const title = label.match(pattern)?.[1]?.trim();
        if (title) return title;
    }
    return null;
}

/**
 * Checks if an HBO Max tile represents a Top 10 item.
 *
 * @param element - HBO Max content tile element.
 * @returns True if the tile is a Top 10 item.
 */
function isHboMaxTop10Tile(element: Element): boolean {
    const label = getNormalizedHboMaxAriaLabel(element);
    return /^Number\s+\d+:\s+/u.test(label ?? '');
}

const HBO_MAX_SURFACES: Record<string, SurfaceDefinition> = Object.freeze({
    TILE: Object.freeze({
        titleSelector: 'a[data-testid$="_tile"][data-sonic-type]',
        getTitle: extractHboMaxTitle,
        getContainer: containerFromParent,
        decorateContainer: (container: Element, element: Element): void => {
            container.classList.toggle('fm-hbo-top-10', isHboMaxTop10Tile(element));
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
     * @param logger - For logging surface discovery issues.
     */
    constructor(logger: import('../../logger').Logger) {
        super(logger, HBO_MAX_SURFACES);
    }
}
