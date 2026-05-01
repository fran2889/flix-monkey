# Multi-Target Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor FlixMonkey from a single-file IIFE userscript into three distribution targets (Tampermonkey userscript, Firefox MV3 extension, Chrome MV3 extension) built from shared ES modules using Rollup.

**Architecture:** Extract the existing IIFE into `src/core/` ES modules + a `PlatformAdapter` interface that abstracts `GM_*` / `browser.*` APIs. Migrate all storage calls to async. Wire three target entry points through a single Rollup config. The original `FlixMonkey.user.js` is preserved unchanged until the new build produces a verified equivalent.

**Tech Stack:** Rollup, `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `webextension-polyfill`, ES modules (`sourceType: module` in `src/`)

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `src/core/constants.js` | Create | Shared constants (extracted verbatim) |
| `src/core/title.js` | Create | Title class (extracted verbatim) |
| `src/core/config-fields.js` | Create | Shared field definitions for all targets |
| `src/core/config.js` | Create | CONFIG object + initConfig() injection |
| `src/core/request-queue.js` | Create | RequestQueue, async-migrated |
| `src/core/disabled-clients.js` | Create | DisabledClientsManager, async-migrated |
| `src/core/cache.js` | Create | CacheManager, async-migrated |
| `src/core/api-clients.js` | Create | BaseApiClient + 3 subclasses, adapter-wired |
| `src/core/api-manager.js` | Create | ApiClientManager |
| `src/core/overlay.js` | Create | OverlayRenderer (extracted verbatim) |
| `src/core/surfaces.js` | Create | SurfaceManager (extracted verbatim) |
| `src/core/app.js` | Create | FlixMonkeyApp + startApp() factory |
| `src/platform/adapter.js` | Create | PlatformAdapter base class |
| `src/platform/userscript.js` | Create | UserscriptAdapter (GM_* wrappers) |
| `src/platform/webextension.js` | Create | WebExtensionAdapter (browser.storage + sendMessage) |
| `src/targets/userscript/entry.js` | Create | GM_config wiring + menu commands |
| `src/targets/extension/content.js` | Create | Shared extension content script entry |
| `src/targets/extension/options.html` | Create | Options page HTML (shared Firefox + Chrome) |
| `src/targets/extension/options.js` | Create | Options page logic (shared) |
| `src/targets/firefox/manifest.json` | Create | Firefox MV3 manifest |
| `src/targets/firefox/background.js` | Create | Firefox HTTP proxy (~35 lines) |
| `src/targets/chrome/manifest.json` | Create | Chrome MV3 manifest |
| `src/targets/chrome/service-worker.js` | Create | Chrome MV3 HTTP proxy (~35 lines) |
| `rollup.config.js` | Create | Full build config for all three targets |
| `package.json` | Modify | Add build scripts + new dev deps, sync version to 0.10.0 |
| `eslint.config.js` | Modify | Add sourceType:module config for src/ files |
| `.gitignore` | Modify | Add dist/ |

---

## Task 1: Install build dependencies and scaffold project

**Files:**
- Modify: `package.json`
- Create: `rollup.config.js` (stub)
- Modify: `.gitignore` (if it exists, otherwise create)

- [ ] **Step 1: Install new dependencies**

```bash
cd /home/fran/Projects/flix-monkey
npm install --save-dev rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs webextension-polyfill
```

Expected: `package-lock.json` updated, `node_modules/rollup` and `node_modules/webextension-polyfill` present.

- [ ] **Step 2: Sync version in package.json to 0.10.0 and add build scripts**

Replace the `"scripts"` block and update `"version"` in `package.json`:

```json
{
  "name": "flixmonkey",
  "version": "0.10.0",
  "description": "Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners",
  "type": "module",
  "scripts": {
    "format": "prettier --write \"src/**/*.js\" \"src/**/*.html\"",
    "lint": "eslint \"src/**/*.js\"",
    "lint:fix": "eslint --fix \"src/**/*.js\"",
    "build:userscript": "rollup -c --environment TARGET:userscript",
    "build:firefox": "rollup -c --environment TARGET:firefox",
    "build:chrome": "rollup -c --environment TARGET:chrome",
    "build": "rollup -c"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@rollup/plugin-commonjs": "^28.0.0",
    "@rollup/plugin-node-resolve": "^16.0.0",
    "eslint": "^10.1.0",
    "globals": "^17.4.0",
    "prettier": "^3.8.1",
    "rollup": "^4.0.0",
    "webextension-polyfill": "^0.12.0"
  }
}
```

Note: `webextension-polyfill` is listed under `devDependencies` because Rollup bundles it into the extension output — it is not a runtime npm dependency.

- [ ] **Step 3: Create a stub rollup.config.js**

This stub will be replaced in Task 16. Its purpose is to make `npm run build` runnable without errors before entry points exist.

```js
// rollup.config.js
export default [];
```

- [ ] **Step 4: Add dist/ to .gitignore**

Create or append to `.gitignore`:

```
node_modules/
dist/
```

- [ ] **Step 5: Create the src/ directory tree**

```bash
mkdir -p src/core src/platform src/targets/userscript src/targets/extension src/targets/firefox src/targets/chrome
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json rollup.config.js .gitignore
git commit -m "chore: add rollup build tooling and scaffold src/ structure"
```

---

## Task 2: Extract `src/core/constants.js` and `src/core/title.js`

These are verbatim extractions — no logic changes, just add `export` keywords.

**Files:**
- Create: `src/core/constants.js`
- Create: `src/core/title.js`

- [ ] **Step 1: Create src/core/constants.js**

```js
export const DAYS_TO_MS = 24 * 60 * 60 * 1000;
export const NAVIGATION_DEBOUNCE_MS = 800;
export const HTTP_TIMEOUT = 8000;
export const CLIENT_DISABLE_DURATION = 3600000;

export const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

export const ApiSource = Object.freeze({
    XMDB: 'xmdb',
    OMDB: 'omdb',
    IMDBAPI: 'imdbapi',
});

export const RATE_LIMITS = {
    [ApiSource.XMDB]: 1500,
    [ApiSource.OMDB]: 0,
    [ApiSource.IMDBAPI]: 1000,
};
```

- [ ] **Step 2: Create src/core/title.js**

```js
export class Title {
    constructor({
        displayTitle = null,
        apiTitle = null,
        imdbId = null,
        year = null,
        rating = null,
        rtRating = null,
        mcRating = null,
        source = null,
    } = {}) {
        this.displayTitle = displayTitle;
        this.apiTitle = apiTitle;
        this.imdbId = imdbId;
        this.year = year !== null && year !== undefined ? Number.parseInt(year, 10) : null;
        this.rating = this.#normalizeRating(rating, v => {
            const num = parseFloat(v);
            return Number.isNaN(num) ? null : num;
        });
        this.rtRating = this.#normalizeRating(rtRating, v => {
            const num = Number.parseInt(v, 10);
            return Number.isNaN(num) ? null : num;
        });
        this.mcRating = this.#normalizeRating(mcRating, v => {
            const m = String(v).match(/^(\d+)/);
            return m ? Number.parseInt(m[1], 10) : null;
        });
        this.source = source ?? null;
    }

    get hasRating() {
        return !!(this.rating || this.rtRating || this.mcRating);
    }

    get imdbUrl() {
        return this.imdbId
            ? `https://www.imdb.com/title/${this.imdbId}/`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(this.displayTitle ?? '')}`;
    }

    isBetterThan(other) {
        return !!this.rating && !other?.rating;
    }

    static fromJSON(obj) {
        return new Title(obj ?? {});
    }

    static notFound(displayTitle) {
        return new Title({ displayTitle });
    }

    #normalizeRating(val, converter) {
        if (!val || val === 'N/A') return null;
        return converter ? converter(val) : val;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/constants.js src/core/title.js
git commit -m "refactor: extract constants and Title to src/core modules"
```

