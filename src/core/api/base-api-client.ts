/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { ClientStatus } from '../../types/api';
import type { ConfigManager } from '../config/config-manager';
import { type ApiSourceType, CLIENT_DISABLE_DURATION } from '../constants';
import type { DisabledClientsManager } from '../disabled-clients';
import type { IdOverrideManager } from '../id-override-manager';
import type { Logger } from '../logger';
import type { RequestQueue } from '../request-queue';
import { Title } from '../title';

/**
 * Abstract base class for API clients.
 *
 * Implements the template-method pattern: fetch orchestrates the
 * lookup by calling search (find a candidate) then getDetails
 * (hydrate ratings). Subclasses override those two methods for each provider.
 */
export abstract class BaseApiClient {
    readonly #queue: RequestQueue;
    readonly #source: ApiSourceType;
    readonly #disabledManager: DisabledClientsManager;
    readonly #adapter: PlatformAdapter;
    readonly #config: ConfigManager;
    readonly #logger: Logger;
    readonly #overrideManager: IdOverrideManager;

    /**
     * @param adapter - Platform adapter for HTTP and storage.
     * @param config - Application configuration.
     * @param disabledManager - Tracks temporarily disabled clients.
     * @param logger - Required; every lookup and failure path logs.
     * @param overrideManager - Manager for ID overrides.
     * @param queue - Rate-limited request queue for this client.
     * @param source - ApiSource identifier.
     */
    constructor(
        adapter: PlatformAdapter,
        config: ConfigManager,
        disabledManager: DisabledClientsManager,
        logger: Logger,
        overrideManager: IdOverrideManager,
        queue: RequestQueue,
        source: ApiSourceType
    ) {
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
     * @param displayTitle - Title as shown by the streaming service.
     * @param imdbId - Optional IMDb ID for short-circuiting search.
     * @returns Hydrated Title with ratings, or null if not found.
     */
    async fetch(displayTitle: string, imdbId: string | null = null): Promise<Title | null> {
        if (await this.#isDisabled()) {
            return null;
        }

        const overrideId = await this.#overrideManager.getImdbId(displayTitle);
        if (overrideId) {
            this.#logger.debug(`Using override IMDb ID ${overrideId} for "${displayTitle}"`);
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
        if (!searchTitle.imdbId) return searchTitle.withSource(this.#source);
        const detailedTitle = await this.getDetails(searchTitle);
        if (!detailedTitle) return null;
        return detailedTitle.withSource(this.#source);
    }

    /** A health result suitable for provider selection. */
    async getStatus(): Promise<ClientStatus> {
        if (await this.#isDisabled()) {
            return { healthy: false, reason: 'Temporarily disabled due to errors' };
        }
        return { healthy: true };
    }

    /**
     * Disables this client for CLIENT_DISABLE_DURATION, purges its queued
     * requests, and logs a warning.
     *
     * @note Requests still waiting in this client's queue are removed. An HTTP request already
     *   executing at the network level cannot be aborted and may still resolve after disable().
     */
    async disable(): Promise<void> {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, CLIENT_DISABLE_DURATION);
        this.#logger.warn(
            `${this.source} disabled for ${CLIENT_DISABLE_DURATION / 60000} min, purging ${count} queued request${count !== 1 ? 's' : ''}`
        );
    }

    /**
     * Enqueues an HTTP request through the rate-limited queue.
     *
     * @param url - Request URL.
     * @param priority - Higher values are processed first.
     * @returns Parsed response body.
     */
    async queuedFetch(url: string, priority: number): Promise<unknown> {
        return this.#queue.enqueue(url, priority, async (requestUrl: string) => this.#adapter.httpFetch(requestUrl));
    }

    async #isDisabled(): Promise<boolean> {
        return this.#disabledManager.isDisabled(this.#source);
    }

    /**
     * Searches the API for a title matching the streaming-service display name.
     * Subclasses must override this method.
     *
     * @param _displayTitle - Title to search for.
     * @returns A Title with available metadata from search results, or null.
     */
    abstract search(_displayTitle: string): Promise<Title | null>;

    /**
     * Fetches ratings and additional details for a title returned by search().
     * Subclasses must override this method.
     *
     * Implementations should merge searchTitle values as fallbacks:
     * - Use searchTitle fields (apiTitle, imdbId, year, type) when details fetch returns null/undefined
     * - Override with details fetch values when available
     *
     * @param _searchTitle - Title returned by search().
     * @returns A Title with ratings and details populated, or null.
     */
    abstract getDetails(_searchTitle: Title): Promise<Title | null>;

    /** ApiSource identifier for this client. */
    get source(): ApiSourceType {
        return this.#source;
    }

    /** Application configuration. */
    get config(): ConfigManager {
        return this.#config;
    }

    /** Logger instance. */
    get logger(): Logger {
        return this.#logger;
    }
}
