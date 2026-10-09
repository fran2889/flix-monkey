/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { BaseApiClient } from './api/base-api-client.js';
import type { CacheEntry, CacheManager } from './cache/index.js';
import type { DisabledClientsManager } from './disabled-clients.js';
import type { Logger } from './logger.js';
import { Title } from './title.js';

/**
 * Manages API clients, caching, and coordinates fetching rating data.
 */
export class ApiClientManager {
    #cache: CacheManager;
    #client: BaseApiClient;
    #disabledManager: DisabledClientsManager;
    #logger: Logger;

    /**
     * @param logger - Logger instance for debug/error messages
     * @param cache - Cache manager for reading/writing cache entries
     * @param disabledManager - Manager for tracking disabled API clients
     * @param client - API client instance for fetching data
     */
    constructor(logger: Logger, cache: CacheManager, disabledManager: DisabledClientsManager, client: BaseApiClient) {
        this.#cache = cache;
        this.#disabledManager = disabledManager;
        this.#client = client;
        this.#logger = logger;
    }

    /**
     * Resolves rating data from cache or the configured client. Failed lookups return a
     * not-found Title; client errors with a 4xx status disable that client.
     *
     * @param displayTitle - Title to look up
     * @returns Promise resolving to the Title object
     */
    async getData(displayTitle: string): Promise<Title> {
        const source: string = this.#client.source;
        const entry: CacheEntry | null = await this.#cache.read(displayTitle);

        if (entry && !entry.isExpired) {
            const titleObj: Title | null = entry.getTitle();
            if (titleObj && (titleObj.hasRating || titleObj.source === source)) {
                this.#logger.debug(`Cache hit for "${displayTitle}" from ${titleObj.source}`);
                return titleObj;
            }
        }

        if (entry?.imdbId) {
            this.#logger.debug(`Using cached IMDb ID ${entry.imdbId} for "${displayTitle}"`);
            return await this.#fetch(displayTitle, entry.imdbId);
        }

        return await this.#fetch(displayTitle);
    }

    async #fetch(displayTitle: string, imdbId: string | null = null): Promise<Title> {
        const status = await this.#client.getStatus();
        if (!status.healthy) {
            return Title.notFound(displayTitle, this.#client.source);
        }

        try {
            const data: Title | null = await this.#client.fetch(displayTitle, imdbId);
            if (!data) {
                const notFound: Title = Title.notFound(displayTitle, this.#client.source);
                await this.#cache.write(displayTitle, notFound);
                return notFound;
            }
            await this.#cache.write(displayTitle, data);
            this.#logger.debug(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}`);
            return data;
        } catch (err: unknown) {
            const error = err as {
                message?: string;
                url?: string | null;
                status?: number | null;
                body?: string | null;
            };
            const status = error.status;
            const isHttpError = status !== undefined && status !== null && Number.isInteger(status) && status >= 400;
            if (isHttpError && status < 500) {
                await this.#client.disable();
            }
            this.#logger[isHttpError ? 'error' : 'warn'](
                `Failed to fetch ratings for "${displayTitle}": ${error.message ?? ''}`,
                { url: error.url ?? null, status: error.status ?? null, body: error.body ?? null }
            );
            return Title.notFound(displayTitle, this.#client.source);
        }
    }

    /**
     * @returns DisabledClientsManager instance
     */
    get disabledManager(): DisabledClientsManager {
        return this.#disabledManager;
    }
}