---

## Task 3: Create platform adapter interface and UserscriptAdapter

**Files:**
- Create: `src/platform/adapter.js`
- Create: `src/platform/userscript.js`

- [ ] **Step 1: Create src/platform/adapter.js**

```js
export class PlatformAdapter {
    async storageGet(_key) { throw new Error('Not implemented'); }
    async storageSet(_key, _value) { throw new Error('Not implemented'); }
    async httpFetch(_url, _options) { throw new Error('Not implemented'); }
    registerMenuCommand(_label, _fn) {}
}
```

- [ ] **Step 2: Create src/platform/userscript.js**

`httpFetch` is the existing `gmFetch()` body moved here. Non-2xx responses reject with an error that carries a `status` property so `BaseApiClient.queuedFetch` can decide whether to disable the client.

```js
import { PlatformAdapter } from './adapter.js';
import { USER_AGENTS, HTTP_TIMEOUT } from '../core/constants.js';

export class UserscriptAdapter extends PlatformAdapter {
    async storageGet(key) {
        return GM_getValue(key) ?? null;
    }

    async storageSet(key, value) {
        GM_setValue(key, value);
    }

    async httpFetch(url, { responseType = 'json', timeout = HTTP_TIMEOUT } = {}) {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                headers: {
                    'User-Agent': ua,
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout,
                onload: r => {
                    const { status, response, responseText } = r;
                    if (status >= 200 && status < 300) {
                        if (responseType === 'json') {
                            resolve(response ?? JSON.parse(responseText));
                        } else {
                            resolve(responseText);
                        }
                    } else {
                        reject(Object.assign(new Error(`HTTP ${status}`), { status }));
                    }
                },
                onerror: () => reject(new Error('network error')),
                ontimeout: () => reject(new Error('timeout')),
            });
        });
    }

    registerMenuCommand(label, fn) {
        GM_registerMenuCommand(label, fn);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/platform/adapter.js src/platform/userscript.js
git commit -m "refactor: add PlatformAdapter interface and UserscriptAdapter"
```

---

## Task 4: Extract `src/core/request-queue.js` with async migration

The only changes from the original: constructor gains an `adapter` param, and the two `GM_getValue`/`GM_setValue` lines in `#process()` become `await this.#adapter.storageGet/Set(...)`.

**Files:**
- Create: `src/core/request-queue.js`

- [ ] **Step 1: Create src/core/request-queue.js**

```js
export class RequestQueue {
    #queue = [];
    #isProcessing = false;
    #lastLocalReqTime = 0;
    #minInterval;
    #globalSyncKey;
    #adapter;

    constructor(minInterval = 1000, globalSyncKey = null, adapter = null) {
        this.#minInterval = minInterval;
        this.#globalSyncKey = globalSyncKey;
        this.#adapter = adapter;
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
            if (this.#globalSyncKey && this.#adapter) {
                const str = await this.#adapter.storageGet(this.#globalSyncKey);
                lastGlobal = str ? parseInt(str, 10) : 0;
            }

            const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
            if (wait > 0) {
                await new Promise(r => setTimeout(r, wait + Math.random() * 50));
                continue;
            }

            this.#lastLocalReqTime = Date.now();
            if (this.#globalSyncKey && this.#adapter) {
                await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
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
```

- [ ] **Step 2: Commit**

```bash
git add src/core/request-queue.js
git commit -m "refactor: extract RequestQueue to src/core, migrate storage to adapter"
```

---

## Task 5: Extract `src/core/disabled-clients.js` with async migration

`isDisabled()`, `disable()`, and `resetAll()` all become `async`.

**Files:**
- Create: `src/core/disabled-clients.js`

- [ ] **Step 1: Create src/core/disabled-clients.js**

```js
import { CLIENT_DISABLE_DURATION, ApiSource } from './constants.js';

export class DisabledClientsManager {
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    async isDisabled(source) {
        const key = `fm_disabled_${source}`;
        const val = await this.#adapter.storageGet(key);
        const disabledUntil = Number.parseInt(val ?? '0', 10);
        if (disabledUntil === 0) return false;
        if (Date.now() > disabledUntil) {
            await this.#adapter.storageSet(key, '0');
            return false;
        }
        return true;
    }

    async disable(source, durationMs = CLIENT_DISABLE_DURATION) {
        const until = Date.now() + durationMs;
        await this.#adapter.storageSet(`fm_disabled_${source}`, until.toString());
    }

    async resetAll() {
        await Promise.all(
            Object.values(ApiSource).map(source =>
                this.#adapter.storageSet(`fm_disabled_${source}`, '0')
            )
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/disabled-clients.js
git commit -m "refactor: extract DisabledClientsManager to src/core, migrate storage to adapter"
```

---

## Task 6: Extract `src/core/cache.js` with async migration

`read()`, `write()`, `clear()`, and `#loadCacheData()` all become `async`. `CONFIG` is imported from `./config.js` (which is created in Task 10 — Rollup resolves this at build time, not import time, so there is no circular-dependency issue during extraction).

**Files:**
- Create: `src/core/cache.js`

- [ ] **Step 1: Create src/core/cache.js**

```js
import { DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { CONFIG } from './config.js';

export class CacheManager {
    #storageKey = 'fm_cache';
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    #getCacheKey(displayTitle, domYear) {
        return `${displayTitle.toLowerCase().replace(/\s+/g, '_')}${domYear ? `_${domYear}` : ''}`;
    }

    async #loadCacheData() {
        try {
            return JSON.parse((await this.#adapter.storageGet(this.#storageKey)) ?? '{}');
        } catch {
            return {};
        }
    }

    #calculateTtl(titleObj) {
        const getTtlMs = days => (days === -1 ? Infinity : days * DAYS_TO_MS);
        if (!titleObj.hasRating) return getTtlMs(CONFIG.cacheTtlNoRating);
        if (!titleObj.year) return getTtlMs(CONFIG.cacheTtlRatedNewYear);
        const currentYear = new Date().getFullYear();
        const isOldRelease = currentYear - titleObj.year > 1;
        const ttlDays = isOldRelease ? CONFIG.cacheTtlRatedOldYear : CONFIG.cacheTtlRatedNewYear;
        return getTtlMs(ttlDays);
    }

    async read(displayTitle, domYear) {
        const entry = (await this.#loadCacheData())[this.#getCacheKey(displayTitle, domYear)];
        if (!entry) return null;
        return Date.now() > entry.expires ? null : Title.fromJSON(entry.data);
    }

    async write(displayTitle, domYear, titleObj) {
        const blob = await this.#loadCacheData();
        const now = Date.now();
        Object.keys(blob).forEach(k => { if (now > blob[k].expires) delete blob[k]; });
        const ttl = this.#calculateTtl(titleObj);
        blob[this.#getCacheKey(displayTitle, domYear)] = {
            data: titleObj,
            expires: ttl === Infinity ? Infinity : now + ttl,
        };
        await this.#adapter.storageSet(this.#storageKey, JSON.stringify(blob));
    }

    async clear() {
        const blob = await this.#loadCacheData();
        const count = Object.keys(blob).length;
        await this.#adapter.storageSet(this.#storageKey, '{}');
        console.warn(`[FlixMonkey] Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/cache.js
