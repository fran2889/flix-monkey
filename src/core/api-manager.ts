/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ApiClient } from './api/base-api-client';
import type { CacheEntry, CacheStore } from './cache/index';
import type { DisabledClientsManager } from './disabled-clients';
import type { Logger } from './logger';
import { Title } from './title';

/**
 * Manages API clients, caching, and coordinates fetching rating data.
 */
export class ApiClientManager {
    readonly #cache: CacheStore;
    readonly #client: ApiClient;
    readonly #disabledManager: DisabledClientsManager;
    readonly #logger: Logger;

    constructor(logger: Logger, cache: CacheStore, disabledManager: DisabledClientsManager, client: ApiClient) {
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
        const entry: CacheEntry | undefined = await this.#cache.read(displayTitle);

        if (entry && !entry.isExpired) {
            const titleObj: Title | undefined = entry.getTitle();
            if (titleObj && (titleObj.hasRating || titleObj.source === source)) {
                this.#logger.debug(`Cache hit for "${displayTitle}" from ${titleObj.source}`);
                return titleObj;
            }
        }

        if (entry?.imdbId) {
            this.#logger.debug(`Using cached IMDb ID ${entry.imdbId} for "${displayTitle}"`);
            return this.#fetch(displayTitle, entry.imdbId);
        }

        return this.#fetch(displayTitle);
    }

    async #fetch(displayTitle: string, imdbId?: string): Promise<Title> {
        const status = await this.#client.getStatus();
        if (!status.healthy) {
            return Title.notFound(displayTitle, this.#client.source);
        }

        try {
            const data: Title | undefined = await this.#client.fetch(displayTitle, imdbId);
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
                url?: string | undefined;
                status?: number | undefined;
                body?: string | undefined;
            };
            const httpStatus = error.status;
            const isHttpError = httpStatus !== undefined && Number.isInteger(httpStatus) && httpStatus >= 400;
            if (isHttpError && httpStatus < 500) {
                await this.#client.disable();
            }
            this.#logger[isHttpError ? 'error' : 'warn'](
                `Failed to fetch ratings for "${displayTitle}": ${error.message ?? ''}`,
                { url: error.url, status: error.status, body: error.body }
            );
            return Title.notFound(displayTitle, this.#client.source);
        }
    }

    get disabledManager(): DisabledClientsManager {
        return this.#disabledManager;
    }
}
