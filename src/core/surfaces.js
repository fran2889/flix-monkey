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
                    this.#logger.warn('Surface container resolver failed, falling back to parentElement');
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
        const match = label.match(/^Watch\s+(.+?)[.,]\s+(?:Season|Episode)\s+\d+(?=(?:[,.]\s|:\s|[,.]$))/u);
        return match?.[1]?.trim() || null;
    }
    if (!['movie', 'show', 'mini-series'].includes(tile.dataset.sonicType)) return null;

    const match =
        label.match(/^Number\s+\d+:\s+(.+?)\.\s+\d+\s+\D+\s+\d+(?:\.|$)/u) ??
        label.match(/^(.+?)\.\s+Row\s+\d+\s+of\s+\d+,\s+Column\s+\d+\s+of\s+\d+(?:\.|$)/u) ??
        label.match(/^(.+?)\.\s+\d+\s+\D+\s+\d+(?:\.|$)/u);
    return match?.[1]?.trim() || null;
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
        showFadeToggle: false,
    }),
});

export function extractDisneyPlusTitle(tile) {
    const imageTitle = [...tile.querySelectorAll('img[alt]')].map(image => image.alt.trim()).find(Boolean);
    if (imageTitle) return imageTitle;

    const label = tile
        .getAttribute('aria-label')
        ?.replace(/[\u2066-\u2069]/g, '')
        .trim();
    const detailsSuffix = 'Select for details on this title.';
    if (!label || /^(?:LIVE|Upcoming)\b/iu.test(label) || !label.endsWith(detailsSuffix)) return null;

    const content = label
        .slice(0, -detailsSuffix.length)
        .replace(
            /^(?:(?:(?:Subtitles|Dubbing) Available|New (?:Movie|Series|Episode|Season)) Badge|New (?:Episode|Season))\s+/u,
            ''
        )
        .trim();
    const title = content
        .split(
            /\s+(?:Rated\s+\S+|Released\s+\d{4}\b|(?:Disney\+|Hulu) (?:Original(?: Series)?|Generic))(?=[.\s]|$)/u
        )[0]
        ?.replace(/\s+(?:Action and Adventure|Kids and Family)$/u, '')
        .trim();
    return title || null;
}

export const DISNEY_PLUS_SURFACES = Object.freeze({
    SHELF_CARD: Object.freeze({
        titleSelector: 'a[data-testid="set-item"][data-item-id][href*="/browse/entity-"]',
        getTitle: extractDisneyPlusTitle,
        getContainer: containerFromParent,
        fadeable: true,
        showFadeToggle: false,
    }),
    CONTINUE_WATCHING: Object.freeze({
        titleSelector:
            '[data-testid="set-section"][data-set-style="continue_watching"] [data-testid="cw-set-item-wrapper"]',
        getTitle: wrapper => wrapper.querySelector('[data-testid="cw-set-item-metadata"]')?.children[1]?.textContent,
        getContainer: containerFromClosest('[data-testid="set-shelf-item"]'),
        fadeable: true,
        showFadeToggle: false,
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