git commit -m "refactor: extract CacheManager to src/core, migrate storage to adapter"
```

---

## Task 7: Extract `src/core/api-clients.js` with async migration

Key changes from the original:
- `gmFetch()` is removed from `BaseApiClient`. `queuedFetch()` now calls `this.#adapter.httpFetch()` and handles 4xx → `disable()` here (previously inside `gmFetch`).
- `isDisabled` getter becomes `async isDisabled()` method.
- `disable()` becomes `async`.
- All three client constructors gain an `adapter` param, which they pass to `super()` and to the `RequestQueue` they create.

**Files:**
- Create: `src/core/api-clients.js`

- [ ] **Step 1: Create src/core/api-clients.js**

```js
import { RequestQueue } from './request-queue.js';
import { DisabledClientsManager } from './disabled-clients.js';
import { Title } from './title.js';
import { ApiSource, RATE_LIMITS, CLIENT_DISABLE_DURATION } from './constants.js';
import { CONFIG } from './config.js';

const createClientLogger = clientName => ({
    search: (title, year) =>
        console.warn(`[FlixMonkey] Searching ${clientName} for title: "${title}"${year ? ` (${year})` : ''}`),
    fetchDetails: (id, title) =>
        console.warn(`[FlixMonkey] Fetching ${clientName} details for ID: ${id} ("${title}")`),
    notFound: title => console.warn(`[FlixMonkey] No search results found in ${clientName} for: "${title}"`),
    failed: message => console.warn(`[FlixMonkey] ${clientName} failed: ${message}`),
});

function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

class BaseApiClient {
    #queue;
    #source;
    #disabledManager;
    #adapter;

    constructor(queue, source, disabledManager, adapter) {
        this.#queue = queue;
        this.#source = source;
        this.#disabledManager = disabledManager;
        this.#adapter = adapter;
    }

    get source() {
        return this.#source;
    }

    async isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    async disable(durationMs = CLIENT_DISABLE_DURATION) {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, durationMs);
        console.warn(
            `[FlixMonkey] ${this.constructor.name} disabled for ${durationMs / 60000}m. Purged ${count} queued requests.`
        );
    }

    async queuedFetch(url, priority = 0, responseType = 'json') {
        try {
            return await this.#queue.enqueue(
                url,
                priority,
                (u, rt) => this.#adapter.httpFetch(u, { responseType: rt }),
                responseType
            );
        } catch (err) {
            if (err.status >= 400 && err.status < 500) await this.disable();
            throw err;
        }
    }

    async fetch(displayTitle, domYear) {
        if (await this.isDisabled()) return null;
        try {
            const match = await this.search(displayTitle, domYear);
            if (!match) return null;
            const titleObj = await this.getDetails(match, displayTitle);
            if (titleObj) {
                titleObj.displayTitle = displayTitle;
                titleObj.source = this.#source;
            }
            return titleObj;
        } catch (err) {
            console.warn(`[FlixMonkey] ${this.constructor.name} failed: ${err.message}`);
            return null;
        }
    }

    async search(_displayTitle, _domYear) {
        throw new Error('Not implemented');
    }

    async getDetails(_match, _displayTitle) {
        throw new Error('Not implemented');
    }
}

export class XmdbApiClient extends BaseApiClient {
    #logger = createClientLogger('XMDB');

    constructor(disabledManager, adapter) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
            ApiSource.XMDB,
            disabledManager,
            adapter
        );
    }

    async search(displayTitle, domYear) {
        if (!CONFIG.xmdbApiKey || CONFIG.xmdbApiKey === 'YOUR_XMDB_API_KEY') return null;
        const searchParams = new URLSearchParams({ apiKey: CONFIG.xmdbApiKey, q: displayTitle, limit: 5 });
        this.#logger.search(displayTitle, domYear);
        const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
        if (!results?.length) { this.#logger.notFound(displayTitle); return null; }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) { this.#logger.notFound(displayTitle); return null; }
        return domYear
            ? (titleResults.find(r => String(r.year) === String(domYear)) ?? titleResults[0])
            : titleResults[0];
    }

    async getDetails({ id, title: searchResultTitle }, displayTitle) {
        this.#logger.fetchDetails(id, displayTitle);
        const detailsParams = new URLSearchParams({ apiKey: CONFIG.xmdbApiKey });
        const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        if (!detailsJson || detailsJson.error) return null;
        const { rating, ratings, year, title } = detailsJson;
        return new Title({
            apiTitle: title ?? searchResultTitle ?? null,
            imdbId: id,
            year,
            rating,
            rtRating: parseRatings(ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(ratings, /Metacritic/i),
        });
    }
}

export class OmdbApiClient extends BaseApiClient {
    #logger = createClientLogger('OMDB');

    constructor(disabledManager, adapter) {
        super(new RequestQueue(RATE_LIMITS[ApiSource.OMDB], null, adapter), ApiSource.OMDB, disabledManager, adapter);
    }

    async search(displayTitle, domYear) {
        if (!CONFIG.omdbApiKey || CONFIG.omdbApiKey === 'YOUR_OMDB_API_KEY') return null;
        return { title: displayTitle, year: domYear };
    }

    async getDetails({ title: t, year: y }, _displayTitle) {
        const params = new URLSearchParams({ apikey: CONFIG.omdbApiKey, t });
        if (y) params.set('y', y);
        this.#logger.fetchDetails(t, _displayTitle);
        const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        if (json.Response === 'False') { this.#logger.notFound(t); return null; }
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle } = json;
        const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
        return new Title({
            apiTitle: apiTitle ?? null,
            imdbId: imdbID,
            year: releaseYear,
            rating: imdbRating,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
        });
    }
}

export class ImdbApiDevClient extends BaseApiClient {
    #logger = createClientLogger('IMDb API Dev');

    constructor(disabledManager, adapter) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.IMDBAPI], null, adapter),
            ApiSource.IMDBAPI,
            disabledManager,
            adapter
        );
    }

    async search(displayTitle, domYear) {
        const searchParams = new URLSearchParams({ query: displayTitle });
        this.#logger.search(displayTitle, domYear);
        const { titles } = await this.queuedFetch(`https://api.imdbapi.dev/search/titles?${searchParams}`, 0);
        if (!titles?.length) { this.#logger.notFound(displayTitle); return null; }
        if (domYear) {
            const targetYear = Number.parseInt(domYear);
            const nearYear = titles.find(t => Math.abs(t.startYear - targetYear) <= 1);
            if (nearYear) return nearYear;
        }
        return titles[0];
    }

    async getDetails(match, displayTitle) {
        this.#logger.fetchDetails(match.id, match.title ?? displayTitle);
        return new Title({
            apiTitle: match.title ?? null,
            imdbId: match.id,
            year: match.startYear,
            rating: match.rating?.aggregateRating,
            rtRating: null,
            mcRating: match.metacritic?.score ?? null,
        });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/api-clients.js
git commit -m "refactor: extract API clients to src/core, remove gmFetch, migrate to adapter"
```

---

## Task 8: Extract `src/core/api-manager.js`

The constructor signature changes to `(cacheManager, disabledManager, adapter, clients = [])`. Client constructors now receive `(disabledManager, adapter)`. `resetDisabledClients()` becomes `async` because `DisabledClientsManager.resetAll()` is now async.

**Files:**
- Create: `src/core/api-manager.js`

- [ ] **Step 1: Create src/core/api-manager.js**

```js
import { CacheManager } from './cache.js';
import { DisabledClientsManager } from './disabled-clients.js';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from './api-clients.js';
import { ApiSource } from './constants.js';
import { Title } from './title.js';
import { CONFIG } from './config.js';

export class ApiClientManager {
    #cache;
    #clients;
    #disabledManager;

    constructor(cacheManager, disabledManager, adapter, clients = []) {
        this.#cache = cacheManager;
        this.#disabledManager = disabledManager;
        this.#clients = clients;

        if (this.#clients.length === 0) {
            const configuredClients = (CONFIG.apiClients ?? 'imdbapi').split(',').map(c => c.trim().toLowerCase());
            const clientMap = {
                [ApiSource.XMDB]: XmdbApiClient,
                [ApiSource.OMDB]: OmdbApiClient,
                [ApiSource.IMDBAPI]: ImdbApiDevClient,
            };
            configuredClients.forEach(name => {
                if (clientMap[name]) this.#clients.push(new clientMap[name](this.#disabledManager, adapter));
            });
        }
    }

    async resetDisabledClients() {
        await this.#disabledManager.resetAll();
        console.warn('[FlixMonkey] All disabled API clients re-enabled.');
    }

    async getData(displayTitle, domYear) {
        const cached = await this.#cache.read(displayTitle, domYear);
        if (cached !== null) return cached;

        let bestData = null;

        for (const client of this.#clients) {
            if (await client.isDisabled()) continue;
            const data = await client.fetch(displayTitle, domYear);
            if (!data) continue;
            if (data.isBetterThan(bestData)) {
                bestData = data;
                break;
            }
            bestData ??= data;
        }

        if (!bestData) {
            console.warn(
                `[FlixMonkey] Total failure: No ratings found for "${displayTitle}"${domYear ? ` (${domYear})` : ''} using any configured client.`
            );
            await this.#cache.write(displayTitle, domYear, Title.notFound(displayTitle));
            return null;
        }

        await this.#cache.write(displayTitle, domYear, bestData);
        return bestData;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/api-manager.js
git commit -m "refactor: extract ApiClientManager to src/core"
```

---

## Task 9: Extract `src/core/overlay.js` and `src/core/surfaces.js`

Both are verbatim extractions — add imports for `CONFIG` and `export` keywords. No logic changes.

**Files:**
- Create: `src/core/overlay.js`
- Create: `src/core/surfaces.js`

- [ ] **Step 1: Create src/core/overlay.js**

```js
import { CONFIG } from './config.js';

export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';

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
            style.textContent += `\n            .title-card-top-10 .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
        }
        style.textContent += `
            .fm-faded { opacity: 0.30; transition: opacity 0.2s; }
            .fm-faded:hover { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    #createRatingRow(label, value, className = '') {
        return `<div class="fm-row"><span class="fm-label ${className}">${label}</span><span class="fm-value">${value}</span></div>`;
    }

    #formatImdbRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return rating.toFixed(1);
    }

    #formatPercentRating(rating) {
        if (typeof rating !== 'number') return String(rating);
        return `${rating}%`;
    }

    #createMissingRatingRow(label, className = '') {
        return `<div class="fm-row"><span class="fm-label ${className}">${label}</span><span class="fm-na">N/A</span></div>`;
    }

    #createSearchRatingRow(label, className = '') {
        return `<div class="fm-row"><span class="fm-label ${className}">${label}</span><span class="fm-search">🔍</span></div>`;
    }

    #buildTooltip(titleParts, imdbId) {
        if (titleParts.length) return `${titleParts.join(' · ')} – click to open IMDb`;
        if (imdbId) return 'No ratings available – click to open IMDb';
        return 'Not found on IMDb – click to search';
    }

    #createOverlay(titleObj) {
        const a = document.createElement('a');
        a.className = this.#OVERLAY_CLASS;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = titleObj.imdbUrl;

        const rows = [];
        const titleParts = [];
        const { rating, imdbId, rtRating, mcRating } = titleObj;

        if (rating) {
            const formattedRating = this.#formatImdbRating(rating);
            rows.push(this.#createRatingRow('IMDb', formattedRating));
            titleParts.push(`IMDb: ${formattedRating}`);
        } else if (imdbId) {
            rows.push(this.#createMissingRatingRow('IMDb'));
        } else {
            rows.push(this.#createSearchRatingRow('IMDb'));
        }

        if (CONFIG.showRtRating && rtRating) {
            const formattedRt = this.#formatPercentRating(rtRating);
            rows.push(this.#createRatingRow('RT', formattedRt, 'fm-rt'));
            titleParts.push(`RT: ${formattedRt}`);
        }

        if (CONFIG.showMcRating && mcRating) {
            const formattedMc = this.#formatPercentRating(mcRating);
            rows.push(this.#createRatingRow('MC', formattedMc, 'fm-mc'));
            titleParts.push(`MC: ${formattedMc}`);
        }

        a.innerHTML = rows.join('');
        a.title = this.#buildTooltip(titleParts, imdbId);
        a.addEventListener('click', e => e.stopPropagation());
        return a;
    }

    ensureRelative(container) {
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    }

    #createLoadingOverlay(displayTitle) {
        const a = document.createElement('a');
        a.className = `${this.#OVERLAY_CLASS} ${this.#LOADING_CLASS}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = `https://www.imdb.com/find/?q=${encodeURIComponent(displayTitle)}`;
        a.innerHTML = `<div class="fm-row"><span class="fm-label">IMDb</span><span class="fm-search">⏳</span></div>`;
        a.title = 'Fetching ratings… click to search IMDb';
        a.addEventListener('click', e => e.stopPropagation());
        return a;
    }

    injectLoadingOverlay(container, displayTitle) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createLoadingOverlay(displayTitle));
    }

    isLoading(container) {
        return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
    }

    injectOverlay(container, titleObj) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createOverlay(titleObj));
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }

    hasOverlay(container) {
        return container.hasAttribute(this.#OVERLAY_ATTR);
    }

    applyFade(container, titleObj, fadeable) {
        if (!fadeable || !CONFIG.enableFadeUnderRating) {
            container.classList.remove('fm-faded');
            return;
        }
        const { rating } = titleObj ?? {};
        if (typeof rating === 'number' && rating < CONFIG.fadeRatingThreshold) {
            container.classList.add('fm-faded');
        } else {
            container.classList.remove('fm-faded');
        }
    }
}
```

- [ ] **Step 2: Create src/core/surfaces.js**

```js
export class SurfaceManager {
    #SURFACES = [
        {
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.title-card',
            fadeable: true,
        },
        {
            titleSelectors: '[data-uia="search-gallery-video-card"]',
            getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
            containerSel: '[data-uia="search-gallery-video-card"]',
            fadeable: true,
        },
        {
            titleSelectors: '[data-uia="search-suggestion-item-link"]',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '[data-uia="search-suggestion-item"]',
            fadeable: true,
        },
        {
            titleSelectors: '.bob-title',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.bob-container',
            fadeable: false,
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
            fadeable: false,
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
            fadeable: false,
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
                results.push({ container, title, fadeable: surface.fadeable ?? false });
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
```

- [ ] **Step 3: Commit**

```bash
git add src/core/overlay.js src/core/surfaces.js
git commit -m "refactor: extract OverlayRenderer and SurfaceManager to src/core"
```

---

## Task 10: Create `src/core/config-fields.js` and `src/core/config.js`

`config-fields.js` is the single source of truth for field definitions. `config.js` replaces the inline CONFIG object — same getters, but reads from `_configGet` which is set by `initConfig()` before `startApp()` is called.

**Files:**
- Create: `src/core/config-fields.js`
- Create: `src/core/config.js`

- [ ] **Step 1: Create src/core/config-fields.js**

```js
export const CONFIG_FIELDS = [
    {
        key: 'xmdbApiKey',
        label: 'XMDB API Key',
        type: 'text',
        default: 'YOUR_XMDB_API_KEY',
        title: 'Free movie and TV data API. Get API key at https://xmdbapi.com/api-key',
    },
    {
        key: 'omdbApiKey',
        label: 'OMDB API Key',
        type: 'text',
        default: 'YOUR_OMDB_API_KEY',
        title: 'Open Movie Database API key. Get API key at https://www.omdbapi.com/apikey.aspx',
    },
    {
        key: 'apiClients',
        label: 'API Fallback Order',
        type: 'text',
        default: 'imdbapi',
        title: 'Comma-separated list of APIs to try in order: imdbapi, xmdb, omdb. IMDb API does not require a key.',
    },
    {
        key: 'overlayCorner',
        label: 'Overlay Position',
        type: 'select',
        options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        default: 'top-left',
        title: 'Choose where the rating badge appears on Netflix thumbnails and banners.',
    },
    {
        key: 'showRtRating',
        label: 'Show Rotten Tomatoes',
        type: 'checkbox',
        default: true,
        title: 'Display Rotten Tomatoes score when available.',
    },
    {
        key: 'showMcRating',
        label: 'Show Metacritic',
        type: 'checkbox',
        default: true,
        title: 'Display Metacritic score when available.',
    },
    {
        key: 'cacheTtlRatedOldYear',
        label: 'Cache Rated > 1 year (days)',
        type: 'text',
        default: '-1',
        title: 'Cache duration for titles older than 1 year with ratings. -1 = forever.',
    },
    {
        key: 'cacheTtlRatedNewYear',
        label: 'Cache Rated < 1 year (days)',
        type: 'text',
        default: '30',
        title: 'Cache duration for titles released within the last year with ratings.',
    },
    {
        key: 'cacheTtlNoRating',
        label: 'Cache Unrated (days)',
        type: 'text',
        default: '1',
        title: 'Cache duration for titles not found or without ratings. Use small values to retry.',
    },
    {
        key: 'enableFadeUnderRating',
        label: 'Fade Low-Rated Titles',
        type: 'checkbox',
        default: false,
        title: 'Reduce opacity of titles with IMDb rating below the threshold.',
    },
    {
        key: 'fadeRatingThreshold',
        label: 'Fade Threshold (IMDb)',
        type: 'text',
        default: '6.0',
        title: 'Titles with IMDb rating below this value will be faded.',
    },
];

export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default]));
```

- [ ] **Step 2: Create src/core/config.js**

```js
import { CONFIG_DEFAULTS } from './config-fields.js';

