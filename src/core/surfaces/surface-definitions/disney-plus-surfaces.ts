/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SurfaceDefinition } from '../../../types/surfaces';
import { containerFromClosest, containerFromParent, SurfaceManager } from '../surface-manager';

const DISNEY_PLUS_PREFIX_BLOCK =
    /^(?:(?:Hulu Original Series|Disney\+ Original|(?:Subtitles|Dubbing) Available Badge|New (?:Movie|Series) Badge|New (?:Episode|Season)(?: Badge)?|New Badge) )+/u;
const DISNEY_PLUS_TITLE_END =
    /(?<= )(?:Rated \d+\+|Released \d{4}|Disney\+ Original|Hulu Original Series|Hulu Generic|Action and Adventure|Kids and Family)(?=[. ]|$)/u;

/**
 * Normalizes Disney+ title text by removing special prefixes and reformatting Star Wars episodes.
 *
 * @param title - Original Disney+ title text.
 * @returns Canonicalized title.
 */
function canonicalizeDisneyPlusTitle(title: string): string {
    const canonicalTitle = title
        .replace(/^A Marvel Television Special Presentation [\u2014-] /u, '')
        .replace(/^Marvel Studios' /u, '');
    const starWarsEpisode = /^Star Wars: (.+) \(Episode ([IVXLCDM]+)\)$/u.exec(canonicalTitle);
    return starWarsEpisode ? `Star Wars: Episode ${starWarsEpisode[2]} - ${starWarsEpisode[1]}` : canonicalTitle;
}

/**
 * Extracts the canonical title from a Disney+ tile element using various selectors.
 *
 * @param element - DOM element representing a Disney+ content tile.
 * @returns Extracted title or null if not found.
 */
export function extractDisneyPlusTitle(element: Element): string | null {
    const tile = element as HTMLElement;
    const imageTitle = [...tile.querySelectorAll<HTMLImageElement>('img[alt]:not([data-testid="set-item-rating"] img)')]
        .map(image => image.alt.trim())
        .find(Boolean);
    if (imageTitle) return canonicalizeDisneyPlusTitle(imageTitle);

    const label = tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
    const detailsSuffix = 'Select for details on this title.';
    if (!label || /^(?:LIVE|Upcoming)\b/iu.test(label) || !label.endsWith(detailsSuffix)) return null;

    const title = label
        .slice(0, -detailsSuffix.length)
        .trim()
        .replace(DISNEY_PLUS_PREFIX_BLOCK, '')
        .split(DISNEY_PLUS_TITLE_END)[0]
        .trim();
    return title ? canonicalizeDisneyPlusTitle(title) : null;
}

const DISNEY_PLUS_SURFACES: Record<string, SurfaceDefinition> = Object.freeze({
    SHELF_CARD: Object.freeze({
        titleSelector: 'a[data-testid="set-item"][data-item-id][href*="/browse/entity-"]',
        getTitle: extractDisneyPlusTitle,
        getContainer: containerFromParent,
        fadeable: true,
        showFadeToggle: true,
    }),
    CONTINUE_WATCHING: Object.freeze({
        titleSelector:
            '[data-testid="set-section"][data-set-style="continue_watching"] [data-testid="cw-set-item-wrapper"]',
        getTitle: (wrapper: Element): string | null => {
            const metadataEl = wrapper.querySelector('[data-testid="cw-set-item-metadata"]');
            return metadataEl?.children[1]?.textContent ?? null;
        },
        getContainer: containerFromClosest(
            '[data-testid="set-shelf-item"], [data-testid="set-shelf-item-shelf-pagination-spy"]'
        ),
        fadeable: true,
        showFadeToggle: true,
    }),
});

/**
 * Disney+ specific surface manager for discovering Disney+ streaming service surfaces.
 */
export class DisneyPlusSurfaceManager extends SurfaceManager {
    /**
     * Creates Disney+ surface manager with Disney+-specific surfaces.
     *
     * @param logger - For logging surface discovery issues.
     */
    constructor(logger: import('../../logger').Logger) {
        super(logger, DISNEY_PLUS_SURFACES);
    }
}
