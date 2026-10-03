/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CLIENT_DISABLE_DURATION } from '../constants.js';
import { Title } from '../title.js';

/**
 * @typedef {{healthy: true}|{healthy: false, reason: string}} ClientStatus
 */

/**
 * Abstract base class for API clients.
 *
 * Implements the template-method pattern: fetch orchestrates the
 * lookup by calling search (find a candidate) then getDetails
 * (hydrate ratings). Subclasses override those two methods for each provider.
 *
 * @abstract
 */
export class BaseApiClient {
    #queue;
    #source;
    #disabledManager;
    #adapter;
    #config;
    #logger;
    #overrideManager;

    /**
     * @param {import('../../platform/adapter.js').PlatformAdapter} adapter - Platform adapter for HTTP and storage.
     * @param {import('../config/config-manager.js').ConfigManager} config - Application configuration.
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
     * @param {import('../logger.js').Logger} logger - Logger instance when diagnostics are needed.
     * @param {import('../id-override-manager.js').IdOverrideManager} overrideManager - Manager for ID overrides.
     * @param {import('../request-queue.js').RequestQueue} queue - Rate-limited request queue for this client.
     * @param {import('../title.js').ApiSourceValue} source - ApiSource identifier.
     */
    constructor(adapter, config, disabledManager, logger, overrideManager, queue, source) {
        this.#adapter = adapter;
        this.#config = config;
        this.#disabledManager = disabledManager;
        this.#logger = logger;
        this.#overrideManager = overrideManager;
        this.#queue = queue;
        this.#source = source;
    }

    /**
     * Fetches ratings for a streaming-service title through the search -> details pipeline.
     * Callers must gate through getStatus before invoking.
     *
     * @param {string} displayTitle - Title as shown by the streaming service.
     * @param {string|null} [imdbId=null] - Optional IMDb ID for short-circuiting search.
     * @returns {Promise<import('../title.js').Title|null>} Hydrated Title with ratings, or null if not found.
     */
    async fetch(displayTitle, imdbId = null) {
        if (await this.#isDisabled()) {
            return null;
        }

        const overrideId = await this.#overrideManager.getImdbId(displayTitle);
        if (overrideId) {
            this.#logger?.debug(`Using override IMDb ID ${overrideId} for "${displayTitle}"`);
            const searchTitle = new Title({
                displayTitle,
                imdbId: overrideId,
            });
            const detailedTitle = await this.getDetails(searchTitle);
            if (detailedTitle) {
                return detailedTitle.withSource(this.#source);
            }
            return searchTitle.withSource(this.#source);
        }

        if (imdbId) {
            const minimalTitle = new Title({ displayTitle, imdbId });
            const detailedTitle = await this.getDetails(minimalTitle);
            if (!detailedTitle) return null;
            return detailedTitle.withSource(this.#source);
        }

        const searchTitle = await this.search(displayTitle);
        if (!searchTitle) return null;
        const detailedTitle = await this.getDetails(searchTitle);
        if (!detailedTitle) return null;
        return detailedTitle.withSource(this.#source);
    }

    /** @returns {Promise<ClientStatus>} A health result suitable for provider selection. */
    async getStatus() {
        if (await this.#isDisabled()) {
            return { healthy: false, reason: 'Temporarily disabled due to errors' };
        }
        return { healthy: true };
    }

    /**
     * Disables this client for {@link CLIENT_DISABLE_DURATION}, purges its queued
     * requests, and logs a warning.
     *
     * @returns {Promise<void>}
     * @note Requests still waiting in this client's queue are removed. An HTTP request already
     *   executing at the network level cannot be aborted and may still resolve after disable().
     */
    async disable() {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, CLIENT_DISABLE_DURATION);
        this.#logger?.warn(
            `${this.source} disabled for ${CLIENT_DISABLE_DURATION / 60000} min, purging ${count} queued request${count !== 1 ? 's' : ''}`
        );
    }

    /**
     * Enqueues an HTTP request through the rate-limited queue.
     *
     * @param {string} url - Request URL.
     * @param {number} [priority=0] - Higher values are processed first.
     * @returns {Promise<unknown>} Parsed response body.
     */
    async queuedFetch(url, priority = 0) {
        return this.#queue.enqueue(url, priority, requestUrl => this.#adapter.httpFetch(requestUrl));
    }

    async #isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    /**
     * Searches the API for a title matching the streaming-service display name.
     * Subclasses must override this method.
     *
     * @abstract
     * @param {string} _displayTitle - Title to search for.
     * @returns {Promise<import('../title.js').Title|null>} A Title with available metadata from search results.
     */
    async search(_displayTitle) {
        throw new Error('Not implemented');
    }

    /**
     * Fetches ratings and additional details for a title returned by search().
     * Subclasses must override this method.
     *
     * Implementations should merge searchTitle values as fallbacks:
     * - Use searchTitle fields (apiTitle, imdbId, year, type) when details fetch returns null/undefined
     * - Override with details fetch values when available
     *
     * @abstract
     * @param {import('../title.js').Title} _searchTitle - Title returned by search().
     * @returns {Promise<import('../title.js').Title|null>} A Title with ratings and details populated.
     */
    async getDetails(_searchTitle) {
        throw new Error('Not implemented');
    }

    get source() {
        return this.#source;
    }

    get config() {
        return this.#config;
    }

    get logger() {
        return this.#logger;
    }
}