let _configGet = key => CONFIG_DEFAULTS[key];

export function initConfig(getterFn) {
    _configGet = getterFn;
}

const configGet = (key, fallback) => {
    try {
        return _configGet(key) ?? fallback;
    } catch {
        return fallback;
    }
};

const createIntConfigGetter = (key, fallback) => () => {
    const num = Number.parseInt(configGet(key, fallback), 10);
    return Number.isNaN(num) ? fallback : num;
};

export const CONFIG = {
    get xmdbApiKey() { return configGet('xmdbApiKey', 'YOUR_XMDB_API_KEY'); },
    get omdbApiKey() { return configGet('omdbApiKey', 'YOUR_OMDB_API_KEY'); },
    get overlayCorner() { return configGet('overlayCorner', 'top-left'); },
    get showRtRating() { return configGet('showRtRating', true); },
    get showMcRating() { return configGet('showMcRating', true); },
    get apiClients() { return configGet('apiClients', 'imdbapi,xmdb,omdb'); },
    get cacheTtlRatedOldYear() { return createIntConfigGetter('cacheTtlRatedOldYear', -1)(); },
    get cacheTtlRatedNewYear() { return createIntConfigGetter('cacheTtlRatedNewYear', 30)(); },
    get cacheTtlNoRating() { return createIntConfigGetter('cacheTtlNoRating', 1)(); },
    get enableFadeUnderRating() { return configGet('enableFadeUnderRating', false); },
    get fadeRatingThreshold() {
        const val = parseFloat(configGet('fadeRatingThreshold', '6.0'));
        return Number.isNaN(val) ? 6.0 : val;
    },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/core/config-fields.js src/core/config.js
git commit -m "refactor: extract config system to src/core with initConfig injection"
```

---

## Task 11: Extract `src/core/app.js` and create the userscript entry point

`startApp(adapter)` is a new exported factory function. It constructs all classes, wires them together, and returns `{ api, cache }` so the entry point can attach menu commands.

**Files:**
- Create: `src/core/app.js`
- Create: `src/targets/userscript/entry.js`

- [ ] **Step 1: Create src/core/app.js**

```js
import { CacheManager } from './cache.js';
import { DisabledClientsManager } from './disabled-clients.js';
import { ApiClientManager } from './api-manager.js';
import { OverlayRenderer } from './overlay.js';
import { SurfaceManager } from './surfaces.js';
import { Title } from './title.js';
import { NAVIGATION_DEBOUNCE_MS } from './constants.js';

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

    async #decorateContainer(container, displayTitle, fadeable) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const domYear = this.#surfaces.extractYear(container);
        const cached = await this.#cache.read(displayTitle, domYear);
        if (cached !== null) {
            this.#renderer.ensureRelative(container);
            this.#renderer.injectOverlay(container, cached);
            this.#renderer.applyFade(container, cached, fadeable);
            return;
        }

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container, displayTitle);

        const dedupKey = `${displayTitle.toLowerCase()}_${domYear ?? ''}`;
        let promise = this.#inFlight.get(dedupKey);
        if (!promise) {
            promise = this.#api.getData(displayTitle, domYear).finally(() => this.#inFlight.delete(dedupKey));
            this.#inFlight.set(dedupKey, promise);
        }

        const data = await promise;
        this.#renderer.ensureRelative(container);
        this.#renderer.injectOverlay(container, data ?? Title.notFound(displayTitle));
        this.#renderer.applyFade(container, data, fadeable);
    }

    decorateRoot(root) {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable }) => {
            this.#decorateContainer(container, title, fadeable);
        });
    }

    #initNavigationObservers() {
        if (history._fmPatched) return;
        history._fmPatched = true;
        const { pushState, replaceState } = history;

        history.pushState = (...args) => {
            pushState.apply(history, args);
            setTimeout(() => this.decorateRoot(document), NAVIGATION_DEBOUNCE_MS);
        };
        history.replaceState = (...args) => {
            replaceState.apply(history, args);
            setTimeout(() => this.decorateRoot(document), NAVIGATION_DEBOUNCE_MS);
        };
        window.addEventListener('popstate', () =>
            setTimeout(() => this.decorateRoot(document), NAVIGATION_DEBOUNCE_MS)
        );

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

