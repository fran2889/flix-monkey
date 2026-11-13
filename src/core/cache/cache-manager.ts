/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { ConfigManager } from '../config/config-manager';
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from '../constants';
import type { Logger } from '../logger';
import { ParseError } from '../parse-utils';
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
        if (raw === undefined) return undefined;

        try {
            return CacheEntry.fromJSON(raw);
        } catch (error: unknown) {
            if (!(error instanceof ParseError) && !(error instanceof SyntaxError)) throw error;
            this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle, error });
            await this.#deleteInvalid(key);
            return undefined;
        }
    }

    #getCacheKey(displayTitle: string): string {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    async #deleteInvalid(key: string): Promise<void> {
        try {
            await this.#adapter.storageDelete(key);
        } catch (error: unknown) {
            this.#logger.debug('Failed to delete corrupt cache entry', { key, error });
        }
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
     * Removes cached rating data. By default an entry that has a cached IMDb
     * ID keeps its ID and display title so the next lookup can skip the title
     * search, and an entry without an ID is removed. Passing true removes
     * every entry, including the cached IDs.
     *
     * @param clearIds - Whether to remove cached IMDb IDs along with the rating data.
     * @returns Resolves when every cached entry has been updated or removed.
     */
    async clear(clearIds: boolean = false): Promise<void> {
        const keys = await this.#adapter.storageGetKeys(this.#prefix);
        if (clearIds) {
            await Promise.all(keys.map(async (key: string) => this.#adapter.storageDelete(key)));
            this.#logger.debug(
                `Cache and cached IMDb IDs cleared: removed ${keys.length} entr${keys.length === 1 ? 'y' : 'ies'}`
            );
            return;
        }

        const removed = await Promise.all(keys.map(async (key: string) => this.#clearRatings(key)));
        const removedCount = removed.filter(Boolean).length;
        const keptCount = keys.length - removedCount;
        this.#logger.debug(
            `Cache cleared: kept cached IMDb IDs for ${keptCount} entr${keptCount === 1 ? 'y' : 'ies'}, removed ${removedCount}`
        );
    }

    /**
     * Clears one entry's rating data, keeping its IMDb ID when it has one.
     *
     * @param key - Storage key of the entry.
     * @returns True when the entry was removed instead of retained.
     */
    async #clearRatings(key: string): Promise<boolean> {
        const raw = await this.#adapter.storageGet(key);
        if (raw === undefined) {
            await this.#adapter.storageDelete(key);
            return true;
        }

        try {
            const retained = CacheEntry.fromJSON(raw).withoutRatings();
            if (!retained) {
                await this.#adapter.storageDelete(key);
                return true;
            }
            await this.#adapter.storageSet(key, JSON.stringify(retained));
            return false;
        } catch (error: unknown) {
            if (!(error instanceof ParseError) && !(error instanceof SyntaxError)) throw error;
            this.#logger.warn('Cache entry corrupt, removing entry', { key, error });
            await this.#deleteInvalid(key);
            return true;
        }
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
