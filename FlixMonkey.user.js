// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      0.9.5
// @description  Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners
// @author       fran
// @match        https://www.netflix.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @connect      www.omdbapi.com
// @connect      xmdbapi.com
// @connect      api.imdbapi.dev
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ---------------------------------------------------------------------------
    GM_config.init({
        id: 'FlixMonkey',
        title: 'FlixMonkey Settings',
        css: `
            body { background-color: #141414 !important; margin: 0 !important; }
            #FlixMonkey_wrapper { display: inline-flex !important; flex-direction: column !important; align-items: stretch !important; background: #141414 !important; color: #fff !important; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; padding: 25px !important; box-sizing: border-box !important; }
            #FlixMonkey_header { color: #e50914 !important; font-size: 24px !important; margin-bottom: 25px !important; font-weight: bold !important; text-align: center !important; width: 100% !important; }
            .config_var { display: flex !important; justify-content: flex-start !important; align-items: center !important; margin-bottom: 12px !important; }
            .field_label { flex: 0 0 200px !important; padding-right: 15px !important; text-align: right !important; color: #ccc !important; font-size: 14px !important; font-weight: normal !important; box-sizing: border-box !important; }
            #FlixMonkey_wrapper input[type="text"], #FlixMonkey_wrapper select { flex: 0 0 220px !important; background: #333 !important; color: #fff !important; border: 1px solid #555 !important; border-radius: 4px !important; padding: 6px 12px !important; outline: none !important; font-size: 14px !important; box-sizing: border-box !important; margin: 0 !important; }
            #FlixMonkey_wrapper input[type="text"]:focus, #FlixMonkey_wrapper select:focus { border-color: #e50914 !important; }
            #FlixMonkey_wrapper input[type="checkbox"] { flex: 0 0 auto !important; width: 16px !important; height: 16px !important; margin: 0 !important; cursor: pointer !important; }
            .reset_holder { position: absolute !important; right: 0 !important; top: 50% !important; transform: translateY(-50%) !important; margin: 0 !important; padding: 0 !important; width: auto !important; }
            #FlixMonkey_resetLink { color: #aaa !important; font-size: 13px !important; text-decoration: none !important; cursor: pointer !important; transition: color 0.2s !important; background: none !important; border: none !important; padding: 0 !important; }
            #FlixMonkey_resetLink:hover { background: none !important; color: #fff !important; text-decoration: underline !important; border: none !important; }
            #FlixMonkey_buttons_holder { position: relative !important; display: flex !important; justify-content: center !important; align-items: center !important; gap: 15px !important; margin-top: 15px !important; width: 100% !important; }
            #FlixMonkey_saveBtn, #FlixMonkey_closeBtn { padding: 8px 20px !important; border: none !important; border-radius: 4px !important; font-size: 14px !important; font-weight: bold !important; cursor: pointer !important; transition: background 0.2s !important; }
            #FlixMonkey_saveBtn { background: #e50914 !important; color: #fff !important; }
            #FlixMonkey_saveBtn:hover { background: #f40612 !important; }
            #FlixMonkey_closeBtn { background: transparent !important; color: #ccc !important; border: 1px solid #555 !important; }
            #FlixMonkey_closeBtn:hover { background: #333 !important; color: #fff !important; }
        `,
        fields: {
            xmdbApiKey: {
                label: 'XMDB API Key',
                type: 'text',
                default: 'YOUR_XMDB_API_KEY',
                title: 'Free movie and TV data API. Get API key at https://xmdbapi.com/api-key',
            },
            omdbApiKey: {
                label: 'OMDB API Key',
                type: 'text',
                default: 'YOUR_OMDB_API_KEY',
                title: 'Open Movie Database API key. Get API key at https://www.omdbapi.com/apikey.aspx',
            },
            apiClients: {
                label: 'API Fallback Order',
                type: 'text',
                default: 'imdbapi',
                title: 'Comma-separated list of APIs to try in order: imdbapi, xmdb, omdb. IMDb API does not require a key.',
            },
            overlayCorner: {
                label: 'Overlay Position',
                type: 'select',
                options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
                default: 'top-left',
                title: 'Choose where the rating badge appears on Netflix thumbnails and banners.',
            },
            showRtRating: {
                label: 'Show Rotten Tomatoes',
                type: 'checkbox',
                default: true,
                title: 'Display Rotten Tomatoes score when available.',
            },
            showMcRating: {
                label: 'Show Metacritic',
                type: 'checkbox',
                default: true,
                title: 'Display Metacritic score when available.',
            },
            cacheTtlRatedOldYear: {
                label: 'Cache Rated > 1 year (days)',
                type: 'text',
                default: '-1',
                title: 'Cache duration for titles older than 1 year with ratings. -1 = forever.',
            },
            cacheTtlRatedNewYear: {
                label: 'Cache Rated < 1 year (days)',
                type: 'text',
                default: '30',
                title: 'Cache duration for titles released within the last year with ratings.',
            },
            cacheTtlNoRating: {
                label: 'Cache Unrated (days)',
                type: 'text',
                default: '1',
                title: 'Cache duration for titles not found or without ratings. Use small values to retry.',
            },
        },
        events: {
            init: startApp,
            open: function (doc, win, frame) {
                if (frame && doc) {
                    const wrapper = doc.getElementById('FlixMonkey_wrapper');
                    if (wrapper) {
                        frame.style.width = wrapper.offsetWidth + 'px';
                        frame.style.height = wrapper.offsetHeight + 'px';
                        frame.style.border = '1px solid #333';
                        frame.style.borderRadius = '5px';
                        this.center();
                    }
                }
            },
            save: () => {
                if (window.fmApi) window.fmApi.resetDisabledClients();
                GM_config.close();
                window.location.reload();
            },
        },
    });

    const configGet = (id, fallback) => {
        try {
            return GM_config.get(id);
        } catch {
            return fallback;
        }
    };

    const CONFIG = {
        get xmdbApiKey() {
            return configGet('xmdbApiKey', 'YOUR_XMDB_API_KEY');
        },
        get omdbApiKey() {
            return configGet('omdbApiKey', 'YOUR_OMDB_API_KEY');
        },
        get overlayCorner() {
            return configGet('overlayCorner', 'top-left');
        },
        get showRtRating() {
            const v = configGet('showRtRating', true);
            return v === undefined || v === null ? true : v;
        },
        get showMcRating() {
            const v = configGet('showMcRating', true);
            return v === undefined || v === null ? true : v;
        },
        get apiClients() {
            return configGet('apiClients', 'imdbapi,xmdb,omdb');
        },
        get cacheTtlRatedOldYear() {
            const val = parseInt(configGet('cacheTtlRatedOldYear', '-1'), 10);
            return Number.isNaN(val) ? -1 : val;
        },
        get cacheTtlRatedNewYear() {
            const val = parseInt(configGet('cacheTtlRatedNewYear', '30'), 10);
            return Number.isNaN(val) ? 30 : val;
        },
        get cacheTtlNoRating() {
            const val = parseInt(configGet('cacheTtlNoRating', '1'), 10);
            return Number.isNaN(val) ? 1 : val;
        },
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

        #calculateTtl(data) {
            const { rating, rtRating, mcRating, year } = data;
            const hasRating = rating || rtRating || mcRating;

            if (!hasRating) return CONFIG.cacheTtlNoRating * 24 * 60 * 60 * 1000;

            if (!year) return CONFIG.cacheTtlRatedNewYear * 24 * 60 * 60 * 1000;

            const releaseYear = parseInt(year, 10);
            const currentYear = new Date().getFullYear();
            const isOldRelease = currentYear - releaseYear > 1;

            if (isOldRelease) {
                const ttlDays = CONFIG.cacheTtlRatedOldYear;
                return ttlDays === -1 ? Infinity : ttlDays * 24 * 60 * 60 * 1000;
            }

            return CONFIG.cacheTtlRatedNewYear * 24 * 60 * 60 * 1000;
        }

        read(title, year) {
            const entry = this.#loadBlob()[this.#getKey(title, year)];
            if (!entry) return null;
            return Date.now() > entry.expires ? null : entry.data;
        }

        write(title, year, data) {
            const blob = this.#loadBlob();
            const now = Date.now();
            Object.keys(blob).forEach(k => {
                if (now > blob[k].expires) delete blob[k];
            });
            const ttl = this.#calculateTtl(data);
            blob[this.#getKey(title, year)] = { data, expires: ttl === Infinity ? Infinity : now + ttl };
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
            return Number.isNaN(num) ? val : num.toFixed(1);
        }

        static normalizeMc(val) {
            if (!val || val === 'N/A') return null;
            const m = String(val).match(/^(\d+)/);
            return m ? `${m[1]}%` : null;
        }

        static normalizeRt(val) {
            return !val || val === 'N/A' ? null : val;
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

        clear() {
            const count = this.#queue.length;
            this.#queue.forEach(item => item.reject(new Error('Client Disabled')));
            this.#queue = [];
            return count;
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
    // API Clients
    // ---------------------------------------------------------------------------

    class BaseApiClient {
        #queue;
        #slug;

        constructor(queue, slug) {
            this.#queue = queue;
            this.#slug = slug;
        }

        get isDisabled() {
            const key = `fm_disabled_${this.#slug}`;
            const disabledUntil = parseInt(GM_getValue(key, '0'), 10);
            if (disabledUntil === 0) return false;

            if (Date.now() > disabledUntil) {
                GM_setValue(key, '0');
                return false;
            }
            return true;
        }

        disable(durationMs = 3600000) {
            const count = this.#queue.clear();
            const until = Date.now() + durationMs;
            GM_setValue(`fm_disabled_${this.#slug}`, until.toString());
            console.warn(
                `[FlixMonkey] ${this.constructor.name} disabled for ${durationMs / 60000}m. Purged ${count} queued requests.`
            );
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
                        } else if (status >= 400 && status < 500) {
                            this.disable();
                            reject(new Error(`HTTP ${status} (Client Disabled)`));
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
            if (this.isDisabled) return null;
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
            super(new RequestQueue(1500, 'fm_last_req'), 'xmdb');
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

            const { rating, ratings, year } = detailsJson;

            return {
                imdbId: id,
                year,
                rating: RatingUtils.format(rating),
                rtRating: RatingUtils.normalizeRt(RatingUtils.findInRatings(ratings, /Rotten Tomatoes/i)),
                mcRating: RatingUtils.normalizeMc(RatingUtils.findInRatings(ratings, /Metacritic/i)),
            };
        }
    }

    class OmdbApiClient extends BaseApiClient {
        constructor() {
            // OMDB is usually fast, no global sync needed by default
            super(new RequestQueue(0), 'omdb');
        }

        async search(title, year) {
            if (!CONFIG.omdbApiKey || CONFIG.omdbApiKey === 'YOUR_OMDB_API_KEY') return null;
            return { title, year };
        }

        async getDetails({ title: t, year: y }, _title) {
            const params = new URLSearchParams({ apikey: CONFIG.omdbApiKey, t: t });
            if (y) params.set('y', y);

            console.warn(`[FlixMonkey] Fetching OMDB details for: "${t}"${y ? ` (${y})` : ''}`);

            const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);

            if (json.Response === 'False') {
                console.warn(`[FlixMonkey] No search results found in OMDB for: "${t}"`);
                return null;
            }

            const { imdbRating, Ratings, imdbID, Year } = json;

            // Extract first year from Year field: "1999", "1999-", or "1999-2000"
            const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;

            return {
                imdbId: imdbID,
                year: releaseYear,
                rating: RatingUtils.format(imdbRating),
                rtRating: RatingUtils.normalizeRt(RatingUtils.findInRatings(Ratings, /Rotten Tomatoes/i)),
                mcRating: RatingUtils.normalizeMc(RatingUtils.findInRatings(Ratings, /Metacritic/i)),
            };
        }
    }

    class ImdbApiDevClient extends BaseApiClient {
        constructor() {
            super(new RequestQueue(1000), 'imdbapi');
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
            console.warn(
                `[FlixMonkey] Using IMDB API Dev search result for ID: ${match.id} ("${match.title || title}")`
            );

            return {
                imdbId: match.id,
                year: match.startYear,
                rating: RatingUtils.format(match.rating?.aggregateRating),
                rtRating: null,
                mcRating: match.metacritic?.score ? `${match.metacritic.score}%` : null,
            };
        }
    }

    class ApiClientManager {
        #cache;
        #clients;

        constructor(cacheManager, clients = []) {
            this.#cache = cacheManager;
            this.#clients = clients;

            if (this.#clients.length === 0) {
                const configuredClients = (CONFIG.apiClients ?? 'xmdb,omdb,imdbapi')
                    .split(',')
                    .map(c => c.trim().toLowerCase());

                const clientMap = {
                    xmdb: XmdbApiClient,
                    omdb: OmdbApiClient,
                    imdbapi: ImdbApiDevClient,
                };

                configuredClients.forEach(name => {
                    if (clientMap[name]) this.#clients.push(new clientMap[name]());
                });
            }
        }

        resetDisabledClients() {
            ['xmdb', 'omdb', 'imdbapi'].forEach(slug => {
                GM_setValue(`fm_disabled_${slug}`, '0');
            });
            console.warn('[FlixMonkey] All disabled API clients re-enabled.');
        }

        async getData(title, year) {
            const cached = this.#cache.read(title, year);
            if (cached !== null) return cached;

            let bestData = null;

            for (const client of this.#clients) {
                if (client.isDisabled) continue;
                const data = await client.fetch(title, year);
                if (!data) continue;
                if (data.rating) {
                    bestData = data;
                    break;
                }
                // Keep the first partial result (has imdbId / RT / MC but no IMDb rating)
                // so we can still render something and link to IMDb.
                bestData ??= data;
            }

            if (!bestData) {
                console.warn(
                    `[FlixMonkey] Total failure: No ratings found for "${title}"${year ? ` (${year})` : ''} using any configured client.`
                );
                return null;
            }

            this.#cache.write(title, year, bestData);
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
                titleSelectors: '[data-uia="search-gallery-video-card"]',
                getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
                containerSel: '[data-uia="search-gallery-video-card"]',
            },
            {
                titleSelectors: '[data-uia="search-suggestion-item-link"]',
                getTitle: el => el.textContent?.trim() ?? null,
                containerSel: '[data-uia="search-suggestion-item"]',
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
            this.#initNavigationObservers();
            this.decorateRoot(document);
        }
    }

    // startApp is invoked by GM_config's events.init callback once stored values are loaded.
    // Calling app.init() here or before that event fires would mean configGet() always
    // returns the hardcoded fallbacks because GM_config.get() is not ready until init completes.
    function startApp() {
        console.warn(
            '[FlixMonkey] GM_config ready – starting app (xmdbKey set:',
            CONFIG.xmdbApiKey !== 'YOUR_XMDB_API_KEY',
            ').'
        );
        const cache = new CacheManager();
        const api = new ApiClientManager(cache);
        const renderer = new OverlayRenderer();
        const surfaces = new SurfaceManager();

        window.fmApi = api;
        const app = new FlixMonkeyApp(cache, api, renderer, surfaces);
        app.init();

        GM_registerMenuCommand('FlixMonkey Settings', () => GM_config.open());

        GM_registerMenuCommand('Clear Cache', () => {
            if (confirm('Are you sure you want to clear the FlixMonkey cache?')) {
                cache.clear();
                alert('Cache cleared.');
            }
        });

        GM_registerMenuCommand('Reset Disabled Clients', () => {
            if (confirm('Are you sure you want to re-enable all failing API endpoints?')) {
                api.resetDisabledClients();
                alert('All API endpoints have been re-enabled.');
            }
        });
    }
})();
