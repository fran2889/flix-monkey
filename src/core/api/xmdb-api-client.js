/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants.js';
import { RATE_LIMITS } from '../rate-limits.js';
import { RequestQueue } from '../request-queue.js';
import { Title } from '../title.js';
import { BaseApiClient } from './base-api-client.js';
import { mapXmdbTitleType } from './title-type-mappers.js';

/**
 * API client for XMDb service that provides comprehensive movie and series data with ratings.
 */
export class XmdbApiClient extends BaseApiClient {
    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter
     * @param {import('../config/config-manager.js').ConfigManager} config
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledManager
     * @param {import('../logger.js').Logger} logger
     * @param {import('../id-override-manager.js').IdOverrideManager} overrideManager
     */
    constructor(adapter, config, disabledManager, logger, overrideManager) {
        super(
            adapter,
            config,
            disabledManager,
            logger,
            overrideManager,
            new RequestQueue(adapter, RATE_LIMITS[ApiSource.XMDB], 'fm_last_req'),
            ApiSource.XMDB
        );
    }

    /**
     * Checks if API key is configured and client is healthy.
     *
     * @returns {Promise<import('../types/api.js').ClientStatus>}
     */
    async getStatus() {
        const apiKey = this.config.get('xmdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    /**
     * Searches for a title using XMDb API.
     *
     * @param {string} displayTitle - The title to search for.
     * @returns {Promise<import('../title.js').Title|null>} Title object or null if not found.
     */
    async search(displayTitle) {
        const apiKey = this.config.get('xmdbApiKey');
        const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: 5 });
        this.logger.debug(`Searching XMDb for title: "${displayTitle}"`);
        const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
        if (!results?.length) {
            this.logger.info(`No search results found in XMDb for "${displayTitle}"`);
            return null;
        }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) {
            this.logger.info(`No title-type results found in XMDb for "${displayTitle}"`);
            return null;
        }
        const match = titleResults[0];
        return new Title({
            displayTitle,
            apiTitle: match.title ?? null,
            imdbId: match.id ?? null,
            year: match.release_year ?? match.year ?? null,
            imdbRating: null,
            imdbVotes: null,
            rtRating: null,
            mcRating: null,
            type: null,
            source: null,
        });
    }

    /**
     * Fetches detailed ratings and metadata from XMDb API.
     *
     * @param {import('../title.js').Title} searchTitle - Title from search results with IMDb ID.
     * @returns {Promise<import('../title.js').Title|null>} Title with ratings and metadata or null on failure.
     */
    async getDetails(searchTitle) {
        const id = searchTitle.imdbId;
        this.logger.debug(`Fetching XMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
        const apiKey = this.config.get('xmdbApiKey');
        const detailsParams = new URLSearchParams({ apiKey });
        const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        if (!detailsJson || detailsJson.error || !detailsJson.title) {
            this.logger.warn(`XMDb details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: detailsJson ?? null,
            });
            return null;
        }
        const { rating, release_year, title, metascore, title_type, vote_count } = detailsJson;
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: title ?? searchTitle.apiTitle,
            imdbId: id,
            year: release_year ?? searchTitle.year,
            imdbRating: rating,
            imdbVotes: vote_count ?? null,
            rtRating: null,
            mcRating: metascore ?? null,
            type: mapXmdbTitleType(title_type),
            source: null,
        });
    }
}
