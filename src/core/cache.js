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
     * @returns {Promise<CacheEntry|null>} Cache entry, or null for a complete cache miss.
     */
    async read(displayTitle) {
        const key = this.#getCacheKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            const entry = CacheEntry.fromJSON(raw);
            // Always return entry; ApiClientManager handles validation and short-circuit logic
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
