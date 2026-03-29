// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      0.8.0
// @description  Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners
// @author       fran
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.omdbapi.com
// @connect      www.imdb.com
// @connect      v3.sg.media-imdb.com
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

        // Toggle individual rating sources
        showRtRating: true, // Rotten Tomatoes
        showMcRating: true, // Metacritic

        // Keyboard shortcut to wipe all cached ratings (useful after API key change etc.)
        // Format: modifier(s) joined by '+' then the key, e.g. 'Alt+Shift+C'
        clearCacheShortcut: 'Alt+Shift+C',

        // Cache TTL in milliseconds
        cacheTtlRated: 7 * 24 * 60 * 60 * 1000, // 7 days – title has a rating
        cacheTtlNoRating: 24 * 60 * 60 * 1000, //  24 h   – OMDB found title but no rating
        // Titles not found in OMDB are not cached
    };

    // ---------------------------------------------------------------------------
    // Cache helpers
    // ---------------------------------------------------------------------------

    const CACHE_KEY = 'fm_cache';

    function cacheKey(title, year) {
        return title.toLowerCase().replace(/\s+/g, '_') + (year ? `_${year}` : '');
    }

    /** Load the whole cache blob from GM storage, returning {} on missing/corrupt data. */
    function loadBlob() {
        try {
            return JSON.parse(GM_getValue(CACHE_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function readCache(title, year) {
        const entry = loadBlob()[cacheKey(title, year)];
        if (!entry) return null;
        return Date.now() > entry.expires ? null : entry.data;
    }

    function writeCache(title, year, data, ttl) {
        const blob = loadBlob();
        const now = Date.now();
        // Prune expired entries on every write to keep the blob lean
        for (const k of Object.keys(blob)) {
            if (now > blob[k].expires) delete blob[k];
        }
        blob[cacheKey(title, year)] = { data, expires: now + ttl };
        GM_setValue(CACHE_KEY, JSON.stringify(blob));
    }

    // ---------------------------------------------------------------------------
    // OMDB API
    // ---------------------------------------------------------------------------

    /** Wrap GM_xmlhttpRequest in a Promise that resolves with parsed JSON or text. */
    function gmFetch(url, responseType = 'json') {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        ];
        const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                headers: {
                    'User-Agent': ua,
                    Referer: 'https://www.imdb.com/',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                onload: r => {
                    if (r.status >= 200 && r.status < 300) {
                        if (responseType === 'json') {
                            resolve(r.response ?? JSON.parse(r.responseText));
                        } else {
                            resolve(r.responseText);
                        }
                    } else {
                        reject(new Error(`HTTP ${r.status}`));
                    }
                },
                onerror: () => reject(new Error('network error')),
                ontimeout: () => reject(new Error('timeout')),
                timeout: 8000,
            });
        });
    }

    /**
     * Fetch OMDB data for a title. Returns { imdbId, rating, rtRating, mcRating } on success,
     * null if not found. No type filter – letting OMDB pick its best match avoids false positives
     * when a title exists as both a movie and a series.
     */
    async function fetchOmdb(title, year) {
        const params = new URLSearchParams({ apikey: CONFIG.omdbApiKey, t: title });
        if (year) params.set('y', year);
        const json = await gmFetch(`https://www.omdbapi.com/?${params}`);
        if (json.Response === 'False') return null;

        const rating = json.imdbRating && json.imdbRating !== 'N/A' ? json.imdbRating : null;

        const ratingsArr = Array.isArray(json.Ratings) ? json.Ratings : [];
        const rtEntry = ratingsArr.find(r => r.Source === 'Rotten Tomatoes');
        const mcEntry = ratingsArr.find(r => r.Source === 'Metacritic');

        const rtRating = rtEntry && rtEntry.Value !== 'N/A' ? rtEntry.Value : null;

        let mcRating = null;
        if (mcEntry && mcEntry.Value !== 'N/A') {
            const m = mcEntry.Value.match(/^(\d+)\//);
            mcRating = m ? `${m[1]}%` : null;
        }

        return { imdbId: json.imdbID, rating, rtRating, mcRating };
    }

    /**
     * Scrape IMDb rating by searching for the title and parsing the resulting title page.
     * Returns { imdbId, rating, rtRating, mcRating } on success, null otherwise.
     */
    async function fetchImdbScrape(title, year) {
        const query = (year ? `${title} ${year}` : title).toLowerCase();
        const firstChar = query[0] || 'x';
        const suggestUrl = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(query)}.json`;

        let imdbId = null;
        try {
            const suggestJson = await gmFetch(suggestUrl, 'json');
            if (suggestJson && Array.isArray(suggestJson.d)) {
                // Find the first entry that looks like a title (tt...)
                const match = suggestJson.d.find(entry => entry.id && entry.id.startsWith('tt'));
                if (match) {
                    imdbId = match.id;
                }
            }
        } catch (e) {
            console.warn('[FlixMonkey] Suggestions API failed:', e.message);
        }

        if (!imdbId) return null;

        // Random delay (1s to 2.5s) to be nicer to IMDb
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

        const titleUrl = `https://www.imdb.com/title/${imdbId}/`;
        const titleHtml = await gmFetch(titleUrl, 'text');

        let rating = null;

        // Try extracting from all JSON-LD blocks
        const jsonLdBlocks = titleHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
        if (jsonLdBlocks) {
            for (const block of jsonLdBlocks) {
                try {
                    const content = block.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
                    const data = JSON.parse(content);
                    const extract = d => {
                        if (d.aggregateRating) return d.aggregateRating.ratingValue;
                        if (Array.isArray(d)) {
                            const found = d.find(o => o.aggregateRating);
                            return found ? found.aggregateRating.ratingValue : null;
                        }
                        return null;
                    };
                    const val = extract(data);
                    if (val) {
                        rating = val.toString();
                        break;
                    }
                } catch {
                    /* ignore */
                }
            }
        }

        // Fallback: search for rating in data-testid with a more flexible regex
        if (!rating) {
            // Updated regex to handle more variations and capture rating even if nested deeply
            const rMatch = titleHtml.match(
                /data-testid="hero-rating-bar__aggregate-rating__score"[^>]*>[\s\S]*?<span[^>]*>([\d.]+)<\/span>/
            );
            if (rMatch) rating = rMatch[1];
        }

        return { imdbId, rating, rtRating: null, mcRating: null };
    }

    function formatRating(val) {
        if (!val || val === 'N/A') return null;
        const num = parseFloat(val);
        return isNaN(num) ? val : num.toFixed(1);
    }

    /** Get OMDB data for a title, using cache where possible. Returns null on no-result or network error. */
    async function getOmdbData(title, year) {
        const cached = readCache(title, year);
        if (cached !== null) return cached;

        let data = null;
        const isOmdbConfigured = CONFIG.omdbApiKey && CONFIG.omdbApiKey !== 'YOUR_OMDB_API_KEY';

        if (isOmdbConfigured) {
            try {
                data = await fetchOmdb(title, year);
            } catch (err) {
                console.warn('[FlixMonkey] OMDB fetch failed:', err.message);
            }
        }

        // Fallback to scraping if OMDB didn't give us a rating (or wasn't configured)
        if (!data || !data.rating) {
            try {
                const scraped = await fetchImdbScrape(title, year);
                if (scraped) {
                    if (data) {
                        // Merge scraped data if we already had something (like RT/MC ratings)
                        data.imdbId = scraped.imdbId || data.imdbId;
                        data.rating = scraped.rating || data.rating;
                    } else {
                        data = scraped;
                    }
                }
            } catch (err) {
                console.warn('[FlixMonkey] IMDb scrape failed:', err.message);
            }
        }

        if (!data) return null; // not found anywhere – don't cache

        // Ensure rating is always formatted as a decimal (e.g. 7.0 instead of 7)
        if (data.rating) {
            data.rating = formatRating(data.rating);
        }

        writeCache(
            title,
            year,
            data,
            data.rating || data.rtRating || data.mcRating ? CONFIG.cacheTtlRated : CONFIG.cacheTtlNoRating
        );
        return data;
    }

    // ---------------------------------------------------------------------------
    // Overlay rendering
    // ---------------------------------------------------------------------------

    const OVERLAY_CLASS = 'fm-rating-overlay';
    const OVERLAY_ATTR = 'data-fm-injected';

    const cornerStyles = {
        'top-left': 'top:6px;left:6px;',
        'top-right': 'top:6px;right:6px;',
        'bottom-left': 'bottom:6px;left:6px;',
        'bottom-right': 'bottom:6px;right:6px;',
    };

    const positionCss = cornerStyles[CONFIG.overlayCorner] || cornerStyles['top-left'];

    const style = document.createElement('style');
    style.textContent = `
        .${OVERLAY_CLASS} {
            position: absolute;
            ${positionCss}
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 3px;
            background: rgba(0,0,0,0.72);
            font-family: Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            white-space: nowrap;
            pointer-events: all;
            transition: background 0.15s;
        }
        .${OVERLAY_CLASS}:hover { background: rgba(0,0,0,0.92); }
        .${OVERLAY_CLASS} .fm-row { display: flex; align-items: center; gap: 4px; }
        .${OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; color: #f5c518; }
        .${OVERLAY_CLASS} .fm-rt { color: #fa320a; }
        .${OVERLAY_CLASS} .fm-mc { color: #6ac; }
        .${OVERLAY_CLASS} .fm-value { color: #fff; }
        .${OVERLAY_CLASS} .fm-na { color: #aaa; }
        .${OVERLAY_CLASS} .fm-search { font-size: 11px; color: #ccc; }
    `;

    // Top 10 cards (.title-card-top-10): the rank number SVG sits in the left 50% of the
    // card and the thumbnail image sits in the right 50%.  For left-side corners the badge
    // must be shifted past the rank area; right-side corners already land on the thumbnail.
    if (CONFIG.overlayCorner.includes('left')) {
        style.textContent += `\n        .title-card-top-10 .${OVERLAY_CLASS} { left: calc(50% + 6px); }`;
    }

    document.head.appendChild(style);

    function createOverlay(data, title) {
        const a = document.createElement('a');
        a.className = OVERLAY_CLASS;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = data.imdbId
            ? `https://www.imdb.com/title/${data.imdbId}/`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;

        const rows = [];
        const titleParts = [];

        // IMDb row – always shown
        if (data.rating) {
            rows.push(
                `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-value">${data.rating}</span></div>`
            );
            titleParts.push(`IMDb: ${data.rating}`);
        } else if (data.imdbId) {
            rows.push(`<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-na">N/A</span></div>`);
        } else {
            rows.push(`<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-search">🔍</span></div>`);
        }

        // Rotten Tomatoes row – only when available
        if (CONFIG.showRtRating && data.rtRating) {
            rows.push(
                `<div class="fm-row"><span class="fm-label fm-rt">RT</span><span class="fm-value">${data.rtRating}</span></div>`
            );
            titleParts.push(`RT: ${data.rtRating}`);
        }

        // Metacritic row – only when available
        if (CONFIG.showMcRating && data.mcRating) {
            rows.push(
                `<div class="fm-row"><span class="fm-label fm-mc">MC</span><span class="fm-value">${data.mcRating}</span></div>`
            );
            titleParts.push(`MC: ${data.mcRating}`);
        }

        a.innerHTML = rows.join('');
        a.title = titleParts.length
            ? `${titleParts.join(' · ')} – click to open IMDb`
            : data.imdbId
              ? 'No ratings available – click to open IMDb'
              : 'Not found on IMDb – click to search';

        a.addEventListener('click', e => e.stopPropagation());
        return a;
    }

    function ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    function injectOverlay(container, data, title) {
        container.querySelector(`.${OVERLAY_CLASS}`)?.remove();
        container.appendChild(createOverlay(data, title));
        container.setAttribute(OVERLAY_ATTR, '1');
    }

    // ---------------------------------------------------------------------------
    // Surface discovery
    // ---------------------------------------------------------------------------

    /**
     * Each entry describes one Netflix UI surface:
     *   titleSelectors – CSS selectors for elements that carry the title (img[alt] or text nodes)
     *   getTitle       – extracts the display title from a matched element
     *   containerSel   – .closest() selector to reach the overlay container
     */
    const SURFACES = [
        // Browse cards (includes Top 10 cards, which also carry .title-card-top-10;
        // their badge position is corrected by the CSS override above)
        {
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.title-card',
        },
        // Hover zoom (bob)
        {
            titleSelectors: '.bob-title',
            getTitle: el => el.textContent?.trim() || null,
            containerSel: '.bob-container',
        },
        // Preview modal – image title treatment + text fallbacks
        {
            titleSelectors: [
                '.previewModal--player-titleTreatmentWrapper img[alt]',
                '.previewModal--wrapper img[alt]',
                '.previewModal img[alt]',
                '[data-uia="previewModal-title"]',
                '.previewModal--boxarttitle',
                '.previewModal h3',
            ].join(','),
            getTitle: el => el.getAttribute('alt')?.trim() || el.textContent?.trim() || null,
            containerSel: '.previewModal',
        },
        // jawBone / expanded info panel – image + text fallbacks
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
            getTitle: el => el.getAttribute('alt')?.trim() || el.textContent?.trim() || null,
            containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
        },
    ];

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

    function extractYear(el) {
        const yearEl = el.querySelector('.year, [data-year], .releaseYear');
        if (!yearEl) return null;
        const m = yearEl.textContent.match(/\d{4}/);
        return m ? m[0] : null;
    }

    // ---------------------------------------------------------------------------
    // Core decoration logic
    // ---------------------------------------------------------------------------

    const inFlight = new Map(); // title key → in-flight Promise<data>

    async function decorateContainer(container, title) {
        if (container.hasAttribute(OVERLAY_ATTR)) return;

        const year = extractYear(container);
        const cached = readCache(title, year);
        if (cached !== null) {
            ensureRelative(container);
            injectOverlay(container, cached, title);
            return;
        }

        // Share a single in-flight request across all containers for the same title
        const dedupKey = title.toLowerCase();
        let promise = inFlight.get(dedupKey);
        if (!promise) {
            promise = getOmdbData(title, year).finally(() => inFlight.delete(dedupKey));
            inFlight.set(dedupKey, promise);
        }

        const data = await promise;
        ensureRelative(container);
        injectOverlay(container, data || { imdbId: null, rating: null }, title);
    }

    function decorateRoot(root) {
        for (const { container, title } of discoverSurfaces(root)) {
            decorateContainer(container, title);
        }
    }

    // ---------------------------------------------------------------------------
    // Cache management
    // ---------------------------------------------------------------------------

    function clearCache() {
        const count = Object.keys(loadBlob()).length;
        GM_setValue(CACHE_KEY, '{}');
        console.warn(`[FlixMonkey] Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
    }

    document.addEventListener('keydown', e => {
        const parts = CONFIG.clearCacheShortcut.split('+');
        const key = parts[parts.length - 1];
        if (
            e.key === key &&
            e.altKey === parts.includes('Alt') &&
            e.shiftKey === parts.includes('Shift') &&
            e.ctrlKey === (parts.includes('Ctrl') || parts.includes('Control')) &&
            e.metaKey === parts.includes('Meta')
        ) {
            clearCache();
        }
    });

    // ---------------------------------------------------------------------------
    // SPA navigation + DOM mutation observer
    // ---------------------------------------------------------------------------

    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    history.pushState = function (...args) {
        _pushState.apply(this, args);
        setTimeout(() => decorateRoot(document), 800);
    };
    history.replaceState = function (...args) {
        _replaceState.apply(this, args);
        setTimeout(() => decorateRoot(document), 800);
    };
    window.addEventListener('popstate', () => setTimeout(() => decorateRoot(document), 800));

    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) decorateRoot(node);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    decorateRoot(document);
})();