export function startApp(adapter) {
    const cache = new CacheManager(adapter);
    const disabledManager = new DisabledClientsManager(adapter);
    const api = new ApiClientManager(cache, disabledManager, adapter);
    const renderer = new OverlayRenderer();
    const surfaces = new SurfaceManager();
    window.fmApi = api;
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces);
    app.init();
    return { api, cache };
}
```

- [ ] **Step 2: Create src/targets/userscript/entry.js**

This file contains the full `GM_config.init()` block from the original `FlixMonkey.user.js`, adapted to use `CONFIG_FIELDS` for field generation and `initConfig` for the getter injection. The CSS block is preserved verbatim.

```js
import { UserscriptAdapter } from '../../platform/userscript.js';
import { initConfig } from '../../core/config.js';
import { CONFIG_FIELDS, CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { startApp } from '../../core/app.js';

'use strict';

const adapter = new UserscriptAdapter();

function buildGmConfigFields(fields) {
    const result = {};
    fields.forEach(f => {
        const def = { label: f.label, type: f.type, default: f.default };
        if (f.title) def.title = f.title;
        if (f.options) def.options = f.options;
        result[f.key] = def;
    });
    return result;
}

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
    fields: buildGmConfigFields(CONFIG_FIELDS),
    events: {
        init: () => {
            initConfig(key => {
                try { return GM_config.get(key); } catch { return CONFIG_DEFAULTS[key]; }
            });
            const { api, cache } = startApp(adapter);

            adapter.registerMenuCommand('FlixMonkey Settings', () => GM_config.open());
            adapter.registerMenuCommand('Clear Cache', () => {
                if (confirm('Are you sure you want to clear the FlixMonkey cache?')) {
                    cache.clear().then(() => alert('Cache cleared.'));
                }
            });
            adapter.registerMenuCommand('Reset Disabled Clients', () => {
                if (confirm('Are you sure you want to re-enable all failing API endpoints?')) {
                    api.resetDisabledClients().then(() => alert('All API endpoints have been re-enabled.'));
                }
            });
        },
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
```

- [ ] **Step 3: Commit**

```bash
git add src/core/app.js src/targets/userscript/entry.js
git commit -m "refactor: extract FlixMonkeyApp and create userscript entry point"
```

---

## Task 12: Wire the userscript Rollup config and verify the build

Replace the stub `rollup.config.js` with a config that builds just the userscript. Verify the output is a valid userscript.

**Files:**
- Modify: `rollup.config.js`

- [ ] **Step 1: Replace rollup.config.js with userscript-only config**

```js
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { version } = pkg;

const USERSCRIPT_BANNER = `// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      ${version}
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
// ==/UserScript==`;

const sharedPlugins = () => [resolve(), commonjs()];

function copyStatic(files) {
    return {
        name: 'copy-static',
        generateBundle() {
            files.forEach(([src, dest]) => {
                mkdirSync(path.dirname(dest), { recursive: true });
                copyFileSync(src, dest);
            });
        },
    };
}

function injectManifestVersion(srcPath, destPath) {
    return {
        name: 'inject-manifest-version',
        generateBundle() {
            mkdirSync(path.dirname(destPath), { recursive: true });
            const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));
            manifest.version = version;
            writeFileSync(destPath, JSON.stringify(manifest, null, 2) + '\n');
        },
    };
}

