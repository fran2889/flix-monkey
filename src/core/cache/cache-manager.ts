/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { ConfigManager } from '../config/config-manager';
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from '../constants';
import type { Logger } from '../logger';
import type { Title } from '../title';
import { slugify } from '../utils/index';
import { CacheEntry } from './cache-entry';

/**
 * Cache read and write operations required by consumers such as ApiClientManager.
 */
export interface CacheStore {
    /**
     * Reads a cache entry by display title.
     *
     * @param displayTitle - Title as shown by the streaming service.
     * @returns Cache entry, including expired entries for short-circuit refresh, or undefined on a miss or a corrupt entry.
     */
    read(displayTitle: string): Promise<CacheEntry | undefined>;

    /**
     * Persists a title using the TTL selected from its rating and release year.
     *
     * @param displayTitle - Title as shown by the streaming service.
     * @param titleObj - Title data to serialize.
     * @returns Promise that resolves when the entry has been stored.
     */
    write(displayTitle: string, titleObj: Title): Promise<void>;
}

/**
 * Manages cached title data with configurable TTL based on rating and release year.
 */
export class CacheManager implements CacheStore {
    readonly #prefix = 'fmc:';
    readonly #adapter: PlatformAdapter;
    readonly #config: ConfigManager;
    readonly #logger: Logger;

    constructor(adapter: PlatformAdapter, config: ConfigManager, logger: Logger) {
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    async read(displayTitle: string): Promise<CacheEntry | undefined> {
        const key = this.#getCacheKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return undefined;
        try {
            // Always return entry; ApiClientManager handles validation and short-circuit logic
            return CacheEntry.fromJSON(raw as string);
        } catch {
            this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle });
            return undefined;
        }
    }

    #getCacheKey(displayTitle: string): string {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    async write(displayTitle: string, titleObj: Title): Promise<void> {
        const key = this.#getCacheKey(displayTitle);
        const now = Date.now();
        const ttl = this.#calculateTtl(titleObj);
        const entry = new CacheEntry(
            displayTitle,
            titleObj.imdbId,
            titleObj.toCacheJSON(),
            ttl === Infinity ? undefined : now + ttl
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
     * @returns Resolves when every cached entry has been removed.
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
     * @returns Resolves when the entry has been removed.
     */
    async delete(displayTitle: string): Promise<void> {
        const key = this.#getCacheKey(displayTitle);
        await this.#adapter.storageDelete(key);
        this.#logger.debug(`Cache entry deleted: ${key}`);
    }
}
