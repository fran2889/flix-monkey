/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * @typedef {Object} SurfaceDefinition
 * @property {string} titleSelector - CSS selector for title elements
 * @property {(element: Element) => string|null|undefined} getTitle - Callback that returns the title text
 * @property {(element: Element) => Element|null|undefined} getContainer - Callback that returns the container
 * @property {(container: Element, element: Element) => void} [decorateContainer] - Callback that decorates the resolved container
 * @property {boolean} [fadeable=false] - Whether this surface supports fading
 * @property {boolean} [showFadeToggle=false] - Whether to show fade toggle button
 */

/**
 * @typedef {Object} DiscoveredSurface
 * @property {Element} container
 * @property {string} title
 * @property {boolean} fadeable
 * @property {boolean} showFadeToggle
 */

const titleFromAttribute = attribute => element => element.getAttribute(attribute);
const containerFromClosest = selector => element => element.closest(selector);
const containerFromParent = element => element.parentElement;
const HBO_MAX_TITLE_PATTERNS = Object.freeze([
    /^Number \d+: (.+)\. \d+ of \d+\.?$/u,
    /^(.+)\. Row \d+ of \d+, Column \d+ of \d+(?:\. (?:New Episode|Released in \d{4}))?\.?$/u,
    /^(.+)\. \d+ of \d+(?:\. (?:New|New Episode|Leaving Soon))?\.?$/u,
]);
const HBO_MAX_WATCH_TITLE_PATTERNS = Object.freeze([
    /^Watch (.+)\. Season \d+(?=, |: |\. |$)/u,
    /^Watch (.+)[.,] Episode \d+(?=, |: |\. |$)/u,
]);
const DISNEY_PLUS_PREFIX_BLOCK =
    /^(?:(?:Hulu Original Series|Disney\+ Original|(?:Subtitles|Dubbing) Available Badge|New (?:Movie|Series|Episode) Badge|New Season|New Badge) )+/u;
const DISNEY_PLUS_TITLE_END =
    /(?<= )(?:Rated \d+\+|Released \d{4}|Disney\+ Original|Hulu Original Series|Hulu Generic|Action and Adventure|Kids and Family)(?=[. ]|$)/u;

function canonicalizeDisneyPlusTitle(title) {
    const canonicalTitle = title
        .replace(/^A Marvel Television Special Presentation [\u2014-] /u, '')
        .replace(/^Marvel Studios' /u, '');
    const starWarsEpisode = /^Star Wars: (.+) \(Episode ([IVXLCDM]+)\)$/u.exec(canonicalTitle);
    return starWarsEpisode ? `Star Wars: Episode ${starWarsEpisode[2]} - ${starWarsEpisode[1]}` : canonicalTitle;
}

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

export class SurfaceManager {
    #SURFACES;
    #logger;

    /**
     * @param {Object<string, SurfaceDefinition>} surfaceDefs - Definitions used for DOM discovery.
     * @param {import('./logger.js').Logger} logger - Receives selector and container-resolution failures.
     */
    constructor(surfaceDefs, logger) {
        this.#SURFACES = Object.values(surfaceDefs);
        this.#logger = logger;
    }

    /**
     * Returns unique, valid surfaces discovered below root. Invalid selectors are ignored and
     * missing containers fall back to the title element's parent.
     *
     * @param {Element|Document} root
     * @returns {DiscoveredSurface[]}
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
                const rawTitle = surface.getTitle(titleEl);
                const title = rawTitle?.trim() ?? null;
                if (!title) return;
                let container = surface.getContainer(titleEl);
                if (!container) {
                    this.#logger.warn(`Surface container resolver failed for ${title}, falling back to parentElement`);
                    container = titleEl.parentElement;
                }
                if (!container || seen.has(container)) return;
                surface.decorateContainer?.(container, titleEl);
                seen.add(container);
                results.push({
                    container,
                    title,
                    fadeable: surface.fadeable ?? false,
                    showFadeToggle: surface.showFadeToggle ?? false,
                });
            });
        });
        return results;
    }
}

export class NetflixSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(NETFLIX_SURFACES, logger);
    }
}

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

function getNormalizedHboMaxAriaLabel(tile) {
    return tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
}

function isHboMaxTop10Tile(tile) {
    const label = getNormalizedHboMaxAriaLabel(tile);
    return /^Number\s+\d+:\s+/u.test(label ?? '');
}

export const HBO_MAX_SURFACES = Object.freeze({
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

export function extractDisneyPlusTitle(tile) {
    const imageTitle = [...tile.querySelectorAll('img[alt]:not([data-testid="set-item-rating"] img)')]
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

export const DISNEY_PLUS_SURFACES = Object.freeze({
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
        getTitle: wrapper => wrapper.querySelector('[data-testid="cw-set-item-metadata"]')?.children[1]?.textContent,
        getContainer: containerFromClosest(
            '[data-testid="set-shelf-item"], [data-testid="set-shelf-item-shelf-pagination-spy"]'
        ),
        fadeable: true,
        showFadeToggle: true,
    }),
});

export class HboMaxSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(HBO_MAX_SURFACES, logger);
    }
}

export class DisneyPlusSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(DISNEY_PLUS_SURFACES, logger);
    }
}