const target = process.env.TARGET;

const allConfigs = [
    {
        _target: 'userscript',
        input: 'src/targets/userscript/entry.js',
        output: { file: 'dist/FlixMonkey.user.js', format: 'iife', banner: USERSCRIPT_BANNER },
        plugins: sharedPlugins(),
    },
    // Firefox and Chrome configs added in Task 16
];

export default target
    ? allConfigs.filter(c => c._target === target).map(({ _target, ...rest }) => rest)
    : allConfigs.map(({ _target, ...rest }) => rest);
```

- [ ] **Step 2: Run the userscript build**

```bash
npm run build:userscript
```

Expected: `dist/FlixMonkey.user.js` created. No errors. Output starts with `// ==UserScript==`.

- [ ] **Step 3: Verify the output header**

```bash
head -20 dist/FlixMonkey.user.js
```

Expected output:
```
// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      0.10.0
...
// ==/UserScript==
(function () {
    'use strict';
    ...
```

- [ ] **Step 4: Spot-check that core class names are present in the output**

```bash
grep -c "FlixMonkeyApp\|CacheManager\|OverlayRenderer" dist/FlixMonkey.user.js
```

Expected: output is `3` (each class name appears at least once).

- [ ] **Step 5: Commit**

```bash
git add rollup.config.js dist/FlixMonkey.user.js
git commit -m "build: wire userscript Rollup config, produce dist/FlixMonkey.user.js"
```

---

## Task 13: Create `src/platform/webextension.js`

**Files:**
- Create: `src/platform/webextension.js`

- [ ] **Step 1: Create src/platform/webextension.js**

```js
import browser from 'webextension-polyfill';
import { PlatformAdapter } from './adapter.js';

export class WebExtensionAdapter extends PlatformAdapter {
    async storageGet(key) {
        const result = await browser.storage.local.get(key);
        return result[key] ?? null;
    }

    async storageSet(key, value) {
        await browser.storage.local.set({ [key]: value });
    }

    async httpFetch(url, options = {}) {
        const response = await browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });
        if (response.error) {
            throw Object.assign(new Error(response.error), { status: response.status });
        }
        return response.data;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/platform/webextension.js
git commit -m "refactor: add WebExtensionAdapter using browser.storage and sendMessage"
```

---

## Task 14: Create background HTTP proxy scripts

`background.js` (Firefox) uses the Promise-based `browser.*` API. `service-worker.js` (Chrome) uses the callback-based `chrome.*` API and must return `true` from the listener to keep the message channel open for async responses. `USER_AGENTS` is inlined in both since these files are not bundled by Rollup.

**Files:**
- Create: `src/targets/firefox/background.js`
- Create: `src/targets/chrome/service-worker.js`

- [ ] **Step 1: Create src/targets/firefox/background.js**

```js
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

const HTTP_TIMEOUT = 8000;

browser.runtime.onMessage.addListener(async msg => {
    if (msg.type !== 'FM_FETCH') return;
    const { url, options = {} } = msg;
    const { responseType = 'json' } = options;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' },
        });
        clearTimeout(timeoutId);
        if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
        const data = responseType === 'json' ? await res.json() : await res.text();
        return { data };
    } catch (err) {
        clearTimeout(timeoutId);
        return { error: err.message };
    }
});
```

- [ ] **Step 2: Create src/targets/chrome/service-worker.js**

