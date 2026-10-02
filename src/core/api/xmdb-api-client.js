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

export class XmdbApiClient extends BaseApiClient {
    constructor(adapter, config, disabledManager, logger, overrideManager) {
        super(
            adapter,
            config,
            disabledManager,
            logger,
            overrideManager,
            new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
            ApiSource.XMDB
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
            imdbRating: null,
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
            imdbRating: rating,
            imdbVotes: vote_count ?? null,
            rtRating: null,
            mcRating: metascore ?? null,
            type: mapXmdbTitleType(title_type) ?? searchTitle.type,
            source: null,
        });
    }

    // Private methods under their first public caller

    // #mapTitleType is used by getDetails() - goes under getDetails()
    // But we're using the imported function instead of a private method
    // This eliminates the duplicate logic
}
