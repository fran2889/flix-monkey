/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from './title.js';

/** @typedef {import('./cache/index.js').CacheEntry} CacheEntry */

/**
 * Manages API clients, caching, and coordinates fetching rating data.
 */
export class ApiClientManager {
    #cache;
    #client;
    #disabledManager;
    #logger;

    /**
     * Creates a manager over the configured API client and its collaborators.
     *
     * @param {import('./logger.js').Logger} logger - Diagnostic sink for lookup and failure paths.
     * @param {import('./cache/index.js').CacheManager} cache - Title cache consulted before hitting the network.
     * @param {import('./disabled-clients.js').DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
     * @param {import('./api/base-api-client.js').BaseApiClient} client - Active provider used for lookups.
     */
    constructor(logger, cache, disabledManager, client) {
        this.#cache = cache;
        this.#disabledManager = disabledManager;
        this.#client = client;
        this.#logger = logger;
    }

    /**
     * Resolves rating data from cache or the configured client. Failed lookups return a
     * not-found Title; client errors with a 4xx status disable that client.
     *
     * @param {string} displayTitle - Title as shown by the streaming service.
     * @returns {Promise<Title>} Resolved Title, or a not-found Title when no rating exists.
     */
    async getData(displayTitle) {
        const source = this.#client.source;
        const entry = await this.#cache.read(displayTitle);

        if (entry && !entry.isExpired) {
            const titleObj = entry.getTitle();
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

    async #fetch(displayTitle, imdbId = null) {
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

    /**
     * Collaborator the app forwards to settings for cache and client resets.
     *
     * @returns {import('./disabled-clients.js').DisabledClientsManager} Tracks temporarily disabled clients.
     */
    get disabledManager() {
        return this.#disabledManager;
    }
}