```js
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

const HTTP_TIMEOUT = 8000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    const { responseType = 'json' } = options;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
    fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' },
    })
        .then(async res => {
            clearTimeout(timeoutId);
            if (!res.ok) { sendResponse({ error: `HTTP ${res.status}`, status: res.status }); return; }
            const data = responseType === 'json' ? await res.json() : await res.text();
            sendResponse({ data });
        })
        .catch(err => {
            clearTimeout(timeoutId);
            sendResponse({ error: err.message });
        });
    return true; // keep message channel open for async sendResponse
});
```

- [ ] **Step 3: Commit**

```bash
git add src/targets/firefox/background.js src/targets/chrome/service-worker.js
git commit -m "feat: add Firefox background and Chrome service-worker HTTP proxy scripts"
```

---

## Task 15: Create shared extension entry point and options page

The content script entry and options page are shared between Firefox and Chrome — they live in `src/targets/extension/` and are built into both `dist/firefox/` and `dist/chrome/` by Rollup.

**Files:**
- Create: `src/targets/extension/content.js`
- Create: `src/targets/extension/options.html`
- Create: `src/targets/extension/options.js`

- [ ] **Step 1: Create src/targets/extension/content.js**

```js
import browser from 'webextension-polyfill';
import { WebExtensionAdapter } from '../../platform/webextension.js';
import { initConfig } from '../../core/config.js';
import { CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { startApp } from '../../core/app.js';

(async () => {
    const adapter = new WebExtensionAdapter();
    const stored = await browser.storage.local.get(null);
    initConfig(key => stored[key] ?? CONFIG_DEFAULTS[key]);
    browser.storage.onChanged.addListener(changes => {
        Object.entries(changes).forEach(([k, v]) => { stored[k] = v.newValue; });
    });
    startApp(adapter);
})();
```

