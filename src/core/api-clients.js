/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { ApiSource, CLIENT_DISABLE_DURATION, TitleType } from './constants.js';
import { RATE_LIMITS } from './rate-limits.js';
import { RequestQueue } from './request-queue.js';
import { Title } from './title.js';

/**
 * @typedef {Object} ClientStatus
 * @property {boolean} healthy - Whether the client is operational.
 * @property {string} [reason] - Human-readable explanation when `healthy` is `false`.
 */

/**
 * Extracts a rating value from an OMDb-style `Ratings` array.
 *
 * @param {Array<{source?: string, Source?: string, value?: string, Value?: string}>|*} ratings
 * @param {RegExp} sourcePattern - Pattern to match against the `source`/`Source` field.
 * @returns {string|null} The raw rating string, or `null` if not found.
 */
function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

const TITLE_TYPE_MAP = {
    Movie: TitleType.MOVIE,
    movie: TitleType.MOVIE,
    'TV Series': TitleType.SERIES,
    series: TitleType.SERIES,
    tvSeries: TitleType.SERIES,
    tvMiniSeries: TitleType.SERIES,
};

function mapTitleType(apiValue) {
    return TITLE_TYPE_MAP[apiValue] ?? null;
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
    /** @type {RequestQueue} */
    #queue;
    /** @type {string} */
    #source;
    /** @type {DisabledClientsManager} */
    #disabledManager;
    /** @type {PlatformAdapter} */
    #adapter;
    /** @type {ConfigManager} */
    #config;
    /** @type {Logger|null} */
    #logger;

    /**
     * @param {RequestQueue} queue - Rate-limited request queue for this client.
     * @param {string} source - `ApiSource` identifier (e.g. `ApiSource.OMDB`).
     * @param {DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
     * @param {PlatformAdapter} adapter - Platform adapter for HTTP and storage.
     * @param {ConfigManager} config - Application configuration.
     * @param {Logger|null} logger - Logger instance (may be `null` during tests).
     */
    constructor(queue, source, disabledManager, adapter, config, logger) {
        this.#queue = queue;
        this.#source = source;
        this.#disabledManager = disabledManager;
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    /** @returns {ConfigManager} */
    get config() {
        return this.#config;
    }

    /** @returns {string} The `ApiSource` identifier for this client. */
    get source() {
        return this.#source;
    }

    /** @returns {Logger|null} */
    get logger() {
        return this.#logger;
    }

    /** @returns {Promise<boolean>} Whether this client is temporarily disabled. */
    async isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    /** @returns {Promise<ClientStatus>} */
    async getStatus() {
        if (await this.isDisabled()) {
            return { healthy: false, reason: 'Temporarily disabled due to errors' };
        }
        return { healthy: true };
    }

    /**
     * Disables this client, purges its queued requests, and logs a warning.
     *
     * @param {number} [durationMs=CLIENT_DISABLE_DURATION] - Lockout duration in milliseconds.
     * @returns {Promise<void>}
     * @note Any HTTP request already executing at the network level when `disable()` is called
     *   cannot be aborted and may complete, but its result is discarded by the caller.
     */
    async disable(durationMs = CLIENT_DISABLE_DURATION) {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, durationMs);
        this.#logger?.warn(
            `${this.source} disabled for ${durationMs / 60000} min, purging ${count} queued request${count !== 1 ? 's' : ''}`
        );
    }

    /**
     * Enqueues an HTTP request through the rate-limited queue.
     *
     * @param {string} url - Request URL.
     * @param {number} [priority=0] - Higher values are processed first.
     * @param {'json'|'text'} [responseType='json'] - Expected response format.
     * @returns {Promise<*>} Parsed response body.
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
     * Fetches ratings for a Netflix title by running the search -> details pipeline.
     * Callers must gate through {@link getStatus} before invoking.
     *
     * @param {string} displayTitle - Title as shown on the Netflix UI.
     * @returns {Promise<Title|null>} Hydrated `Title` with ratings, or `null` if the
     *   title was not found.
     */
    async fetch(displayTitle) {
        const searchTitle = await this.search(displayTitle);
        if (!searchTitle) return null;
        if (await this.isDisabled()) return null;
        const detailedTitle = await this.getDetails(searchTitle);
        if (!detailedTitle) return null;
        return new Title({ ...detailedTitle, source: this.#source });
    }

    /**
     * Searches the API for a title matching the Netflix display name.
     * Subclasses must override this method.
     *
     * @abstract
     * @param {string} displayTitle - Title to search for.
     * @returns {Promise<Title|null>} A Title with available metadata from search results,
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
     * @param {Title} searchTitle - Title returned by search().
     * @returns {Promise<Title|null>} A Title with ratings and details populated, or `null`
     *   if details could not be retrieved.
     */
    async getDetails(_searchTitle) {
        throw new Error('Not implemented');
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
            type: mapTitleType(title_type) ?? searchTitle.type,
            source: null,
        });
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
        const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replace(/,/g, ''), 10) : null;
        return new Title({
            displayTitle,
            apiTitle: apiTitle ?? null,
            imdbId: imdbID ?? null,
            year: releaseYear,
            rating: imdbRating,
            imdbVotes: votes,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
            type: mapTitleType(apiType),
            source: null,
        });
    }

    async getDetails(searchTitle) {
        // Pass-through: OMDb already fetched all details (including ratings) in search()
        return searchTitle;
    }
}

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
        const encoded = encodeURIComponent(displayTitle);
        this.logger?.debug(`Searching FM-DB for title: "${displayTitle}"`);
        const data = await this.queuedFetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encoded}`, 0);
        if (!data?.ok) {
            this.logger?.info(`FM-DB search request failed for "${displayTitle}"`);
            return null;
        }
        const results = data?.description;
        if (!results?.length) {
            this.logger?.info(`No search results found in FM-DB for "${displayTitle}"`);
            return null;
        }
        return results[0];
    }

    async getDetails(match, displayTitle) {
        const id = match['#IMDB_ID'];
        const title = match['#TITLE'];
        const year = match['#YEAR'];
        this.logger?.debug(`Fetching Agregarr details for ID: ${id} ("${displayTitle}")`);
        const ratings = await this.queuedFetch(`https://api.agregarr.org/api/ratings?id=${encodeURIComponent(id)}`, 1);
        const entry = ratings?.[0];
        if (!entry) {
            this.logger?.warn(`Agregarr details request failed for "${displayTitle}" (ID: ${id})`, {
                response: ratings ?? null,
            });
        }
        return new Title({
            apiTitle: title ?? null,
            imdbId: id,
            year: year ?? null,
            rating: entry?.rating ?? null,
            imdbVotes: entry?.votes ?? null,
            rtRating: null,
            mcRating: null,
            type: null,
        });
    }
}
