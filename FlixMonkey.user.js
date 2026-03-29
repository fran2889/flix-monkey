// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      0.3.0
// @description  Show IMDB ratings on Netflix thumbnails and banners
// @author       fran
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.omdbapi.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ---------------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------------

    const CONFIG = {
        // Your OMDB API key – get one free at https://www.omdbapi.com/apikey.aspx
        omdbApiKey: 'YOUR_OMDB_API_KEY',

        // Which corner to show the rating overlay.
        // Options: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
        overlayCorner: 'top-left',

        // Cache TTL in milliseconds
        cacheTtlRated: 7 * 24 * 60 * 60 * 1000,   // 7 days  – title has a rating
        cacheTtlNoRating: 24 * 60 * 60 * 1000,      // 24 h    – OMDB found title but no rating
        // Titles not found in OMDB are not cached (no result → skip overlay)
    };

    // ---------------------------------------------------------------------------
    // Cache helpers
    // ---------------------------------------------------------------------------

    const CACHE_PREFIX = 'fm_cache_';

    function cacheKey(title, year) {
        return CACHE_PREFIX + title.toLowerCase().replace(/\s+/g, '_') + (year ? `_${year}` : '');
    }

    function readCache(title, year) {
        const stored = GM_getValue(cacheKey(title, year));
        if (!stored) return null;
        try {
            const entry = JSON.parse(stored);
            if (Date.now() > entry.expires) {
                return null; // expired
            }
            return entry.data;
        } catch {
            return null;
        }
    }

    function writeCache(title, year, data, ttl) {
        const entry = { data, expires: Date.now() + ttl };
        GM_setValue(cacheKey(title, year), JSON.stringify(entry));
    }

    // ---------------------------------------------------------------------------
    // OMDB API
    // ---------------------------------------------------------------------------

    /**
     * Fetch OMDB data for a title.
     * Resolves with:
     *   { found: false }                               – OMDB returned no result
     *   { found: true, imdbId, rating: null }          – found but no rating
     *   { found: true, imdbId, rating: '8.3' }         – found with rating
     */
    function fetchOmdb(title, year) {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                apikey: CONFIG.omdbApiKey,
                t: title,
                // No type filter – let OMDB pick its best match by title.
                // Forcing 'movie' first caused false positives when a title
                // exists as both a movie and a series.
                ...(year ? { y: year } : {}),
            });

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://www.omdbapi.com/?${params.toString()}`,
                responseType: 'json',
                onload(resp) {
                    if (resp.status < 200 || resp.status >= 300) {
                        return reject(new Error(`OMDB HTTP ${resp.status}`));
                    }
                    const json = resp.response || JSON.parse(resp.responseText);
                    if (json.Response === 'False') {
                        return resolve({ found: false });
                    }
                    const rating = json.imdbRating && json.imdbRating !== 'N/A'
                        ? json.imdbRating
                        : null;
                    resolve({ found: true, imdbId: json.imdbID, rating });
                },
                onerror() { reject(new Error('OMDB network error')); },
                ontimeout() { reject(new Error('OMDB timeout')); },
                timeout: 8000,
            });
        });
    }

    /**
     * Get OMDB data for a title, using cache where possible.
     */
    async function getOmdbData(title, year) {
        const cached = readCache(title, year);
        if (cached !== null) return cached;

        let data;
        try {
            data = await fetchOmdb(title, year);
        } catch (err) {
            console.warn('[FlixMonkey] OMDB fetch failed:', err.message);
            return null; // network error – don't show overlay, don't cache
        }

        if (!data.found) {
            return null; // no result – don't cache, don't show overlay
        }

        const ttl = data.rating ? CONFIG.cacheTtlRated : CONFIG.cacheTtlNoRating;
        writeCache(title, year, data, ttl);
        return data;
    }

    // ---------------------------------------------------------------------------
    // Overlay rendering
    // ---------------------------------------------------------------------------

    const OVERLAY_CLASS = 'fm-rating-overlay';
    const OVERLAY_ATTR  = 'data-fm-injected';

    const cornerStyles = {
        'top-left':     'top:6px;left:6px;',
        'top-right':    'top:6px;right:6px;',
        'bottom-left':  'bottom:6px;left:6px;',
        'bottom-right': 'bottom:6px;right:6px;',
    };

    const positionCss = cornerStyles[CONFIG.overlayCorner] || cornerStyles['top-left'];

    // Inject a <style> block once
    const style = document.createElement('style');
    style.textContent = `
        .${OVERLAY_CLASS} {
            position: absolute;
            ${positionCss}
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(0,0,0,0.72);
            color: #f5c518;
            font-family: Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            padding: 3px 6px;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            white-space: nowrap;
            pointer-events: all;
            transition: background 0.15s;
        }
        .${OVERLAY_CLASS}:hover {
            background: rgba(0,0,0,0.92);
        }
        .${OVERLAY_CLASS} .fm-label {
            font-size: 10px;
            letter-spacing: 0.03em;
        }
        .${OVERLAY_CLASS} .fm-na {
            color: #aaa;
        }
        .${OVERLAY_CLASS} .fm-search {
            font-size: 11px;
            color: #ccc;
        }
    `;
    document.head.appendChild(style);

    /**
     * Create an overlay anchor element.
     * @param {object} data   – { imdbId, rating }
     * @param {string} title  – display title (used for search fallback URL)
     */
    function createOverlay(data, title) {
        const a = document.createElement('a');
        a.className = OVERLAY_CLASS;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        // Link to the title page when we have an imdbId, otherwise fall back to search
        a.href = data.imdbId
            ? `https://www.imdb.com/title/${data.imdbId}/`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;

        if (data.rating) {
            a.innerHTML = `<span class="fm-label">IMDb</span><span>${data.rating}</span>`;
            a.title = `IMDb rating: ${data.rating} – click to open IMDb`;
        } else if (data.imdbId) {
            a.innerHTML = `<span class="fm-label">IMDb</span><span class="fm-na">N/A</span>`;
            a.title = 'No IMDb rating available – click to open IMDb';
        } else {
            a.innerHTML = `<span class="fm-label">IMDb</span><span class="fm-search">🔍</span>`;
            a.title = 'Not found on IMDb – click to search';
        }

        // Stop the click from triggering Netflix navigation
        a.addEventListener('click', e => e.stopPropagation());

        return a;
    }

    /**
     * Inject (or refresh) the rating overlay on a container element.
     * The container must have position:relative or similar.
     */
    function injectOverlay(container, data, title) {
        // Remove stale overlay if present
        const existing = container.querySelector(`.${OVERLAY_CLASS}`);
        if (existing) existing.remove();

        const overlay = createOverlay(data, title);
        container.appendChild(overlay);
        container.setAttribute(OVERLAY_ATTR, '1');
    }

    // ---------------------------------------------------------------------------
    // Surface discovery  (ported from netflix-surfaces.js in reference build)
    //
    // Rather than scanning for containers and hoping they have a title,
    // we query the known title elements first, then walk up to the container
    // with .closest(). This is the approach used in the reference build and is
    // more resilient to Netflix DOM changes.
    // ---------------------------------------------------------------------------

    /**
     * Each entry describes one surface type:
     *   titleSelectors  – elements that carry the title (img[alt] or text nodes)
     *   getTitle        – extracts the display title from a matched element
     *   containerSel    – .closest() selector to find the overlay container
     *   fallbackContainer – if .closest() misses, use parentElement
     */
    const SURFACES = [
        // Browse cards ─ primary title is .fallback-text inside .title-card
        {
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.title-card',
        },
        // Hover zoom (bob) ─ bob-title text
        {
            titleSelectors: '.bob-title',
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.bob-container',
        },
        // Zoom / More Info modal ─ title treatment image (most reliable)
        {
            titleSelectors: [
                '.previewModal--player-titleTreatmentWrapper img[alt]',
                '.previewModal--wrapper img[alt]',
                '.previewModal img[alt]',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() || null,
            containerSel: '.previewModal',
        },
        // Zoom / More Info modal ─ text fallbacks
        {
            titleSelectors: [
                '[data-uia="previewModal-title"]',
                '.previewModal--boxarttitle',
                '.previewModal h3',
            ].join(','),
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.previewModal',
        },
        // More Info expanded panel (jawBone) ─ image
        {
            titleSelectors: [
                '.jawBone img[alt]',
                '.jawBoneContainer img[alt]',
                '.previewModal--detailsMetadata img[alt]',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() || null,
            containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
        },
        // More Info expanded panel (jawBone) ─ text
        {
            titleSelectors: [
                '.jawBone .image-fallback-text',
                '.jawBoneContainer .image-fallback-text',
                '.previewModal--detailsMetadata h3',
                '.previewModal--detailsMetadata .title',
                '.previewModal--detailsMetadata [data-uia="previewModal-title"]',
            ].join(','),
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
        },
        // Hero billboard ─ title treatment image
        {
            titleSelectors: [
                '.title-logo img[alt]',
                '.logo-and-text img[alt]',
                '[data-uia="billboard"] img[alt]',
                '.billboard img[alt]',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() || null,
            containerSel: '.billboard-row, .billboard-pane, .billboard',
        },
        // Hero billboard ─ text fallbacks
        {
            titleSelectors: [
                '.billboard .fallback-text',
                '.billboard .logo-name',
                '[data-uia="billboard-title"]',
            ].join(','),
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.billboard-row, .billboard-pane, .billboard',
        },
    ];

    /**
     * Discover { container, title } pairs within a root element.
     * Mirrors the netflix-surfaces.js approach: find title elements first,
     * then walk up to the container.
     *
     * @param {Element|Document} root
     * @returns {{ container: Element, title: string }[]}
     */
    function discoverSurfaces(root) {
        const seen = new Set();
        const results = [];

        for (const surface of SURFACES) {
            let titleEls;
            try {
                titleEls = root.querySelectorAll(surface.titleSelectors);
            } catch {
                continue;
            }

            for (const titleEl of titleEls) {
                const title = surface.getTitle(titleEl);
                if (!title) continue;

                const container = titleEl.closest(surface.containerSel) || titleEl.parentElement;
                if (!container || seen.has(container)) continue;

                seen.add(container);
                results.push({ container, title });
            }
        }

        return results;
    }

    /**
     * Attempt to get year from a nearby DOM element (not always present).
     */
    function extractYear(el) {
        const yearEl = el.querySelector('.year, [data-year], .releaseYear');
        if (!yearEl) return null;
        const m = yearEl.textContent.match(/\d{4}/);
        return m ? m[0] : null;
    }

    // ---------------------------------------------------------------------------
    // Core decoration logic
    // ---------------------------------------------------------------------------

    const inFlight = new Set(); // prevent duplicate concurrent requests

    async function decorateContainer(container, title) {
        if (container.hasAttribute(OVERLAY_ATTR)) return;

        // Check cache first – if data is already there we can inject immediately
        // without waiting for a network request, and without blocking on inFlight.
        const year = extractYear(container);
        const cached = readCache(title, year);
        if (cached !== null) {
            const pos = getComputedStyle(container).position;
            if (pos === 'static') container.style.position = 'relative';
            injectOverlay(container, cached, title);
            return;
        }

        // No cache – gate on inFlight to avoid duplicate concurrent requests
        // for the same title (e.g. card + zoom open simultaneously).
        const dedupKey = title.toLowerCase();
        if (inFlight.has(dedupKey)) return;
        inFlight.add(dedupKey);

        try {
            const data = await getOmdbData(title, year);

            const pos = getComputedStyle(container).position;
            if (pos === 'static') container.style.position = 'relative';

            // Always show an overlay – fall back to IMDb search when no result/id
            injectOverlay(container, data || { imdbId: null, rating: null }, title);
        } finally {
            inFlight.delete(dedupKey);
        }
    }

    function decorateRoot(root) {
        for (const { container, title } of discoverSurfaces(root)) {
            decorateContainer(container, title);
        }
    }

    function decorateAllVisible() {
        decorateRoot(document);
    }

    // ---------------------------------------------------------------------------
    // SPA navigation + DOM mutation observer
    // ---------------------------------------------------------------------------

    // Intercept History API pushes (Netflix is a SPA)
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    function onNavigation() {
        // Give Netflix time to render the new route
        setTimeout(decorateAllVisible, 800);
    }

    history.pushState = function (...args) {
        _pushState.apply(this, args);
        onNavigation();
    };
    history.replaceState = function (...args) {
        _replaceState.apply(this, args);
        onNavigation();
    };
    window.addEventListener('popstate', onNavigation);

    // Watch for dynamically added nodes — run discovery on each added subtree
    // rather than re-scanning the whole document on every mutation.
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    decorateRoot(node);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial pass
    decorateAllVisible();

})();
