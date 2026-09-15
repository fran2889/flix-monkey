/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from './title.js';

/** @typedef {import('./cache.js').CacheEntry} CacheEntry */

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
