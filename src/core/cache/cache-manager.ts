/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { ConfigManager } from '../config/config-manager';
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from '../constants';
import type { Logger } from '../logger';
import { Title } from '../title';
import { slugify } from '../utils/index';
import { CacheEntry } from './cache-entry';

/**
 * Manages cached title data with configurable TTL based on rating and release year.
 */
export class CacheManager {
    readonly #prefix = 'fmc:';
    readonly #adapter: PlatformAdapter;
    readonly #config: ConfigManager;
    readonly #logger: Logger;

    /**
     * @param adapter - Persistent storage provider.
     * @param config - TTL configuration provider.
     * @param logger - Corrupt-entry diagnostics sink.
     */
    constructor(adapter: PlatformAdapter, config: ConfigManager, logger: Logger) {
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    /**
     * Reads a cache entry by display title. Returns a CacheEntry for both
     * hits and expired entries (which may be used for short-circuit refresh).
     * Returns null for complete cache misses or corrupt entries.
     *
     * @param displayTitle - Streaming-service title used to derive the cache key.
     * @returns Cache entry (including expired), or null for miss/corrupt.
     */
    async read(displayTitle: string): Promise<CacheEntry | null> {
        const key = this.#getCacheKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            // Always return entry; ApiClientManager handles validation and short-circuit logic
            return CacheEntry.fromJSON(raw as string);
        } catch {
            this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle });
            return null;
        }
    }

    #getCacheKey(displayTitle: string): string {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    /**
     * Persists a Title as a CacheEntry using the TTL selected from its
     * rating and release year. Stores displayTitle and imdbId at the top
     * level, with Title data (excluding displayTitle) in the data field.
     *
     * @param displayTitle - Streaming-service title used to derive the cache key.
     * @param titleObj - Title to serialize.
     * @returns {Promise<void>}
     */
    async write(displayTitle: string, titleObj: Title): Promise<void> {
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

    #calculateTtl(titleObj: Title): number {
        const getTtlMs = (days: number): number => (days === CACHE_TTL_INFINITE ? Infinity : days * DAYS_TO_MS);
        if (!titleObj.hasRating) {
            return getTtlMs(this.#config.getInt('cacheTtlNoRating'));
        }
        if (!titleObj.year) {
            return getTtlMs(this.#config.getInt('cacheTtlRatedNewYear'));
        }
        const currentYear = new Date().getFullYear();
        const isOldRelease = currentYear - titleObj.year > 1;
        const ttlDays = isOldRelease
            ? this.#config.getInt('cacheTtlRatedOldYear')
            : this.#config.getInt('cacheTtlRatedNewYear');
        return getTtlMs(ttlDays);
    }

    /**
     * Removes all cached title entries from storage.
     *
     * @returns {Promise<void>}
     */
    async clear(): Promise<void> {
        const keys = await this.#adapter.storageGetKeys(this.#prefix);
        const count = keys.length;
        await Promise.all(keys.map(async (key: string) => this.#adapter.storageDelete(key)));
        this.#logger.debug(`Cache cleared: removed ${count} entr${count === 1 ? 'y' : 'ies'}`);
    }

    /**
     * Removes a cached title entry by its display title.
     *
     * @param displayTitle - Streaming-service title used to derive the cache key.
     * @returns {Promise<void>}
     */
    async delete(displayTitle: string): Promise<void> {
        const key = this.#getCacheKey(displayTitle);
        await this.#adapter.storageDelete(key);
        this.#logger.debug(`Cache entry deleted: ${key}`);
    }
}