- [ ] **Step 2: Create src/targets/extension/options.html**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>FlixMonkey Settings</title>
<style>
  * { box-sizing: border-box; }
  body { background: #141414; color: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 25px; min-width: 480px; }
  h1 { color: #e50914; font-size: 24px; margin: 0 0 25px; text-align: center; font-weight: bold; }
  .field { display: flex; align-items: center; margin-bottom: 12px; }
  .field label { flex: 0 0 200px; text-align: right; padding-right: 15px; color: #ccc; font-size: 14px; cursor: default; }
  .field input[type="text"], .field select { flex: 0 0 220px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; padding: 6px 12px; font-size: 14px; outline: none; }
  .field input[type="text"]:focus, .field select:focus { border-color: #e50914; }
  .field input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
  .actions { display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 20px; flex-wrap: wrap; position: relative; }
  button { padding: 8px 20px; border: none; border-radius: 4px; font-size: 14px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
  #saveBtn { background: #e50914; color: #fff; }
  #saveBtn:hover { background: #f40612; }
  .secondary { background: transparent; color: #ccc; border: 1px solid #555; }
  .secondary:hover { background: #333; color: #fff; }
  #status { text-align: center; margin-top: 10px; font-size: 13px; color: #aaa; min-height: 18px; }
</style>
</head>
<body>
<h1>FlixMonkey Settings</h1>
<div id="fields"></div>
<div class="actions">
  <button id="saveBtn">Save</button>
  <button class="secondary" id="clearCacheBtn">Clear Cache</button>
  <button class="secondary" id="resetClientsBtn">Reset Disabled Clients</button>
</div>
<div id="status"></div>
<script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create src/targets/extension/options.js**

`options.js` is bundled by Rollup (Task 16), so ES module imports work here.

```js
import browser from 'webextension-polyfill';
import { CONFIG_FIELDS, CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { ApiSource } from '../../core/constants.js';

const fieldsContainer = document.getElementById('fields');
const statusEl = document.getElementById('status');

function showStatus(msg) {
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
}

CONFIG_FIELDS.forEach(f => {
    const div = document.createElement('div');
    div.className = 'field';

    const label = document.createElement('label');
    label.textContent = f.label;
    label.title = f.title ?? '';
    label.htmlFor = `field_${f.key}`;
    div.appendChild(label);

    let input;
    if (f.type === 'select') {
        input = document.createElement('select');
        f.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            input.appendChild(option);
        });
    } else if (f.type === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
    } else {
        input = document.createElement('input');
        input.type = 'text';
    }
    input.id = `field_${f.key}`;
    input.dataset.key = f.key;
    input.dataset.type = f.type;
    div.appendChild(input);
    fieldsContainer.appendChild(div);
});

async function loadValues() {
    const stored = await browser.storage.local.get(null);
    CONFIG_FIELDS.forEach(f => {
        const input = document.getElementById(`field_${f.key}`);
        const val = stored[f.key] ?? CONFIG_DEFAULTS[f.key];
        if (f.type === 'checkbox') {
            input.checked = val === true || val === 'true';
        } else {
            input.value = String(val);
        }
    });
}

document.getElementById('saveBtn').addEventListener('click', async () => {
    const values = {};
    CONFIG_FIELDS.forEach(f => {
        const input = document.getElementById(`field_${f.key}`);
        values[f.key] = f.type === 'checkbox' ? input.checked : input.value;
    });
    await browser.storage.local.set(values);
    showStatus('Saved!');
});

document.getElementById('clearCacheBtn').addEventListener('click', async () => {
    if (!confirm('Clear all cached ratings?')) return;
    await browser.storage.local.set({ fm_cache: '{}' });
    showStatus('Cache cleared.');
});

document.getElementById('resetClientsBtn').addEventListener('click', async () => {
    if (!confirm('Re-enable all failing API endpoints?')) return;
    const resets = Object.fromEntries(
        Object.values(ApiSource).map(s => [`fm_disabled_${s}`, '0'])
    );
    await browser.storage.local.set(resets);
    showStatus('API clients re-enabled.');
});

loadValues();
```

- [ ] **Step 4: Commit**

```bash
git add src/targets/extension/content.js src/targets/extension/options.html src/targets/extension/options.js
git commit -m "feat: add shared extension content entry and options page"
```

---

## Task 16: Add Firefox and Chrome manifests, complete the Rollup config, and build all targets

**Files:**
- Create: `src/targets/firefox/manifest.json`
- Create: `src/targets/chrome/manifest.json`
- Modify: `rollup.config.js`

- [ ] **Step 1: Create src/targets/firefox/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "FlixMonkey",
  "version": "0.0.0",
  "description": "Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners",
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://xmdbapi.com/*",
    "https://www.omdbapi.com/*",
    "https://api.imdbapi.dev/*"
  ],
  "background": {
    "scripts": ["background.js"]
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "flixmonkey@fran",
      "strict_min_version": "109.0"
    }
  }
}
```

Note: `"version": "0.0.0"` is a placeholder — the Rollup `injectManifestVersion` plugin overwrites it with the version from `package.json` at build time.

- [ ] **Step 2: Create src/targets/chrome/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "FlixMonkey",
  "version": "0.0.0",
  "description": "Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners",
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://xmdbapi.com/*",
    "https://www.omdbapi.com/*",
    "https://api.imdbapi.dev/*"
  ],
  "background": {
    "service_worker": "service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  }
}
```

- [ ] **Step 3: Update rollup.config.js with the full three-target config**

Replace the current `rollup.config.js` entirely:

```js
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const { version } = pkg;

const USERSCRIPT_BANNER = `// ==UserScript==
// @name         FlixMonkey
// @namespace    https://github.com/fran/FlixMonkey
// @version      ${version}
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
// ==/UserScript==`;

const sharedPlugins = () => [resolve(), commonjs()];

function copyStatic(files) {
    return {
        name: 'copy-static',
        generateBundle() {
            files.forEach(([src, dest]) => {
                mkdirSync(path.dirname(dest), { recursive: true });
                copyFileSync(src, dest);
            });
        },
    };
}

function injectManifestVersion(srcPath, destPath) {
    return {
        name: 'inject-manifest-version',
        generateBundle() {
            mkdirSync(path.dirname(destPath), { recursive: true });
            const manifest = JSON.parse(readFileSync(srcPath, 'utf8'));
            manifest.version = version;
            writeFileSync(destPath, JSON.stringify(manifest, null, 2) + '\n');
        },
    };
}

const target = process.env.TARGET;

const allConfigs = [
    {
        _target: 'userscript',
        input: 'src/targets/userscript/entry.js',
        output: { file: 'dist/FlixMonkey.user.js', format: 'iife', banner: USERSCRIPT_BANNER },
        plugins: sharedPlugins(),
    },
    {
        _target: 'firefox',
        input: 'src/targets/extension/content.js',
        output: { file: 'dist/firefox/content.js', format: 'iife' },
        plugins: [
            ...sharedPlugins(),
            copyStatic([
                ['src/targets/firefox/background.js', 'dist/firefox/background.js'],
                ['src/targets/extension/options.html', 'dist/firefox/options.html'],
            ]),
            injectManifestVersion('src/targets/firefox/manifest.json', 'dist/firefox/manifest.json'),
        ],
    },
    {
        _target: 'firefox',
        input: 'src/targets/extension/options.js',
        output: { file: 'dist/firefox/options.js', format: 'iife' },
        plugins: sharedPlugins(),
    },
    {
        _target: 'chrome',
        input: 'src/targets/extension/content.js',
        output: { file: 'dist/chrome/content.js', format: 'iife' },
        plugins: [
            ...sharedPlugins(),
            copyStatic([
                ['src/targets/chrome/service-worker.js', 'dist/chrome/service-worker.js'],
                ['src/targets/extension/options.html', 'dist/chrome/options.html'],
            ]),
            injectManifestVersion('src/targets/chrome/manifest.json', 'dist/chrome/manifest.json'),
        ],
    },
    {
        _target: 'chrome',
        input: 'src/targets/extension/options.js',
        output: { file: 'dist/chrome/options.js', format: 'iife' },
        plugins: sharedPlugins(),
    },
];

export default target
    ? allConfigs.filter(c => c._target === target).map(({ _target, ...rest }) => rest)
    : allConfigs.map(({ _target, ...rest }) => rest);
```

- [ ] **Step 4: Run the full build**

```bash
npm run build
```

Expected: no errors. The following files must exist:

```
dist/FlixMonkey.user.js
dist/firefox/content.js
dist/firefox/options.js
dist/firefox/background.js
dist/firefox/options.html
dist/firefox/manifest.json
dist/chrome/content.js
dist/chrome/options.js
dist/chrome/service-worker.js
dist/chrome/options.html
dist/chrome/manifest.json
```

Verify all eleven files exist:

```bash
ls dist/FlixMonkey.user.js dist/firefox/{content,options,background}.js dist/firefox/{options.html,manifest.json} dist/chrome/{content,options,service-worker}.js dist/chrome/{options.html,manifest.json}
```

Expected: eleven paths printed, no "No such file" errors.

- [ ] **Step 5: Verify manifest versions were injected**

```bash
node -e "const m=JSON.parse(require('fs').readFileSync('dist/firefox/manifest.json','utf8')); console.log(m.version);"
node -e "const m=JSON.parse(require('fs').readFileSync('dist/chrome/manifest.json','utf8')); console.log(m.version);"
```

Expected: both print `0.10.0`.

- [ ] **Step 6: Commit**

```bash
git add src/targets/firefox/manifest.json src/targets/chrome/manifest.json rollup.config.js
git commit -m "feat: add Firefox and Chrome manifests, complete Rollup config for all targets"
```

---

## Task 17: Update ESLint config for src/ modules

`src/` files are ES modules (`sourceType: 'module'`). The existing config's `sourceType: 'script'` and `GM_*` globals should now apply only to the original `FlixMonkey.user.js`.

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Update eslint.config.js**

```js
import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    // Legacy single-file userscript — script context, GM_* globals
    {
        files: ['FlixMonkey.user.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_config: 'readonly',
            },
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    // src/ modules — ES module context
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                // Userscript entry only — these are globals injected by the userscript manager
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_config: 'readonly',
            },
        },
        rules: {
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
];
```

- [ ] **Step 2: Run lint against src/**

```bash
npm run lint
```

Expected: zero errors. There may be warnings for `console.warn` calls — those are expected and allowed by the `no-console` rule config.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: update ESLint config for src/ ES modules alongside legacy script"
```

---

## Task 18: Final build verification and AGENTS.md update

- [ ] **Step 1: Run the full build one more time from a clean state**

```bash
npm run build
```

Expected: completes without errors.

- [ ] **Step 2: Confirm all dist outputs are present and non-empty**

```bash
wc -l dist/FlixMonkey.user.js dist/firefox/content.js dist/chrome/content.js dist/firefox/options.js dist/chrome/options.js
```

Expected: each file has at least 100 lines (the bundles include all core modules).

- [ ] **Step 3: Confirm manifest versions**

```bash
grep '"version"' dist/firefox/manifest.json dist/chrome/manifest.json
```

Expected:
```
dist/firefox/manifest.json:  "version": "0.10.0",
dist/chrome/manifest.json:  "version": "0.10.0",
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Update AGENTS.md to reflect the new project structure**

In `AGENTS.md`, update the **Project Overview**, **Setup**, **Development Workflow**, **Scripts**, and **Architecture** sections to reflect:
- The project now has a build step (`npm run build`)
- Source lives in `src/`, output in `dist/`
- Three build targets: userscript, firefox, chrome
- `FlixMonkey.user.js` is the legacy source (still works standalone); `dist/FlixMonkey.user.js` is the built output going forward
- Module-level architecture (list the new `src/core/` files and their responsibilities)

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for multi-target build structure"
```

---

## Self-Review Notes

**Spec coverage check:**
- Section 1 (directory structure + build): Tasks 1, 12, 16 ✓
- Section 2 (platform adapter): Tasks 3, 13, 14 ✓
- Section 3 (async migration): Tasks 4, 5, 6, 7, 8 ✓
- Section 4 (config system): Tasks 10, 11, 15 ✓
- Section 5 (manifests + build artifacts): Task 16 ✓
- ESLint update: Task 17 ✓
- `webextension-polyfill` for uniform `browser.*`: Tasks 13, 15 ✓
- Version injection via Rollup plugin: Task 16 ✓
- `isDisabled` getter → method: Task 7 ✓
- `USER_AGENTS` inlined in background scripts: Task 14 ✓

**Deviation from spec noted:** `options.html` and `options.js` are placed in `src/targets/extension/` (shared) rather than duplicated in `src/targets/firefox/` and `src/targets/chrome/`. This is strictly better — identical files in two locations was an oversight in the spec.
