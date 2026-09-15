/**

- SPDX-FileCopyrightText: 2026 Fran
- SPDX-License-Identifier: GPL-3.0-only
  */

# Cache Refresh Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize cache refresh by pulling `displayTitle` and `imdbId` to the top level of cache entries, enabling short-circuit fetches that skip the search step when cache is expired but `imdbId` is available.

**Architecture:** Introduce a `CacheEntry` class that separates cache metadata (`displayTitle`, `imdbId`) from API data (Title without `displayTitle`). Modify `ApiClientManager` to use the short-circuit path when expired entries have an `imdbId`. Update `BaseApiClient.fetch()` to accept optional `imdbId` parameter. Add migration to transform existing cache entries.

**Tech Stack:** JavaScript ES2022, Vitest, existing FlixMonkey codebase patterns

## Global Constraints

- Follow existing code style: ES modules, JSDoc for boundaries, private fields with `#` syntax
- License header required on all new/modified files in `src/` and `tests/`
- Conventional Commits format for all commits
- Maintain backward compatibility through migration
- All tests must pass before considering a task complete

---

## File Structure

### Files to Modify

- `src/core/title.js` - Add `toCacheJSON()` and `fromCacheJSON()` static method
- `src/core/cache.js` - Add `CacheEntry` class, update `read()` and `write()`
- `src/core/api-manager.js` - Update `getData()` to handle new cache flow
- `src/core/api-clients.js` - Update `BaseApiClient.fetch()` signature, update `OMDbApiClient.getDetails()`
- `src/core/migrations.js` - Add new migration version

### Files to Add

- None - `CacheEntry` class will be defined within `cache.js`

---

## Task 1: Title Serialization Methods

**Files:**

- Modify: `src/core/title.js`
- Test: `tests/unit/core/title.test.js`

**Interfaces:**

- Produces: `Title.toCacheJSON()` - returns plain object without `displayTitle`
- Produces: `Title.fromCacheJSON(obj, displayTitle)` - static, returns Title instance

- [ ] **Step 1: Write the failing tests for toCacheJSON**

```javascript
// tests/unit/core/title.test.js - add to existing file

describe('Title serialization', () => {
    it('should return object without displayTitle from toCacheJSON', () => {
        const title = new Title({
            displayTitle: 'Test Movie',
            apiTitle: 'Test Movie',
            imdbId: 'tt1234567',
            year: 2024,
            imdbRating: '8.5',
        });
        const cacheObj = title.toCacheJSON();
        expect(cacheObj).not.toHaveProperty('displayTitle');
        expect(cacheObj.apiTitle).toBe('Test Movie');
        expect(cacheObj.imdbId).toBe('tt1234567');
        expect(cacheObj.year).toBe(2024);
        expect(cacheObj.imdbRating).toBe(8.5);
    });

    it('should reconstruct Title with displayTitle from fromCacheJSON', () => {
        const cacheObj = {
            apiTitle: 'Test Movie',
            imdbId: 'tt1234567',
            year: 2024,
            imdbRating: '8.5',
            imdbVotes: null,
            rtRating: null,
            mcRating: null,
            source: null,
            type: null,
        };
        const title = Title.fromCacheJSON(cacheObj, 'Original Title');
        expect(title.displayTitle).toBe('Original Title');
        expect(title.apiTitle).toBe('Test Movie');
        expect(title.imdbId).toBe('tt1234567');
    });

    it('should handle null displayTitle override in fromCacheJSON', () => {
        const cacheObj = {
            apiTitle: 'Test',
            imdbId: null,
            year: null,
            imdbRating: null,
            imdbVotes: null,
            rtRating: null,
            mcRating: null,
            source: null,
            type: null,
        };
        const title = Title.fromCacheJSON(cacheObj, null);
        expect(title.displayTitle).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest tests/unit/core/title.test.js -t "serialization" -v`
Expected: FAIL with "toCacheJSON is not a function"

- [ ] **Step 3: Implement toCacheJSON and fromCacheJSON in Title**

