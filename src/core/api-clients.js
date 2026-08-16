/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource, CLIENT_DISABLE_DURATION, TitleType } from './constants.js';
import { RATE_LIMITS } from './rate-limits.js';
import { RequestQueue } from './request-queue.js';
import { Title } from './title.js';

/**
 * @typedef {{healthy: true}|{healthy: false, reason: string}} ClientStatus
 */

function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

/**
 * Abstract base class for API clients.
 *
 * Implements the template-method pattern: {@link fetch} orchestrates the
 * lookup by calling {@link search} (find a candidate) then {@link getDetails}
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

    /**
     * @param {import('./request-queue.js').RequestQueue} queue - Rate-limited request queue for this client.
     * @param {typeof ApiSource[keyof typeof ApiSource]} source - `ApiSource` identifier (for example, `ApiSource.OMDB`).
     * @param {import('./disabled-clients.js').DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter - Platform adapter for HTTP and storage.
     * @param {import('./config-manager.js').ConfigManager} config - Application configuration.
     * @param {import('./logger.js').Logger} [logger] - Logger instance when diagnostics are needed.
     */
    constructor(queue, source, disabledManager, adapter, config, logger) {
        this.#queue = queue;
        this.#source = source;
        this.#disabledManager = disabledManager;
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    /**
     * Fetches ratings for a streaming-service title through the search -> details pipeline.
     * Callers must gate through {@link getStatus} before invoking.
     *
     * @param {string} displayTitle - Title as shown by the streaming service.
     * @returns {Promise<import('./title.js').Title|null>} Hydrated `Title` with ratings, or `null` if the
     *   title was not found.
     */
    async fetch(displayTitle) {
        const searchTitle = await this.search(displayTitle);
        if (!searchTitle) return null;
        if (await this.isDisabled()) return null;
        const detailedTitle = await this.getDetails(searchTitle);
        if (!detailedTitle) return null;
        return detailedTitle.withSource(this.#source);
    }

    /** @returns {Promise<ClientStatus>} A health result suitable for provider selection. */
    async getStatus() {
        if (await this.isDisabled()) {
            return { healthy: false, reason: 'Temporarily disabled due to errors' };
        }
        return { healthy: true };
    }

    async isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    /**
     * Searches the API for a title matching the streaming-service display name.
     * Subclasses must override this method.
     *
     * @abstract
     * @param {string} _displayTitle - Title to search for.
     * @returns {Promise<import('./title.js').Title|null>} A Title with available metadata from search results,
     *   or `null` if no match was found.
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
     * @param {import('./title.js').Title} _searchTitle - Title returned by search().
     * @returns {Promise<import('./title.js').Title|null>} A Title with ratings and details populated, or `null`
     *   if details could not be retrieved.
     */
    async getDetails(_searchTitle) {
        throw new Error('Not implemented');
    }

    /**
     * Enqueues an HTTP request through the rate-limited queue.
     *
     * @param {string} url - Request URL.
     * @param {number} [priority=0] - Higher values are processed first.
     * @param {'json'|'text'} [responseType='json'] - Expected response format.
     * @returns {Promise<unknown>} Parsed response body.
     */
    async queuedFetch(url, priority = 0, responseType = 'json') {
        return this.#queue.enqueue(
            url,
            priority,
            (u, rt) => this.#adapter.httpFetch(u, { responseType: rt }),
            responseType
        );
    }

    /**
     * Disables this client, purges its queued requests, and logs a warning.
     *
     * @param {number} [durationMs=CLIENT_DISABLE_DURATION] - Lockout duration in milliseconds.
     * @returns {Promise<void>}
     * @note Requests still waiting in this client's queue are removed. An HTTP request already
     *   executing at the network level cannot be aborted and may still resolve after disable().
     */
    async disable(durationMs = CLIENT_DISABLE_DURATION) {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, durationMs);
        this.#logger?.warn(
            `${this.source} disabled for ${durationMs / 60000} min, purging ${count} queued request${count !== 1 ? 's' : ''}`
        );
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

