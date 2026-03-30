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

        // Comma separated list of API clients to use, in fallback order.
        apiClients: 'omdb,imdb',
    };

    // ---------------------------------------------------------------------------
    // Cache management
    // ---------------------------------------------------------------------------

    class CacheManager {
        constructor() {
            this.CACHE_KEY = 'fm_cache';
        }

        getKey(title, year) {
            return title.toLowerCase().replace(/\s+/g, '_') + (year ? `_${year}` : '');
        }

        loadBlob() {
            try {
                return JSON.parse(GM_getValue(this.CACHE_KEY) || '{}');
            } catch {
                return {};
            }
        }

        read(title, year) {
            const entry = this.loadBlob()[this.getKey(title, year)];
            if (!entry) return null;
            return Date.now() > entry.expires ? null : entry.data;
        }

        write(title, year, data, ttl) {
            const blob = this.loadBlob();
            const now = Date.now();
            for (const k of Object.keys(blob)) {
                if (now > blob[k].expires) delete blob[k];
            }
            blob[this.getKey(title, year)] = { data, expires: now + ttl };
            GM_setValue(this.CACHE_KEY, JSON.stringify(blob));
        }

        clear() {
            const count = Object.keys(this.loadBlob()).length;
            GM_setValue(this.CACHE_KEY, '{}');
            console.warn(`[FlixMonkey] Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
        }
    }

    // ---------------------------------------------------------------------------
    // OMDB / IMDb API Client
    // ---------------------------------------------------------------------------

    class BaseApiClient {
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

        formatRating(val) {
            if (!val || val === 'N/A') return null;
            const num = parseFloat(val);
            return isNaN(num) ? val : num.toFixed(1);
        }

        /**
         * @returns Promise<{ imdbId, rating, rtRating, mcRating } | null>
         */
        async fetch() {
            throw new Error('Not implemented');
        }
    }

    class OmdbApiClient extends BaseApiClient {
        async fetch(title, year) {
            const isOmdbConfigured = CONFIG.omdbApiKey && CONFIG.omdbApiKey !== 'YOUR_OMDB_API_KEY';
            if (!isOmdbConfigured) return null;

            const params = new URLSearchParams({ apikey: CONFIG.omdbApiKey, t: title });
            if (year) params.set('y', year);

            let json;
            try {
                json = await this.gmFetch(`https://www.omdbapi.com/?${params}`);
            } catch (err) {
                console.warn('[FlixMonkey] OMDB fetch failed:', err.message);
                return null;
            }

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

            const formattedRating = this.formatRating(rating);
            return { imdbId: json.imdbID, rating: formattedRating, rtRating, mcRating };
        }
    }

    class ImdbApiClient extends BaseApiClient {
        async fetch(title, year) {
            const query = (year ? `${title} ${year}` : title).toLowerCase();
            const firstChar = query[0] || 'x';
            const suggestUrl = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(query)}.json`;

            let imdbId = null;
            try {
                const suggestJson = await this.gmFetch(suggestUrl, 'json');
                if (suggestJson && Array.isArray(suggestJson.d)) {
                    const match = suggestJson.d.find(entry => entry.id && entry.id.startsWith('tt'));
                    if (match) {
                        imdbId = match.id;
                    }
                }
            } catch (e) {
                console.warn('[FlixMonkey] Suggestions API failed:', e.message);
            }

            if (!imdbId) return null;

            // Random delay (1s to 2.5s)
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

            let titleHtml;
            try {
                const titleUrl = `https://www.imdb.com/title/${imdbId}/`;
                titleHtml = await this.gmFetch(titleUrl, 'text');
            } catch (err) {
                console.warn('[FlixMonkey] IMDb scrape failed:', err.message);
                return null;
            }

            let rating = null;
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

            if (!rating) {
                const rMatch = titleHtml.match(
                    /data-testid="hero-rating-bar__aggregate-rating__score"[^>]*>[\s\S]*?<span[^>]*>([\d.]+)<\/span>/
                );
                if (rMatch) rating = rMatch[1];
            }

            const formattedRating = this.formatRating(rating);
            return { imdbId, rating: formattedRating, rtRating: null, mcRating: null };
        }
    }

    class ApiClientManager {
        constructor(cacheManager) {
            this.cache = cacheManager;
            this.clients = [];

            const configuredClients = (CONFIG.apiClients || 'omdb,imdb').split(',').map(c => c.trim().toLowerCase());
            for (const clientName of configuredClients) {
                if (clientName === 'omdb') this.clients.push(new OmdbApiClient());
                else if (clientName === 'imdb') this.clients.push(new ImdbApiClient());
            }
        }

        async getData(title, year) {
            const cached = this.cache.read(title, year);
            if (cached !== null) return cached;

            let bestData = null;

            for (const client of this.clients) {
                const data = await client.fetch(title, year);
                // "If a result has no rating it can be discarded even if it has IMDB id"
                if (data && data.rating) {
                    bestData = data;
                    break;
                }
            }

            if (!bestData) return null;

            this.cache.write(
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
        constructor() {
            this.OVERLAY_CLASS = 'fm-rating-overlay';
            this.OVERLAY_ATTR = 'data-fm-injected';
        }

        injectStyles() {
            const cornerStyles = {
                'top-left': 'top:6px;left:6px;',
                'top-right': 'top:6px;right:6px;',
                'bottom-left': 'bottom:6px;left:6px;',
                'bottom-right': 'bottom:6px;right:6px;',
            };

            const positionCss = cornerStyles[CONFIG.overlayCorner] || cornerStyles['top-left'];

            const style = document.createElement('style');
            style.textContent = `
                .${this.OVERLAY_CLASS} {
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
                .${this.OVERLAY_CLASS}:hover { background: rgba(0,0,0,0.92); }
                .${this.OVERLAY_CLASS} .fm-row { display: flex; align-items: center; gap: 4px; }
                .${this.OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; color: #f5c518; }
                .${this.OVERLAY_CLASS} .fm-rt { color: #fa320a; }
                .${this.OVERLAY_CLASS} .fm-mc { color: #6ac; }
                .${this.OVERLAY_CLASS} .fm-value { color: #fff; }
                .${this.OVERLAY_CLASS} .fm-na { color: #aaa; }
                .${this.OVERLAY_CLASS} .fm-search { font-size: 11px; color: #ccc; }
            `;

            if (CONFIG.overlayCorner.includes('left')) {
                style.textContent += `\n                .title-card-top-10 .${this.OVERLAY_CLASS} { left: calc(50% + 6px); }`;
            }

            document.head.appendChild(style);
        }

        createOverlay(data, title) {
            const a = document.createElement('a');
            a.className = this.OVERLAY_CLASS;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.href = data.imdbId
                ? `https://www.imdb.com/title/${data.imdbId}/`
                : `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;

            const rows = [];
            const titleParts = [];

            if (data.rating) {
                rows.push(
                    `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-value">${data.rating}</span></div>`
                );
                titleParts.push(`IMDb: ${data.rating}`);
            } else if (data.imdbId) {
                rows.push(`<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-na">N/A</span></div>`);
            } else {
                rows.push(
                    `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-search">🔍</span></div>`
                );
            }

            if (CONFIG.showRtRating && data.rtRating) {
                rows.push(
                    `<div class="fm-row"><span class="fm-label fm-rt">RT</span><span class="fm-value">${data.rtRating}</span></div>`
                );
                titleParts.push(`RT: ${data.rtRating}`);
            }

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

        ensureRelative(container) {
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        }

        injectOverlay(container, data, title) {
            container.querySelector(`.${this.OVERLAY_CLASS}`)?.remove();
            container.appendChild(this.createOverlay(data, title));
            container.setAttribute(this.OVERLAY_ATTR, '1');
        }

        hasOverlay(container) {
            return container.hasAttribute(this.OVERLAY_ATTR);
        }
    }

    // ---------------------------------------------------------------------------
    // Surface Discovery
    // ---------------------------------------------------------------------------

    class SurfaceManager {
        constructor() {
            this.SURFACES = [
                {
                    titleSelectors: '.title-card .fallback-text',
                    getTitle: el => el.textContent?.trim() || null,
                    containerSel: '.title-card',
                },
                {
                    titleSelectors: '.bob-title',
                    getTitle: el => el.textContent?.trim() || null,
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
                    getTitle: el => el.getAttribute('alt')?.trim() || el.textContent?.trim() || null,
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
                    getTitle: el => el.getAttribute('alt')?.trim() || el.textContent?.trim() || null,
                    containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
                },
            ];
        }

        discover(root) {
            const seen = new Set();
            const results = [];

            for (const surface of this.SURFACES) {
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

        extractYear(el) {
            const yearEl = el.querySelector('.year, [data-year], .releaseYear');
            if (!yearEl) return null;
            const m = yearEl.textContent.match(/\d{4}/);
            return m ? m[0] : null;
        }
    }

    // ---------------------------------------------------------------------------
    // App orchestration
    // ---------------------------------------------------------------------------

    class FlixMonkeyApp {
        constructor() {
            this.cache = new CacheManager();
            this.api = new ApiClientManager(this.cache);
            this.renderer = new OverlayRenderer();
            this.surfaces = new SurfaceManager();
            this.inFlight = new Map();
        }

        async decorateContainer(container, title) {
            if (this.renderer.hasOverlay(container)) return;

            const year = this.surfaces.extractYear(container);
            const cached = this.cache.read(title, year);
            if (cached !== null) {
                this.renderer.ensureRelative(container);
                this.renderer.injectOverlay(container, cached, title);
                return;
            }

            const dedupKey = title.toLowerCase();
            let promise = this.inFlight.get(dedupKey);
            if (!promise) {
                promise = this.api.getData(title, year).finally(() => this.inFlight.delete(dedupKey));
                this.inFlight.set(dedupKey, promise);
            }

            const data = await promise;
            this.renderer.ensureRelative(container);
            this.renderer.injectOverlay(container, data || { imdbId: null, rating: null }, title);
        }

        decorateRoot(root) {
            for (const { container, title } of this.surfaces.discover(root)) {
                this.decorateContainer(container, title);
            }
        }

        initCacheShortcut() {
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
                    this.cache.clear();
                }
            });
        }

        initNavigationObservers() {
            const _pushState = history.pushState;
            const _replaceState = history.replaceState;

            history.pushState = (...args) => {
                _pushState.apply(history, args);
                setTimeout(() => this.decorateRoot(document), 800);
            };
            history.replaceState = (...args) => {
                _replaceState.apply(history, args);
                setTimeout(() => this.decorateRoot(document), 800);
            };
            window.addEventListener('popstate', () => setTimeout(() => this.decorateRoot(document), 800));

            const observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) this.decorateRoot(node);
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        init() {
            this.renderer.injectStyles();
            this.initCacheShortcut();
            this.initNavigationObservers();
            this.decorateRoot(document);
        }
    }

    const app = new FlixMonkeyApp();
    app.init();
})();