```javascript
// src/core/title.js - add after existing methods, before Object.freeze line

    /**
     * Returns a plain object representation suitable for cache serialization,
     * excluding displayTitle which is stored separately at the cache entry level.
     * @returns {Object} Title fields without displayTitle
     */
    toCacheJSON() {
        const { displayTitle, ...rest } = this;
        return rest;
    }

    /**
     * Reconstructs a Title from cache data with displayTitle provided separately.
     * @param {Object} obj - Cache data object without displayTitle
     * @param {string|null} displayTitle - Display title from cache entry
     * @returns {Title} New Title instance
     */
    static fromCacheJSON(obj, displayTitle) {
        if (!obj || typeof obj !== 'object') return null;
        return new Title({ ...obj, displayTitle });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/core/title.test.js -t "serialization" -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/title.js tests/unit/core/title.test.js
git commit -m "feat(title): add cache serialization methods for displayTitle separation

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 2: CacheEntry Class and CacheManager Updates

**Files:**

- Modify: `src/core/cache.js`
- Test: `tests/unit/core/cache.test.js`

**Interfaces:**

- Consumes: `Title.toCacheJSON()`, `Title.fromCacheJSON()` from Task 1
- Produces: `CacheEntry` class with `displayTitle`, `imdbId`, `data`, `expires`
- Produces: `CacheManager.read()` returns `CacheEntry | null`
- Produces: `CacheManager.write()` accepts `Title` and stores in new format

- [ ] **Step 1: Write the failing tests for CacheEntry**

```javascript
// tests/unit/core/cache.test.js - add to existing file