export class XmdbApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
            ApiSource.XMDB,
            disabledManager,
            adapter,
            config,
            logger
        );
    }

    async getStatus() {
        const apiKey = this.config.get('xmdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    async search(displayTitle) {
        const apiKey = this.config.get('xmdbApiKey');
        const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: 5 });
        this.logger?.debug(`Searching XMDb for title: "${displayTitle}"`);
        const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
        if (!results?.length) {
            this.logger?.info(`No search results found in XMDb for "${displayTitle}"`);
            return null;
        }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) {
            this.logger?.info(`No title-type results found in XMDb for "${displayTitle}"`);
            return null;
        }
        const match = titleResults[0];
        return new Title({
            displayTitle,
            apiTitle: match.title ?? null,
            imdbId: match.id ?? null,
            year: match.release_year ?? match.year ?? null,
            rating: null,
            imdbVotes: null,
            rtRating: null,
            mcRating: null,
            type: null,
            source: null,
        });
    }

    async getDetails(searchTitle) {
        const id = searchTitle.imdbId;
        this.logger?.debug(`Fetching XMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
        const apiKey = this.config.get('xmdbApiKey');
        const detailsParams = new URLSearchParams({ apiKey });
        const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        if (!detailsJson || detailsJson.error || !detailsJson.title) {
            this.logger?.warn(`XMDb details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: detailsJson ?? null,
            });
            return null;
        }
        const { rating, release_year, title, metascore, title_type, vote_count } = detailsJson;
        // Merge: use searchTitle values as fallbacks, override with details when available
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: title ?? searchTitle.apiTitle,
            imdbId: id ?? searchTitle.imdbId,
            year: release_year ?? searchTitle.year,
            rating,
            imdbVotes: vote_count ?? null,
            rtRating: null,
            mcRating: metascore ?? null,
            type: this.#mapTitleType(title_type) ?? searchTitle.type,
            source: null,
        });
    }

    #mapTitleType(apiValue) {
        if (apiValue === 'Movie') return TitleType.MOVIE;
        if (apiValue === 'TV Series') return TitleType.SERIES;
        return null;
    }
}

export class OmdbApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.OMDB], null, adapter),
            ApiSource.OMDB,
            disabledManager,
            adapter,
            config,
            logger
        );
    }

    async getStatus() {
        const apiKey = this.config.get('omdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    async search(displayTitle) {
        const apiKey = this.config.get('omdbApiKey');
        const params = new URLSearchParams({ apikey: apiKey, t: displayTitle });
        this.logger?.debug(`Searching OMDb for title: "${displayTitle}"`);
        const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        if (json.Response === 'False') {
            this.logger?.info(`No OMDb results found for "${displayTitle}"`);
            return null;
        }
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
        const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
        const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replaceAll(',', ''), 10) : null;
        return new Title({
            displayTitle,
            apiTitle: apiTitle ?? null,
            imdbId: imdbID ?? null,
            year: releaseYear,
            rating: imdbRating,
            imdbVotes: votes,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
            type: this.#mapTitleType(apiType),
            source: null,
        });
    }

    #mapTitleType(apiValue) {
        if (apiValue === 'movie') return TitleType.MOVIE;
        if (apiValue === 'series') return TitleType.SERIES;
        return null;
    }

    async getDetails(searchTitle) {
        // Pass-through: OMDb already fetched all details (including ratings) in search()
        return searchTitle;
    }
}

const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);

export class AgregarrApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.AGREGARR], null, adapter),
            ApiSource.AGREGARR,
            disabledManager,
            adapter,
            config,
            logger
        );
    }

    async search(displayTitle) {
        const encoded = encodeURIComponent(displayTitle.toLowerCase());
        this.logger?.debug(`Searching IMDb Suggestions for title: "${displayTitle}"`);
        const data = await this.queuedFetch(`https://v3.sg.media-imdb.com/suggestion/titles/x/${encoded}.json`, 0);
        const results = data?.d;
        if (!results?.length) {
            this.logger?.info(`No search results found in IMDb Suggestions for "${displayTitle}"`);
            return null;
        }
        const match = results.find(result => AGREGARR_TITLE_TYPES.has(result.qid));
        if (!match) {
            this.logger?.info(`No supported title-type results found in IMDb Suggestions for "${displayTitle}"`);
            return null;
        }
        return new Title({
            displayTitle,
            apiTitle: match.l ?? null,
            imdbId: match.id ?? null,
            year: match.y ?? null,
            rating: null,
            imdbVotes: null,
            rtRating: null,
            mcRating: null,
            type: this.#mapTitleType(match.qid),
            source: null,
        });
    }

    #mapTitleType(apiValue) {
        if (apiValue === 'movie') return TitleType.MOVIE;
        if (apiValue === 'tvSeries' || apiValue === 'tvMiniSeries') return TitleType.SERIES;
        return null;
    }

    async getDetails(searchTitle) {
        const id = searchTitle.imdbId;
        this.logger?.debug(`Fetching Agregarr details for ID: ${id} ("${searchTitle.displayTitle}")`);
        const ratings = await this.queuedFetch(`https://api.agregarr.org/api/ratings?id=${encodeURIComponent(id)}`, 1);
        const entry = ratings?.[0];
        if (!entry) {
            this.logger?.warn(`Agregarr details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: ratings ?? null,
            });
            return null;
        }
        // Merge: use searchTitle values as fallbacks, override with details when available
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: searchTitle.apiTitle,
            imdbId: id ?? searchTitle.imdbId,
            year: searchTitle.year,
            rating: entry?.rating ?? null,
            imdbVotes: entry?.votes ?? null,
            rtRating: null,
            mcRating: null,
            type: searchTitle.type,
            source: null,
        });
    }
}
