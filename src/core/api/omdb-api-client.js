/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants.js';
import { RATE_LIMITS } from '../rate-limits.js';
import { RequestQueue } from '../request-queue.js';
import { Title } from '../title.js';
import { BaseApiClient } from './base-api-client.js';
import { mapOmdbTitleType } from './title-type-mappers.js';

/**
 * Extracts a rating value from an OMDb `Ratings` array by matching its source label.
 *
 * @param {unknown} ratings - The `Ratings` field from an OMDb response.
 * @param {RegExp} sourcePattern - Pattern matched against the rating source name.
 * @returns {number|null} Rating value, or null when absent or not an array.
 */
function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

/**
 * API client for OMDb service that provides movie and series information with ratings.
 */
export class OmdbApiClient extends BaseApiClient {
    /**
     * Creates the OMDb client with its own rate-limited request queue.
     *
     * @param {import('../../platform/adapter.js').PlatformAdapter} adapter - Platform adapter for HTTP and storage.
     * @param {import('../config/config-manager.js').ConfigManager} config - Application configuration.
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
     * @param {import('../logger.js').Logger} logger - Diagnostic sink; every lookup and failure path logs.
     * @param {import('../id-override-manager.js').IdOverrideManager} overrideManager - Manager for user-supplied IMDb ID overrides.
     */
    constructor(adapter, config, disabledManager, logger, overrideManager) {
        super(
            adapter,
            config,
            disabledManager,
            logger,
            overrideManager,
            new RequestQueue(adapter, RATE_LIMITS[ApiSource.OMDB], null),
            ApiSource.OMDB
        );
    }

    /**
     * Checks if API key is configured and client is healthy.
     *
     * @returns {Promise<import('../../types/api.js').ClientStatus>} Unhealthy when no API key is set or the client is disabled.
     */
    async getStatus() {
        const apiKey = this.config.get('omdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    /**
     * Searches for a title using OMDb API.
     *
     * @param {string} displayTitle - The title to search for.
     * @returns {Promise<import('../title.js').Title|null>} Title object or null if not found.
     */
    async search(displayTitle) {
        const apiKey = this.config.get('omdbApiKey');
        const params = new URLSearchParams({ apikey: apiKey, t: displayTitle });
        this.logger.debug(`Searching OMDb for title: "${displayTitle}"`);
        const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        if (json.Response === 'False') {
            this.logger.info(`No OMDb results found for "${displayTitle}"`);
            return null;
        }
        return this.#parseOmdbResponse(json, displayTitle);
    }

    /**
     * Fetches full details for a title when search returned minimal data.
     *
     * @param {import('../title.js').Title} searchTitle - Title from search results.
     * @returns {Promise<import('../title.js').Title>} Title with full details.
     */
    async getDetails(searchTitle) {
        // OMDb search already returns full details; only fetch if we have a minimal title (no apiTitle)
        if (searchTitle.imdbId && searchTitle.apiTitle === null) {
            const id = searchTitle.imdbId;
            const apiKey = this.config.get('omdbApiKey');
            const params = new URLSearchParams({ apikey: apiKey, i: id });
            this.logger.debug(`Fetching OMDb details by ID: ${id} ("${searchTitle.displayTitle}")`);
            const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
            if (json.Response === 'False') {
                this.logger.info(`No OMDb results found for ID: ${id}`);
                return null;
            }
            return this.#parseOmdbResponse(json, searchTitle.displayTitle, searchTitle.imdbId);
        }
        return searchTitle;
    }

    /**
     * Parses OMDb JSON response into a Title.
     *
     * @param {object} json - OMDb API response.
     * @param {string} displayTitle - Display title from streaming service.
     * @param {string|null} [fallbackImdbId=null] - Fallback IMDb ID from search results.
     * @returns {import('../title.js').Title} Title populated from the OMDb payload.
     */
    #parseOmdbResponse(json, displayTitle, fallbackImdbId = null) {
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
        const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
        const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replaceAll(',', ''), 10) : null;
        return new Title({
            displayTitle,
            apiTitle,
            imdbId: imdbID ?? fallbackImdbId,
            year: releaseYear,
            imdbRating,
            imdbVotes: votes,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
            type: mapOmdbTitleType(apiType),
            source: null,
        });
    }
}