describe('CacheEntry class', () => {
    it('should store displayTitle and imdbId at top level', async () => {
        const title = new Title({ displayTitle: 'Test', apiTitle: 'Test', imdbId: 'tt123', year: 2024 });
        adapter.storageSet.mockResolvedValue(null);
        await cacheManager.write('Test', title);
        const call = adapter.storageSet.mock.calls[0];
        const entry = JSON.parse(call[1]);
        expect(entry.displayTitle).toBe('Test');
        expect(entry.imdbId).toBe('tt123');
        expect(entry.data).not.toHaveProperty('displayTitle');
        expect(entry.data.apiTitle).toBe('Test');
    });

    it('should return CacheEntry with getTitle for valid entry', async () => {
        const now = Date.now();
        const entryData = {
            displayTitle: 'Cached Movie',
            imdbId: 'tt456',
            data: {
                apiTitle: 'Cached Movie',
                imdbId: 'tt456',
                year: 2020,
                imdbRating: '7.5',
                imdbVotes: null,
                rtRating: null,
                mcRating: null,
                source: null,
                type: null,
            },
            expires: now + 10000,
        };
        adapter.storageGet.mockResolvedValue(JSON.stringify(entryData));
        const result = await cacheManager.read('Cached Movie', 'agregarr');
        expect(result).not.toBeNull();
        expect(result.getTitle()).toBeInstanceOf(Title);
        expect(result.getTitle().displayTitle).toBe('Cached Movie');
        expect(result.imdbId).toBe('tt456');
        expect(result.isExpired).toBe(false);
    });

    it('should identify expired entry', async () => {
        const now = Date.now();
        const entryData = {
            displayTitle: 'Expired Movie',
            imdbId: 'tt789',
            data: {
                apiTitle: 'Expired Movie',
                imdbId: 'tt789',
                year: 2020,
                imdbRating: '6.5',
                imdbVotes: null,
                rtRating: null,
                mcRating: null,
                source: null,
                type: null,
            },
            expires: now - 1000,
        };
        adapter.storageGet.mockResolvedValue(JSON.stringify(entryData));
        const result = await cacheManager.read('Expired Movie', 'agregarr');
        expect(result).not.toBeNull();
        expect(result.isExpired).toBe(true);
        expect(result.imdbId).toBe('tt789');
        expect(result.displayTitle).toBe('Expired Movie');
    });

    it('should return null for cache miss', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Missing Movie', 'agregarr');
        expect(result).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/core/cache.test.js -t "CacheEntry" -v`
Expected: FAIL with type errors (CacheEntry not defined)

- [ ] **Step 3: Implement CacheEntry class and update CacheManager**

```javascript
// src/core/cache.js - replace existing file content

/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { slugify } from './utils.js';

/**
 * Cache entry encapsulating both metadata and API data.
 * Provides clean separation between search keys (displayTitle, imdbId)
 * and API-returned data (Title fields).
 */
class CacheEntry {
    #displayTitle;
    #imdbId;
    #data;
    #expires;

    /**
     * @param {string} displayTitle - Netflix display title (search key)
     * @param {string|null} imdbId - IMDb ID for short-circuit optimization
     * @param {Object} data - Title data without displayTitle
     * @param {number|null} expires - Expiry timestamp or null for never expires
     */
    constructor(displayTitle, imdbId, data, expires) {
        this.#displayTitle = displayTitle;
        this.#imdbId = imdbId;
        this.#data = data;
        this.#expires = expires;
    }

    get displayTitle() {
        return this.#displayTitle;
    }

    get imdbId() {
        return this.#imdbId;
    }

    get isExpired() {
        return this.#expires !== null && Date.now() > this.#expires;
    }

    /**
     * Reconstructs the full Title from cache data.
     * @returns {Title|null} Hydrated Title, or null if data is missing
     */
    getTitle() {
        if (!this.#data) return null;
        return Title.fromCacheJSON(this.#data, this.#displayTitle);
    }

    /**
     * Deserializes from JSON storage format.
     * @param {string} raw - Raw JSON string from storage
     * @returns {CacheEntry} New CacheEntry instance
     */
    static fromJSON(raw) {
        const obj = JSON.parse(raw);
        return new CacheEntry(obj.displayTitle, obj.imdbId, obj.data, obj.expires);
    }

    /**
     * Serializes to JSON storage format.
     * @returns {Object} Plain object for JSON serialization
     */
    toJSON() {
        return {
            displayTitle: this.#displayTitle,
            imdbId: this.#imdbId,
            data: this.#data,
            expires: this.#expires,
        };
    }
}

/**
 * @typedef {Object} LegacyCacheEntry
 * @property {import('./title.js').TitleOptions} data - Serialized Title fields.
 * @property {number|null} expires - Unix timestamp in milliseconds, or `null` when the entry never expires.
 */

export class CacheManager {
    #prefix = 'fmc:';
    #adapter;
    #config;
    #logger;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter - Persistent storage provider.
     * @param {import('./config-manager.js').ConfigManager} config - TTL configuration provider.
     * @param {import('./logger.js').Logger} logger - Corrupt-entry diagnostics sink.
     */
    constructor(adapter, config, logger) {
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    /**
     * Reads a cache entry by display title. Returns a CacheEntry for both
     * hits and expired entries (which may be used for short-circuit refresh).
     *
     * @param {string} displayTitle - Streaming-service title used to derive the cache key.
     * @param {string} activeSource - API source currently selected for lookups.
     * @returns {Promise<CacheEntry|null>} Cache entry, or null for a complete cache miss.
     */
    async read(displayTitle, activeSource) {
        const key = this.#getCacheKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            const entry = CacheEntry.fromJSON(raw);
            const titleObj = entry.getTitle();
            // For non-expired entries, validate against active source
            if (!entry.isExpired) {
                if (!titleObj || (!titleObj.hasRating && titleObj.source !== activeSource)) return null;
            }
            return entry;
        } catch {
            this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle });
            return null;
        }
    }

    #getCacheKey(displayTitle) {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    /**
     * Persists a Title as a CacheEntry using the TTL selected from its
     * rating and release year. Stores displayTitle and imdbId at the top
     * level, with Title data (excluding displayTitle) in the data field.
     *
     * @param {string} displayTitle - Streaming-service title used to derive the cache key.
     * @param {Title} titleObj - Title to serialize.
     * @returns {Promise<void>}
     */
    async write(displayTitle, titleObj) {
        const key = this.#getCacheKey(displayTitle);
        const now = Date.now();
        const ttl = this.#calculateTtl(titleObj);
        const entry = new CacheEntry(
            displayTitle,
            titleObj.imdbId,
            titleObj.toCacheJSON(),
            ttl === Infinity ? null : now + ttl
        );
        await this.#adapter.storageSet(key, JSON.stringify(entry));
    }

    #calculateTtl(titleObj) {
        const getTtlMs = days => (days === CACHE_TTL_INFINITE ? Infinity : days * DAYS_TO_MS);
        if (!titleObj.hasRating) return getTtlMs(this.#config.getInt('cacheTtlNoRating'));
        if (!titleObj.year) return getTtlMs(this.#config.getInt('cacheTtlRatedNewYear'));
        const currentYear = new Date().getFullYear();
        const isOldRelease = currentYear - titleObj.year > 1;
        const ttlDays = isOldRelease
            ? this.#config.getInt('cacheTtlRatedOldYear')
            : this.#config.getInt('cacheTtlRatedNewYear');
        return getTtlMs(ttlDays);
    }

    async clear() {
        const keys = await this.#adapter.storageGetKeys(this.#prefix);
        const count = keys.length;
        await Promise.all(keys.map(key => this.#adapter.storageDelete(key)));
        this.#logger.debug(`Cache cleared: removed ${count} entr${count === 1 ? 'y' : 'ies'}`);
    }
}

export { CacheEntry };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/core/cache.test.js -t "CacheEntry" -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Update existing cache tests to work with new return type**

Some existing tests in `cache.test.js` expect `read()` to return a `Title` directly. Update these to work with `CacheEntry`:

```javascript
// In tests/unit/core/cache.test.js - update existing tests

// Change from: expect(result).toBeNull(); (for cache miss - this is fine)
// Change tests that expect Title to use entry.getTitle()

it('should return valid entry for non-expired cache', async () => {
    const titleData = { displayTitle: 'Test Title', year: 2026, imdbRating: '8.0' };
    const titleObj = new Title(titleData);
    // Write new format
    const entry = new CacheEntry('Test Title', null, titleObj.toCacheJSON(), Date.now() + 10000);
    adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
    const result = await cacheManager.read('Test Title', 'agregarr');
    expect(result).not.toBeNull();
    const title = result.getTitle();
    expect(title.displayTitle).toEqual('Test Title');
    expect(title.year).toEqual(2026);
});

it('should return null for expired cache', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const titleData = { displayTitle: 'Old Title', year: 2020 };
    const titleObj = new Title(titleData);
    const entry = new CacheEntry('Old Title', null, titleObj.toCacheJSON(), now - 1000);
    adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
    const result = await cacheManager.read('Old Title', 'agregarr');
    expect(result).not.toBeNull();
    expect(result.isExpired).toBe(true);
    vi.useRealTimers();
});

// Update: store indefinite TTL test
it('should store indefinite TTL as null in storage', async () => {
    const titleData = { displayTitle: 'Indefinite Title', hasRating: true, year: 1900 };
    const titleObj = new Title(titleData);
    config.getInt = vi.fn().mockReturnValue(-1);
    await cacheManager.write('Indefinite Title', titleObj);
    const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:indefinite_title');
    const entry = JSON.parse(setCall[1]);
    expect(entry.expires).toBeNull();
});
```

- [ ] **Step 6: Run all cache tests to verify they pass**

Run: `npx vitest tests/unit/core/cache.test.js -v`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add src/core/cache.js tests/unit/core/cache.test.js
git commit -m "feat(cache): add CacheEntry class with displayTitle and imdbId at top level

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 3: ApiClientManager Short-Circuit Logic

**Files:**

- Modify: `src/core/api-manager.js`
- Test: `tests/unit/core/api-manager.test.js`

**Interfaces:**

- Consumes: `CacheEntry` from Task 2
- Consumes: `client.fetch(displayTitle, imdbId?)` - will be added in Task 4
- Produces: Short-circuit path for expired entries with imdbId

- [ ] **Step 1: Write the failing tests for short-circuit behavior**

```javascript
// tests/unit/core/api-manager.test.js - add to existing file

describe('ApiClientManager cache refresh optimization', () => {
    it('should use short-circuit fetch when cache entry is expired with imdbId', async () => {
        const mockEntry = {
            displayTitle: 'Cached Movie',
            imdbId: 'tt123',
            isExpired: true,
            getTitle: () => null,
        };
        const mockCache = { read: vi.fn().mockResolvedValue(mockEntry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Cached Movie', imdbId: 'tt123' })),
        };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        await manager.getData('Cached Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Cached Movie', 'tt123');
    });

    it('should use full fetch when cache entry is expired without imdbId', async () => {
        const mockEntry = {
            displayTitle: 'No ID Movie',
            imdbId: null,
            isExpired: true,
            getTitle: () => null,
        };
        const mockCache = { read: vi.fn().mockResolvedValue(mockEntry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'No ID Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        await manager.getData('No ID Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('No ID Movie');
        expect(mockClient.fetch).not.toHaveBeenCalledWith('No ID Movie', null);
    });

    it('should return cached title for valid non-expired entry', async () => {
        const titleObj = new Title({
            displayTitle: 'Fresh Movie',
            apiTitle: 'Fresh Movie',
            imdbId: 'tt456',
            imdbRating: '8.0',
        });
        const mockEntry = {
            displayTitle: 'Fresh Movie',
            imdbId: 'tt456',
            isExpired: false,
            getTitle: () => titleObj,
        };
        const mockCache = { read: vi.fn().mockResolvedValue(mockEntry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn(),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        const result = await manager.getData('Fresh Movie');
        expect(result).toEqual(titleObj);
        expect(mockClient.fetch).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/core/api-manager.test.js -t "cache refresh" -v`
Expected: FAIL - ApiClientManager doesn't handle CacheEntry yet

- [ ] **Step 3: Update ApiClientManager to handle CacheEntry**

```javascript
// src/core/api-manager.js - update getData method

import { Title } from './title.js';

export class ApiClientManager {
    #cache;
    #client;
    #disabledManager;
    #logger;

    /**
     * @param {import('./cache.js').CacheManager} cache
     * @param {import('./disabled-clients.js').DisabledClientsManager} disabledManager
     * @param {import('./api-clients.js').BaseApiClient} client
     * @param {import('./logger.js').Logger} logger
     */
    constructor(cache, disabledManager, client, logger) {
        this.#cache = cache;
        this.#disabledManager = disabledManager;
        this.#client = client;
        this.#logger = logger;
    }

    /**
     * Resolves rating data from cache or the configured client. Failed lookups return a
     * not-found Title; client errors with a 4xx status disable that client.
     *
     * @param {string} displayTitle
     * @returns {Promise<Title>}
     */
    async getData(displayTitle) {
        const source = this.#client.source;
        const entry = await this.#cache.read(displayTitle, source);

        // Cache hit: non-expired entry with valid title
        if (entry && !entry.isExpired) {
            const titleObj = entry.getTitle();
            if (titleObj && (titleObj.hasRating || titleObj.source === source)) {
                return titleObj;
            }
            return Title.notFound(displayTitle, source);
        }

        // Expired entry with imdbId: short-circuit to getDetails
        if (entry?.imdbId) {
            return await this.#fetchWithHint(displayTitle, entry.imdbId);
        }

        // Cache miss or expired without imdbId: full fetch
        return await this.#fetch(displayTitle);
    }

    async #fetch(displayTitle) {
        const status = await this.#client.getStatus();
        if (!status.healthy) {
            return Title.notFound(displayTitle, this.#client.source);
        }

        try {
            const data = await this.#client.fetch(displayTitle);
            if (!data) {
                const notFound = Title.notFound(displayTitle, this.#client.source);
                await this.#cache.write(displayTitle, notFound);
                return notFound;
            }
            await this.#cache.write(displayTitle, data);
            this.#logger.debug(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}`);
            return data;
        } catch (err) {
            const isHttpError = Number.isInteger(err.status) && err.status >= 400;
            if (isHttpError && err.status < 500) {
                await this.#client.disable();
            }
            this.#logger[isHttpError ? 'error' : 'warn'](
                `Failed to fetch ratings for "${displayTitle}": ${err.message}`,
                { url: err.url ?? null, status: err.status ?? null, body: err.body ?? null }
            );
            return Title.notFound(displayTitle, this.#client.source);
        }
    }

    async #fetchWithHint(displayTitle, imdbId) {
        const status = await this.#client.getStatus();
        if (!status.healthy) {
            return Title.notFound(displayTitle, this.#client.source);
        }

        try {
            const data = await this.#client.fetch(displayTitle, imdbId);
            if (!data) {
                const notFound = Title.notFound(displayTitle, this.#client.source);
                await this.#cache.write(displayTitle, notFound);
                return notFound;
            }
            await this.#cache.write(displayTitle, data);
            this.#logger.debug(`Refreshed ratings for "${displayTitle}" from ${data.source}`);
            return data;
        } catch (err) {
            const isHttpError = Number.isInteger(err.status) && err.status >= 400;
            if (isHttpError && err.status < 500) {
                await this.#client.disable();
            }
            this.#logger[isHttpError ? 'error' : 'warn'](
                `Failed to refresh ratings for "${displayTitle}": ${err.message}`,
                { url: err.url ?? null, status: err.status ?? null, body: err.body ?? null }
            );
            return Title.notFound(displayTitle, this.#client.source);
        }
    }

    async resetDisabledClients() {
        const reenabled = await this.#disabledManager.resetAll();
        if (reenabled.length > 0) {
            this.#logger.info(`Re-enabled API clients: ${reenabled.join(', ')}`);
        } else {
            this.#logger.info('No disabled API clients found to re-enable');
        }
        return reenabled;
    }

    get disabledManager() {
        return this.#disabledManager;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/core/api-manager.test.js -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "feat(api-manager): add short-circuit fetch path for expired cache with imdbId

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 4: BaseApiClient and OMDb Client Updates

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Produces: `BaseApiClient.fetch(displayTitle, imdbId?)` - optional imdbId parameter
- Produces: `OMDbApiClient.getDetails()` - handles minimal Title with only imdbId

- [ ] **Step 1: Write the failing tests for short-circuit fetch**

```javascript
// tests/unit/core/api-clients.test.js - add to existing file or create new

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseApiClient, OmdApiClient } from '../../src/core/api-clients.js';
import { Title } from '../../src/core/title.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createConfig } from '../mocks/config.js';
import { createMockLogger } from '../mocks/logger.js';

describe('BaseApiClient short-circuit fetch', () => {
    let adapter;
    let disabledManager;
    let config;
    let logger;
    let client;

    beforeEach(() => {
        adapter = createMockAdapter({
            storageGet: vi.fn(),
            storageSet: vi.fn(),
        });
        disabledManager = { isDisabled: vi.fn().mockResolvedValue(false), disable: vi.fn() };
        config = createConfig({});
        logger = createMockLogger();
    });

    it('should skip search when imdbId is provided', async () => {
        class TestClient extends BaseApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super(new RequestQueue(0, null, adapter), 'test', disabledManager, adapter, config, logger);
            }
            async search() {
                this.searchCalled = true;
                return new Title({ displayTitle: 'Test', imdbId: 'tt123' });
            }
            async getDetails(searchTitle) {
                this.getDetailsCalled = true;
                return new Title({ ...searchTitle, imdbRating: '8.0' });
            }
        }
        client = new TestClient();
        const result = await client.fetch('Test Movie', 'tt123');
        expect(client.searchCalled).toBe(false);
        expect(client.getDetailsCalled).toBe(true);
        expect(result.imdbRating).toBe(8.0);
    });

    it('should call search when imdbId is not provided', async () => {
        class TestClient extends BaseApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super(new RequestQueue(0, null, adapter), 'test', disabledManager, adapter, config, logger);
            }
            async search(displayTitle) {
                this.searchCalled = true;
                return new Title({ displayTitle, imdbId: 'tt123' });
            }
            async getDetails(searchTitle) {
                this.getDetailsCalled = true;
                return new Title({ ...searchTitle, imdbRating: '8.0' });
            }
        }
        client = new TestClient();
        const result = await client.fetch('Test Movie');
        expect(client.searchCalled).toBe(true);
        expect(client.getDetailsCalled).toBe(true);
        expect(result.imdbRating).toBe(8.0);
    });
});

describe('OMDbApiClient getDetails with minimal Title', () => {
    it('should fetch by ID when given minimal Title', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            Response: 'True',
            imdbID: 'tt1234567',
            Title: 'Test Movie',
            Year: '2024',
            imdbRating: '8.5',
            imdbVotes: '1000',
            Ratings: [],
            Type: 'movie',
        });
        adapter.httpFetch = mockFetch;
        config.get = vi.fn().mockReturnValue('test-api-key');

        const client = new OmdApiClient(disabledManager, adapter, config, logger);
        const minimalTitle = new Title({ displayTitle: 'Test', imdbId: 'tt1234567' });
        const result = await client.getDetails(minimalTitle);

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('i=tt1234567'), expect.anything());
        expect(result.imdbId).toBe('tt1234567');
        expect(result.imdbRating).toBe(8.5);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/core/api-clients.test.js -t "short-circuit" -v`
Expected: FAIL - fetch doesn't accept imdbId parameter yet

- [ ] **Step 3: Update BaseApiClient.fetch() to accept optional imdbId**

```javascript
// src/core/api-clients.js - update BaseApiClient.fetch method

// In BaseApiClient class, update the fetch method:

    /**
     * Fetches ratings for a streaming-service title through the search -> details pipeline.
     * Callers must gate through {@link getStatus} before invoking.
     *
     * @param {string} displayTitle - Title as shown by the streaming service.
     * @param {string|null} [imdbId=null] - Optional IMDb ID for short-circuiting search.
     * @returns {Promise<import('./title.js').Title|null>} Hydrated `Title` with ratings, or `null` if the
     *   title was not found.
     */
    async fetch(displayTitle, imdbId = null) {
        // Short-circuit: if imdbId provided, skip search and go straight to getDetails
        if (imdbId) {
            const minimalTitle = new Title({ displayTitle, imdbId });
            if (await this.isDisabled()) return null;
            const detailedTitle = await this.getDetails(minimalTitle);
            if (!detailedTitle) return null;
            return detailedTitle.withSource(this.#source);
        }

        // Standard flow: search then details
        const searchTitle = await this.search(displayTitle);
        if (!searchTitle) return null;
        if (await this.isDisabled()) return null;
        const detailedTitle = await this.getDetails(searchTitle);
        if (!detailedTitle) return null;
        return detailedTitle.withSource(this.#source);
    }
```

- [ ] **Step 4: Update OMDbApiClient.getDetails() to handle minimal Title**

```javascript
// src/core/api-clients.js - update OMDbApiClient.getDetails method

    async getDetails(searchTitle) {
        // If we have an imdbId, fetch by ID; otherwise use the standard search-based flow
        // Note: searchTitle may be a minimal Title with only displayTitle and imdbId
        const id = searchTitle.imdbId;
        if (id) {
            const apiKey = this.config.get('omdbApiKey');
            const params = new URLSearchParams({ apikey: apiKey, i: id });
            this.logger?.debug(`Fetching OMDb details by ID: ${id} ("${searchTitle.displayTitle}")`);
            const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
            if (json.Response === 'False') {
                this.logger?.info(`No OMDb results found for ID: ${id}`);
                return null;
            }
            const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
            const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
            const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replaceAll(',', ''), 10) : null;
            return new Title({
                displayTitle: searchTitle.displayTitle,
                apiTitle: apiTitle ?? null,
                imdbId: imdbID ?? id,
                year: releaseYear,
                imdbRating,
                imdbVotes: votes,
                rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
                mcRating: parseRatings(Ratings, /Metacritic/i),
                type: this.#mapTitleType(apiType),
                source: null,
            });
        }
        // Standard pass-through: OMDb search already fetched all details
        return searchTitle;
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest tests/unit/core/api-clients.test.js -v`
Expected: PASS (all tests including new ones)

- [ ] **Step 6: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "feat(api-clients): add imdbId short-circuit to fetch and OMDb ID lookup

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 5: Cache Migration

**Files:**

- Modify: `src/core/migrations.js`
- Test: `tests/unit/core/migrations.test.js`

**Interfaces:**

- Consumes: Existing migration infrastructure
- Produces: New migration version for cache format change

- [ ] **Step 1: Write the migration**

```javascript
// src/core/migrations.js - add new migration at the end of MIGRATIONS array

// Add import for CacheEntry if needed, or use inline transformation

// Assuming existing migrations end with version 1, add version 2:

const MIGRATIONS = [
    // ... existing migrations ...
    {
        version: 2,
        description: 'Pull displayTitle and imdbId to cache entry top level',
        async migrate(adapter, logger) {
            const prefix = 'fmc:';
            const keys = await adapter.storageGetKeys(prefix);
            let migrated = 0;

            for (const key of keys) {
                try {
                    const raw = await adapter.storageGet(key);
                    if (!raw) continue;

                    const entry = JSON.parse(raw);

                    // Legacy format: { data: Title, expires: number }
                    // New format: { displayTitle, imdbId, data: TitleWithoutDisplayTitle, expires }

                    if (entry.displayTitle && entry.imdbId) {
                        // Already migrated
                        continue;
                    }

                    // Extract displayTitle from legacy data
                    const titleData = entry.data;
                    const displayTitle = titleData?.displayTitle ?? null;
                    const imdbId = titleData?.imdbId ?? null;

                    if (displayTitle === null) {
                        logger?.warn('Skipping migration: no displayTitle in entry', { key });
                        continue;
                    }

                    // Create new format: extract displayTitle and imdbId to top level
                    // Remove displayTitle from data
                    const { displayTitle: _, ...dataWithoutDisplayTitle } = titleData;

                    const newEntry = {
                        displayTitle,
                        imdbId,
                        data: dataWithoutDisplayTitle,
                        expires: entry.expires,
                    };

                    await adapter.storageSet(key, JSON.stringify(newEntry));
                    migrated++;
                } catch (err) {
                    logger?.error('Failed to migrate cache entry', { key, error: err.message });
                }
            }

            logger?.info(`Migrated ${migrated} cache entries to version 2 format`);
            return migrated;
        },
        async recover(adapter, logger) {
            // Recovery: migrate back is not feasible; clear and warn
            logger?.error('Cache migration version 2 recovery: clearing cache');
            const prefix = 'fmc:';
            const keys = await adapter.storageGetKeys(prefix);
            await Promise.all(keys.map(key => adapter.storageDelete(key)));
            return keys.length;
        },
    },
];
```

- [ ] **Step 2: Write tests for the migration**

```javascript
// tests/unit/core/migrations.test.js - add to existing file or create new

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS, runMigrations } from '../../../src/core/migrations.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('Cache format migration (version 2)', () => {
    let adapter;
    let logger;

    beforeEach(() => {
        adapter = createMockAdapter({
            storageGet: vi.fn(),
            storageGetKeys: vi.fn(),
            storageSet: vi.fn(),
            storageDelete: vi.fn(),
        });
        logger = createMockLogger();
    });

    it('should migrate legacy cache entry to new format', async () => {
        const legacyEntry = {
            data: {
                displayTitle: 'Legacy Movie',
                apiTitle: 'Legacy Movie',
                imdbId: 'tt999',
                year: 2020,
                imdbRating: '7.5',
                imdbVotes: null,
                rtRating: null,
                mcRating: null,
                source: null,
                type: null,
            },
            expires: Date.now() + 100000,
        };

        adapter.storageGet.mockImplementation(key => {
            if (key === 'fmc:legacy_movie') return Promise.resolve(JSON.stringify(legacyEntry));
            return Promise.resolve(null);
        });
        adapter.storageGetKeys.mockResolvedValue(['fmc:legacy_movie']);

        const migration = MIGRATIONS.find(m => m.version === 2);
        await migration.migrate(adapter, logger);

        expect(adapter.storageSet).toHaveBeenCalledWith(
            'fmc:legacy_movie',
            JSON.stringify({
                displayTitle: 'Legacy Movie',
                imdbId: 'tt999',
                data: {
                    apiTitle: 'Legacy Movie',
                    imdbId: 'tt999',
                    year: 2020,
                    imdbRating: '7.5',
                    imdbVotes: null,
                    rtRating: null,
                    mcRating: null,
                    source: null,
                    type: null,
                },
                expires: legacyEntry.expires,
            })
        );
    });

    it('should skip already migrated entries', async () => {
        const newFormatEntry = {
            displayTitle: 'New Format Movie',
            imdbId: 'tt888',
            data: { apiTitle: 'New Format Movie', imdbId: 'tt888', year: 2023 },
            expires: Date.now() + 100000,
        };

        adapter.storageGet.mockImplementation(key => {
            if (key === 'fmc:new_format_movie') return Promise.resolve(JSON.stringify(newFormatEntry));
            return Promise.resolve(null);
        });
        adapter.storageGetKeys.mockResolvedValue(['fmc:new_format_movie']);
        adapter.storageSet.mockClear();

        const migration = MIGRATIONS.find(m => m.version === 2);
        await migration.migrate(adapter, logger);

        expect(adapter.storageSet).not.toHaveBeenCalled();
    });

    it('should skip entries without displayTitle', async () => {
        const badEntry = {
            data: { apiTitle: 'No Display', imdbId: 'tt777' },
            expires: Date.now() + 100000,
        };

        adapter.storageGet.mockImplementation(key => {
            if (key === 'fmc:bad_entry') return Promise.resolve(JSON.stringify(badEntry));
            return Promise.resolve(null);
        });
        adapter.storageGetKeys.mockResolvedValue(['fmc:bad_entry']);
        adapter.storageSet.mockClear();

        const migration = MIGRATIONS.find(m => m.version === 2);
        await migration.migrate(adapter, logger);

        expect(adapter.storageSet).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest tests/unit/core/migrations.test.js -v`
Expected: PASS (all migration tests)

- [ ] **Step 4: Commit**

```bash
git add src/core/migrations.js tests/unit/core/migrations.test.js
git commit -m "feat(migrations): add v2 migration for cache format with displayTitle and imdbId at top level

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 6: Integration and Full Test Suite

**Files:**

- All modified files from Tasks 1-5

**Interfaces:**

- Consumes: All previous tasks

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`
Expected: PASS (all existing and new tests)

- [ ] **Step 2: Run linting**

Run: `npm run lint`
Expected: PASS (no lint errors)

- [ ] **Step 3: Run formatting check**

Run: `npm run format:check`
Expected: PASS

- [ ] **Step 4: Build all targets**

Run: `npm run build`
Expected: All three targets (userscript, firefox, chrome) build successfully

- [ ] **Step 5: Commit final integration**

```bash
git add package-lock.json  # if lockfile changed from new test deps
git commit -m "chore: verify cache refresh optimization integration

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Plan Self-Review

**1. Spec coverage:**

- Cache structure with displayTitle and imdbId at top level: Task 2
- CacheEntry class: Task 2
- Title serialization methods: Task 1
- ApiClientManager short-circuit: Task 3
- API client fetch with imdbId: Task 4
- OMDb getDetails by ID: Task 4
- Migration: Task 5
- Testing: All tasks include tests

**2. Placeholder scan:** No TBDs, TODOs, or incomplete steps found

**3. Type consistency:** All method signatures and property names are consistent across tasks

**4. Dependencies:** Tasks are ordered correctly - each consumes interfaces from previous tasks

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-15-cache-refresh-optimization-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
