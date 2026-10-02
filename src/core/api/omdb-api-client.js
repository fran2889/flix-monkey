/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants.js';
import { RATE_LIMITS } from '../rate-limits.js';
import { RequestQueue } from '../request-queue.js';
import { Title } from '../title.js';
import { BaseApiClient } from './base-api-client.js';
import { mapOmdbTitleType, parseRatings } from './title-type-mappers.js';

export class OmdbApiClient extends BaseApiClient {
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
        return this.#parseOmdbResponse(json, displayTitle);
    }

    async getDetails(searchTitle) {
        // OMDb search already returns full details; only fetch if we have a minimal title (no apiTitle)
        if (searchTitle.imdbId && searchTitle.apiTitle === null) {
            const id = searchTitle.imdbId;
            const apiKey = this.config.get('omdbApiKey');
            const params = new URLSearchParams({ apikey: apiKey, i: id });
            this.logger?.debug(`Fetching OMDb details by ID: ${id} ("${searchTitle.displayTitle}")`);
            const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
            if (json.Response === 'False') {
                this.logger?.info(`No OMDb results found for ID: ${id}`);
                return null;
            }
            return this.#parseOmdbResponse(json, searchTitle.displayTitle, searchTitle.imdbId);
        }
        return searchTitle;
    }

    // Private methods under their first public caller

    /**
     * Parses OMDb JSON response into a Title.
     *
     * @param {Object} json - OMDb API response
     * @param {string} displayTitle - Display title from streaming service
     * @param {string|null} [fallbackImdbId=null] - Fallback IMDb ID from search results
     * @returns {import('../title.js').Title}
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
