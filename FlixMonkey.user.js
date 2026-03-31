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
// @connect      xmdbapi.com
// @connect      api.imdbapi.dev
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ---------------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------------

    const CONFIG = {
        // Your XMDB API key – get one free at https://xmdbapi.com/api-key
        xmdbApiKey: 'YOUR_XMDB_API_KEY',

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

        // Comma separated list of API clients to use, in fallback order.
        apiClients: 'xmdb,omdb,imdbapi,imdb',
    };

    // ---------------------------------------------------------------------------
    // Cache management
    // ---------------------------------------------------------------------------

    class CacheManager {
        #cacheKey = 'fm_cache';

        #getKey(title, year) {
            return `${title.toLowerCase().replace(/\s+/g, '_')}${year ? `_${year}` : ''}`;
        }

        #loadBlob() {
            try {
                return JSON.parse(GM_getValue(this.#cacheKey) ?? '{}');
            } catch {
                return {};
            }
        }

        read(title, year) {
            const entry = this.#loadBlob()[this.#getKey(title, year)];
            if (!entry) return null;
            return Date.now() > entry.expires ? null : entry.data;
        }

        write(title, year, data, ttl) {
            const blob = this.#loadBlob();
            const now = Date.now();
            Object.keys(blob).forEach(k => {
                if (now > blob[k].expires) delete blob[k];
            });
            blob[this.#getKey(title, year)] = { data, expires: now + ttl };
            GM_setValue(this.#cacheKey, JSON.stringify(blob));
        }

        clear() {
            const count = Object.keys(this.#loadBlob()).length;
            GM_setValue(this.#cacheKey, '{}');
            console.warn(`[FlixMonkey] Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
        }
    }

    // ---------------------------------------------------------------------------
    // Helpers & Utilities
    // ---------------------------------------------------------------------------

    class RatingUtils {
        static format(val) {
            if (!val || val === 'N/A') return null;
            const num = parseFloat(val);
            return isNaN(num) ? val : num.toFixed(1);
        }

        static normalizeMc(val) {
            if (!val || val === 'N/A') return null;
            const m = String(val).match(/^(\d+)/);
            return m ? `${m[1]}%` : null;
        }

        static normalizeRt(val) {
            return val === 'N/A' ? null : (val ?? null);
        }

        static findInRatings(ratings, sourcePattern) {
            if (!Array.isArray(ratings)) return null;
            const entry = ratings.find(r => sourcePattern.test(r.source || r.Source));
            return entry?.value || entry?.Value || null;
        }
    }

    class RequestQueue {
        #queue = [];
        #isProcessing = false;
        #lastLocalReqTime = 0;
        #minInterval;
        #globalSyncKey;

        constructor(minInterval = 1000, globalSyncKey = null) {
            this.#minInterval = minInterval;
            this.#globalSyncKey = globalSyncKey;
        }

        enqueue(url, priority, fetchFn, responseType) {
            return new Promise((resolve, reject) => {
                this.#queue.push({ url, priority, resolve, reject, fetchFn, responseType });
                this.#process();
            });
        }

        async #process() {
            if (this.#isProcessing) return;
            this.#isProcessing = true;

            while (this.#queue.length > 0) {
                this.#queue.sort((a, b) => b.priority - a.priority);

                const now = Date.now();
                let lastGlobal = 0;
                if (this.#globalSyncKey) {
                    const str = GM_getValue(this.#globalSyncKey);
                    lastGlobal = str ? parseInt(str, 10) : 0;
                }

                const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
                if (wait > 0) {
                    await new Promise(r => setTimeout(r, wait + Math.random() * 50));
                    continue;
                }

                this.#lastLocalReqTime = Date.now();
                if (this.#globalSyncKey) {
                    GM_setValue(this.#globalSyncKey, this.#lastLocalReqTime.toString());
                }

                const { url, resolve, reject, fetchFn, responseType } = this.#queue.shift();
                try {
                    const result = await fetchFn(url, responseType);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            }
            this.#isProcessing = false;
        }
    }

    // ---------------------------------------------------------------------------
    // OMDB / IMDb API Client
    // ---------------------------------------------------------------------------

    class BaseApiClient {
        #queue;

        constructor(queue) {
            this.#queue = queue;
        }

        gmFetch(url, responseType = 'json') {
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
                        const { status, response, responseText } = r;
                        if (status >= 200 && status < 300) {
                            if (responseType === 'json') {
                                resolve(response ?? JSON.parse(responseText));
                            } else {
                                resolve(responseText);
                            }
                        } else {
                            reject(new Error(`HTTP ${status}`));
                        }
                    },
                    onerror: () => reject(new Error('network error')),
                    ontimeout: () => reject(new Error('timeout')),
                    timeout: 8000,
                });
            });
        }

        queuedFetch(url, priority = 0, responseType = 'json') {
            return this.#queue.enqueue(url, priority, (u, resType) => this.gmFetch(u, resType), responseType);
        }

        async fetch(title, year) {
            try {
                const match = await this.search(title, year);
                if (!match) return null;
                return await this.getDetails(match, title);
            } catch (err) {
                console.warn(`[FlixMonkey] ${this.constructor.name} failed: ${err.message}`);
                return null;
            }
        }

        async search(_title, _year) {
            throw new Error('Not implemented');
        }

        async getDetails(_id, _title) {
            throw new Error('Not implemented');
        }
    }

    class XmdbApiClient extends BaseApiClient {
        constructor() {
            // XMDB has a global rate limit shared across tabs
            super(new RequestQueue(1500, 'fm_last_req'));
        }

        async search(title, year) {
            if (!CONFIG.xmdbApiKey || CONFIG.xmdbApiKey === 'YOUR_XMDB_API_KEY') return null;

            const searchParams = new URLSearchParams({ apiKey: CONFIG.xmdbApiKey, q: title, limit: 5 });
            console.warn(`[FlixMonkey] Searching XMDB for title: "${title}"${year ? ` (${year})` : ''}`);

            const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);

            if (!results?.length) {
                console.warn(`[FlixMonkey] No search results found in XMDB for: "${title}"`);
                return null;
            }

            const titleResults = results.filter(r => r.type === 'title');

            if (!titleResults.length) {
                console.warn(`[FlixMonkey] No title matches found in search results for: "${title}"`);
                return null;
            }

            return year
                ? (titleResults.find(r => String(r.year) === String(year)) ?? titleResults[0])
                : titleResults[0];
        }

        async getDetails({ id }, title) {
            console.warn(`[FlixMonkey] Fetching XMDB details for ID: ${id} ("${title}")`);

            const detailsJson = await this.queuedFetch(
                `https://xmdbapi.com/api/v1/movies/${id}?apiKey=${CONFIG.xmdbApiKey}`,
                1
            );

            if (!detailsJson || detailsJson.error) return null;

            const { rating, ratings } = detailsJson;

            return {
                imdbId: id,
                rating: RatingUtils.format(rating),
                rtRating: RatingUtils.normalizeRt(RatingUtils.findInRatings(ratings, /Rotten Tomatoes/i)),
                mcRating: RatingUtils.normalizeMc(RatingUtils.findInRatings(ratings, /Metacritic/i)),
            };
        }
    }

    class OmdbApiClient extends BaseApiClient {
        constructor() {
            // OMDB is usually fast, no global sync needed by default
            super(new RequestQueue(0));
        }

        async search(title, year) {
            if (!CONFIG.omdbApiKey || CONFIG.omdbApiKey === 'YOUR_OMDB_API_KEY') return null;
            return { id: { title, year } };
        }

        async getDetails({ id: { title: t, year: y } }, _title) {
            const params = new URLSearchParams({ apikey: CONFIG.omdbApiKey, t: t });
            if (y) params.set('y', y);

            console.warn(`[FlixMonkey] Fetching OMDB details for: "${t}"${y ? ` (${y})` : ''}`);

            const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);

            if (json.Response === 'False') {
                console.warn(`[FlixMonkey] No search results found in OMDB for: "${t}"`);
                return null;
            }

            const { imdbRating, Ratings, imdbID } = json;

            return {
                imdbId: imdbID,
                rating: RatingUtils.format(imdbRating),
                rtRating: RatingUtils.normalizeRt(RatingUtils.findInRatings(Ratings, /Rotten Tomatoes/i)),
                mcRating: RatingUtils.normalizeMc(RatingUtils.findInRatings(Ratings, /Metacritic/i)),
            };
        }
    }

    class ImdbApiDevClient extends BaseApiClient {
        constructor() {
            super(new RequestQueue(1000));
        }

        async search(title, year) {
            const searchParams = new URLSearchParams({ query: title });
            console.warn(`[FlixMonkey] Searching IMDB API Dev for title: "${title}"${year ? ` (${year})` : ''}`);

            const { titles } = await this.queuedFetch(`https://api.imdbapi.dev/search/titles?${searchParams}`, 0);

            if (!titles?.length) {
                console.warn(`[FlixMonkey] No search results found in IMDB API Dev for: "${title}"`);
                return null;
            }

            if (year) {
                const targetYear = parseInt(year);
                const nearYear = titles.find(t => Math.abs(t.startYear - targetYear) <= 1);
                if (nearYear) return nearYear;
            }

            return titles[0];
        }

        async getDetails(match, title) {
            const { id: titleId } = match;
            console.warn(`[FlixMonkey] Fetching IMDB API Dev details for ID: ${titleId} ("${match.title || title}")`);

            let details = null;
            try {
                details = await this.queuedFetch(`https://api.imdbapi.dev/titles/${titleId}`, 1);
            } catch (e) {
                console.warn(`[FlixMonkey] IMDB API Dev details fetch failed for ${titleId}:`, e.message);
            }

            const source = details ?? match;

            return {
                imdbId: source.id,
                rating: RatingUtils.format(source.rating?.aggregateRating),
                rtRating: null,
                mcRating: source.metacritic?.score ? `${source.metacritic.score}%` : null,
            };
        }
    }

    class ImdbApiClient extends BaseApiClient {
        constructor() {
            super(new RequestQueue(1500));
        }

        async search(title, year) {
            const query = (year ? `${title} ${year}` : title).toLowerCase();
            const firstChar = query[0] || 'x';
            const suggestUrl = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(query)}.json`;

            console.warn(
                `[FlixMonkey] Searching IMDb via suggestions for title: "${title}"${year ? ` (${year})` : ''}`
            );

            const suggestJson = await this.queuedFetch(suggestUrl, 0);

            if (!Array.isArray(suggestJson?.d)) {
                console.warn(`[FlixMonkey] No search results found in IMDb suggestions for: "${title}"`);
                return null;
            }

            const match = suggestJson.d.find(({ id }) => id?.startsWith('tt'));

            if (!match) {
                console.warn(`[FlixMonkey] No title matches found in suggestions for: "${title}"`);
                return null;
            }

            return match;
        }

        async getDetails({ id: imdbId }, title) {
            console.warn(`[FlixMonkey] Scraping IMDb details for ID: ${imdbId} ("${title}")`);

            const titleUrl = `https://www.imdb.com/title/${imdbId}/`;
            const titleHtml = await this.queuedFetch(titleUrl, 1, 'text');

            let rating = null;
            const jsonLdBlocks = titleHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);

            if (jsonLdBlocks) {
                for (const block of jsonLdBlocks) {
                    try {
                        const content = block.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
                        const data = JSON.parse(content);
                        const items = Array.isArray(data) ? data : [data];
                        const val = items.find(d => d.aggregateRating)?.aggregateRating?.ratingValue;
                        if (val) {
                            rating = val.toString();
                            break;
                        }
                    } catch {
                        /* ignore */
                    }
                }
            }

            if (!rating) {
                const rMatch = titleHtml.match(
                    /data-testid="hero-rating-bar__aggregate-rating__score"[^>]*>[\s\S]*?<span[^>]*>([\d.]+)<\/span>/
                );
                if (rMatch) rating = rMatch[1];
            }

            const formattedRating = RatingUtils.format(rating);
            if (!formattedRating) {
                console.warn(`[FlixMonkey] No rating found on IMDb for ID: ${imdbId}`);
            }
            return { imdbId, rating: formattedRating, rtRating: null, mcRating: null };
        }
    }

    class ApiClientManager {
        #cache;
        #clients = [];

        constructor(cacheManager, clients = []) {
            this.#cache = cacheManager;
            this.#clients = clients;

            if (this.#clients.length === 0) {
                const configuredClients = (CONFIG.apiClients ?? 'xmdb,omdb,imdbapi,imdb')
                    .split(',')
                    .map(c => c.trim().toLowerCase());

                const clientMap = {
                    xmdb: XmdbApiClient,
                    omdb: OmdbApiClient,
                    imdbapi: ImdbApiDevClient,
                    imdb: ImdbApiClient,
                };

                configuredClients.forEach(name => {
                    if (clientMap[name]) this.#clients.push(new clientMap[name]());
                });
            }
        }

        async getData(title, year) {
            const cached = this.#cache.read(title, year);
            if (cached !== null) return cached;

            let bestData = null;

            for (const client of this.#clients) {
                const data = await client.fetch(title, year);
                if (data?.rating) {
                    bestData = data;
                    break;
                }
            }

            if (!bestData) {
                console.warn(
                    `[FlixMonkey] Total failure: No ratings found for "${title}"${year ? ` (${year})` : ''} using any configured client.`
                );
                return null;
            }

            this.#cache.write(
                title,
                year,
                bestData,
                bestData.rating || bestData.rtRating || bestData.mcRating
                    ? CONFIG.cacheTtlRated
                    : CONFIG.cacheTtlNoRating
            );
            return bestData;
        }
    }

    // ---------------------------------------------------------------------------
    // Overlay Rendering
    // ---------------------------------------------------------------------------

    class OverlayRenderer {
        #OVERLAY_CLASS = 'fm-rating-overlay';
        #OVERLAY_ATTR = 'data-fm-injected';

        injectStyles() {
            const cornerStyles = {
                'top-left': 'top:6px;left:6px;',
                'top-right': 'top:6px;right:6px;',
                'bottom-left': 'bottom:6px;left:6px;',
                'bottom-right': 'bottom:6px;right:6px;',
            };

            const positionCss = cornerStyles[CONFIG.overlayCorner] ?? cornerStyles['top-left'];

            const style = document.createElement('style');
            style.textContent = `
                .${this.#OVERLAY_CLASS} {
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
                .${this.#OVERLAY_CLASS}:hover { background: rgba(0,0,0,0.92); }
                .${this.#OVERLAY_CLASS} .fm-row { display: flex; align-items: center; gap: 4px; }
                .${this.#OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; color: #f5c518; }
                .${this.#OVERLAY_CLASS} .fm-rt { color: #fa320a; }
                .${this.#OVERLAY_CLASS} .fm-mc { color: #6ac; }
                .${this.#OVERLAY_CLASS} .fm-value { color: #fff; }
                .${this.#OVERLAY_CLASS} .fm-na { color: #aaa; }
                .${this.#OVERLAY_CLASS} .fm-search { font-size: 11px; color: #ccc; }
            `;

            if (CONFIG.overlayCorner.includes('left')) {
                style.textContent += `\n                .title-card-top-10 .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
            }

            document.head.appendChild(style);
        }

        #createOverlay(data, title) {
            const a = document.createElement('a');
            a.className = this.#OVERLAY_CLASS;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.href = data.imdbId
                ? `https://www.imdb.com/title/${data.imdbId}/`
                : `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;

            const rows = [];
            const titleParts = [];

            const { rating, imdbId, rtRating, mcRating } = data;

            if (rating) {
                rows.push(
                    `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-value">${rating}</span></div>`
                );
                titleParts.push(`IMDb: ${rating}`);
            } else if (imdbId) {
                rows.push(`<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-na">N/A</span></div>`);
            } else {
                rows.push(
                    `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-search">🔍</span></div>`
                );
            }

            if (CONFIG.showRtRating && rtRating) {
                rows.push(
                    `<div class="fm-row"><span class="fm-label fm-rt">RT</span><span class="fm-value">${rtRating}</span></div>`
                );
                titleParts.push(`RT: ${rtRating}`);
            }

            if (CONFIG.showMcRating && mcRating) {
                rows.push(
                    `<div class="fm-row"><span class="fm-label fm-mc">MC</span><span class="fm-value">${mcRating}</span></div>`
                );
                titleParts.push(`MC: ${mcRating}`);
            }

            a.innerHTML = rows.join('');
            a.title = titleParts.length
                ? `${titleParts.join(' · ')} – click to open IMDb`
                : imdbId
                  ? 'No ratings available – click to open IMDb'
                  : 'Not found on IMDb – click to search';

            a.addEventListener('click', e => e.stopPropagation());
            return a;
        }

        ensureRelative(container) {
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        }

        injectOverlay(container, data, title) {
            container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
            container.appendChild(this.#createOverlay(data, title));
            container.setAttribute(this.#OVERLAY_ATTR, '1');
        }

        hasOverlay(container) {
            return container.hasAttribute(this.#OVERLAY_ATTR);
        }
    }

    // ---------------------------------------------------------------------------
    // Surface Discovery
    // ---------------------------------------------------------------------------

    class SurfaceManager {
        #SURFACES = [
            {
                titleSelectors: '.title-card .fallback-text',
                getTitle: el => el.textContent?.trim() ?? null,
                containerSel: '.title-card',
            },
            {
                titleSelectors: '.bob-title',
                getTitle: el => el.textContent?.trim() ?? null,
                containerSel: '.bob-container',
            },
            {
                titleSelectors: [
                    '.previewModal--player-titleTreatmentWrapper img[alt]',
                    '.previewModal--wrapper img[alt]',
                    '.previewModal img[alt]',
                    '[data-uia="previewModal-title"]',
                    '.previewModal--boxarttitle',
                    '.previewModal h3',
                ].join(','),
                getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
                containerSel: '.previewModal',
            },
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
                getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
                containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
            },
        ];

        discover(root) {
            const seen = new Set();
            const results = [];

            this.#SURFACES.forEach(surface => {
                let titleEls;
                try {
                    titleEls = root.querySelectorAll(surface.titleSelectors);
                } catch {
                    return;
                }

                titleEls.forEach(titleEl => {
                    const title = surface.getTitle(titleEl);
                    if (!title) return;

                    const container = titleEl.closest(surface.containerSel) ?? titleEl.parentElement;
                    if (!container || seen.has(container)) return;

                    seen.add(container);
                    results.push({ container, title });
                });
            });

            return results;
        }

        extractYear(el) {
            const yearEl = el.querySelector('.year, [data-year], .releaseYear');
            if (!yearEl) return null;
            const m = yearEl.textContent.match(/\d{4}/);
            return m?.[0] ?? null;
        }
    }

    // ---------------------------------------------------------------------------
    // App orchestration
    // ---------------------------------------------------------------------------

    class FlixMonkeyApp {
        #cache;
        #api;
        #renderer;
        #surfaces;
        #inFlight = new Map();

        constructor(cache, api, renderer, surfaces) {
            this.#cache = cache;
            this.#api = api;
            this.#renderer = renderer;
            this.#surfaces = surfaces;
        }

        async #decorateContainer(container, title) {
            if (this.#renderer.hasOverlay(container)) return;

            const year = this.#surfaces.extractYear(container);
            const cached = this.#cache.read(title, year);
            if (cached !== null) {
                this.#renderer.ensureRelative(container);
                this.#renderer.injectOverlay(container, cached, title);
                return;
            }

            const dedupKey = title.toLowerCase();
            let promise = this.#inFlight.get(dedupKey);
            if (!promise) {
                promise = this.#api.getData(title, year).finally(() => this.#inFlight.delete(dedupKey));
                this.#inFlight.set(dedupKey, promise);
            }

            const data = await promise;
            this.#renderer.ensureRelative(container);
            this.#renderer.injectOverlay(container, data ?? { imdbId: null, rating: null }, title);
        }

        decorateRoot(root) {
            this.#surfaces.discover(root).forEach(({ container, title }) => {
                this.#decorateContainer(container, title);
            });
        }

        #initCacheShortcut() {
            document.addEventListener('keydown', e => {
                const parts = CONFIG.clearCacheShortcut.split('+');
                const key = parts.at(-1);

                const match =
                    e.key === key &&
                    e.altKey === parts.includes('Alt') &&
                    e.shiftKey === parts.includes('Shift') &&
                    e.ctrlKey === (parts.includes('Ctrl') || parts.includes('Control')) &&
                    e.metaKey === parts.includes('Meta');

                if (match) this.#cache.clear();
            });
        }

        #initNavigationObservers() {
            const { pushState, replaceState } = history;

            history.pushState = (...args) => {
                pushState.apply(history, args);
                setTimeout(() => this.decorateRoot(document), 800);
            };
            history.replaceState = (...args) => {
                replaceState.apply(history, args);
                setTimeout(() => this.decorateRoot(document), 800);
            };
            window.addEventListener('popstate', () => setTimeout(() => this.decorateRoot(document), 800));

            const observer = new MutationObserver(mutations => {
                mutations.forEach(({ addedNodes }) => {
                    addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) this.decorateRoot(node);
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        init() {
            this.#renderer.injectStyles();
            this.#initCacheShortcut();
            this.#initNavigationObservers();
            this.decorateRoot(document);
        }
    }

    const cache = new CacheManager();
    const api = new ApiClientManager(cache);
    const renderer = new OverlayRenderer();
    const surfaces = new SurfaceManager();

    const app = new FlixMonkeyApp(cache, api, renderer, surfaces);
    app.init();
})();
