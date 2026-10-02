/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from '../constants.js';
import { slugify } from '../utils.js';
import { CacheEntry } from './cache-entry.js';

export class CacheManager {
    #prefix = 'fmc:';
    #adapter;
    #config;
    #logger;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter - Persistent storage provider.
     * @param {import('../config-manager.js').ConfigManager} config - TTL configuration provider.
     * @param {import('../logger.js').Logger} logger - Corrupt-entry diagnostics sink.
     */
    constructor(adapter, config, logger) {
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    // Public methods in call order

    /**
     * Reads a cache entry by display title. Returns a CacheEntry for both
     * hits and expired entries (which may be used for short-circuit refresh).
     * Returns null for complete cache misses or corrupt entries.
     *
     * @param {string} displayTitle - Streaming-service title used to derive the cache key.
     * @returns {Promise<CacheEntry|null>} Cache entry (including expired), or null for miss/corrupt.
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
     * @param {import('../title.js').Title} titleObj - Title to serialize.
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

    /**
     * Deletes a single cache entry by display title.
     *
     * @param {string} displayTitle - Streaming-service title used to derive the cache key.
     * @returns {Promise<void>}
     */
    async delete(displayTitle) {
        const key = this.#getCacheKey(displayTitle);
        await this.#adapter.storageDelete(key);
        this.#logger.debug(`Cache entry deleted: ${key}`);
    }
}
