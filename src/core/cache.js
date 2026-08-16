/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { slugify } from './utils.js';

/**
 * @typedef {Object} CacheEntry
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
     * Reads a non-expired cached title. Cached lookup misses are valid only when
     * they were produced by the currently active API source.
     *
     * @param {string} displayTitle - Streaming-service title used to derive the cache key.
     * @param {string} activeSource - API source currently selected for lookups.
     * @returns {Promise<Title|null>} Hydrated title, or `null` for a miss, expiry, or corrupt entry.
     */
    async read(displayTitle, activeSource) {
        const key = this.#getCacheKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            /** @type {CacheEntry} */
            const entry = JSON.parse(raw);
            const expired = entry.expires !== null && Date.now() > entry.expires;
            if (expired) return null;
            const titleObj = Title.fromJSON(entry.data);
            if (!titleObj || (!titleObj.hasRating && titleObj.source !== activeSource)) return null;
            return titleObj;
        } catch {
            this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle });
            return null;
        }
    }

    #getCacheKey(displayTitle) {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    /**
     * Persists a Title as a JSON CacheEntry using the TTL selected from its
     * rating and release year.
     *
     * @param {string} displayTitle - Streaming-service title used to derive the cache key.
     * @param {Title} titleObj - Title to serialize.
     * @returns {Promise<void>}
     */
    async write(displayTitle, titleObj) {
        const key = this.#getCacheKey(displayTitle);
        const now = Date.now();
        const ttl = this.#calculateTtl(titleObj);
        const entry = {
            data: titleObj,
            expires: ttl === Infinity ? null : now + ttl,
        };
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
