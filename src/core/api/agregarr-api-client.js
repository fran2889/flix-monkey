/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants.js';
import { RATE_LIMITS } from '../rate-limits.js';
import { RequestQueue } from '../request-queue.js';
import { Title } from '../title.js';
import { BaseApiClient } from './base-api-client.js';
import { mapAgregarrTitleType } from './title-type-mappers.js';

/** IMDb Suggestions `qid` values this provider can map to a canonical TitleType. */
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);

export class AgregarrApiClient extends BaseApiClient {
    constructor(adapter, config, disabledManager, logger, overrideManager) {
        super(
            adapter,
            config,
            disabledManager,
            logger,
            overrideManager,
            new RequestQueue(adapter, RATE_LIMITS[ApiSource.AGREGARR], null),
            ApiSource.AGREGARR
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
            imdbRating: null,
            imdbVotes: null,
            rtRating: null,
            mcRating: null,
            type: mapAgregarrTitleType(match.qid),
            source: null,
        });
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
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: searchTitle.apiTitle,
            imdbId: id ?? searchTitle.imdbId,
            year: searchTitle.year,
            imdbRating: entry?.rating ?? null,
            imdbVotes: entry?.votes ?? null,
            rtRating: null,
            mcRating: null,
            type: searchTitle.type,
            source: null,
        });
    }
}
