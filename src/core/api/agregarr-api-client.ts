/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants';
import { PROVIDER_RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { type ApiClientDeps, BaseApiClient } from './base-api-client';
import { mapAgregarrTitleType } from './title-type-mappers';

/** IMDb Suggestions `qid` values this provider can map to a canonical TitleType. */
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);

/**
 * API client for Agregarr service that fetches ratings from IMDb Suggestions and Agregarr API.
 */
export class AgregarrApiClient extends BaseApiClient {
    /**
     * @param deps - Collaborators shared by every API client.
     */
    constructor(deps: ApiClientDeps) {
        const { minIntervalMs, syncKey } = PROVIDER_RATE_LIMITS[ApiSource.AGREGARR];
        super(deps, new RequestQueue(deps.adapter, minIntervalMs, syncKey), ApiSource.AGREGARR);
    }

    /**
     * Searches for a title using IMDb Suggestions API.
     *
     * @param displayTitle - The title to search for.
     * @returns Title object or undefined if not found.
     */
    async search(displayTitle: string): Promise<Title | undefined> {
        const encoded = encodeURIComponent(displayTitle.toLowerCase());
        this.logger.debug(`Searching IMDb Suggestions for title: "${displayTitle}"`);
        const data = (await this.queuedFetch(
            `https://v3.sg.media-imdb.com/suggestion/titles/x/${encoded}.json`,
            0
        )) as ImdbSuggestionsResponse;
        const results = data?.d;
        if (!results?.length) {
            this.logger.info(`No search results found in IMDb Suggestions for "${displayTitle}"`);
            return undefined;
        }
        const match = results.find(result => AGREGARR_TITLE_TYPES.has(result.qid));
        if (!match) {
            this.logger.info(`No supported title-type results found in IMDb Suggestions for "${displayTitle}"`);
            return undefined;
        }
        return new Title({
            displayTitle,
            apiTitle: match.l ?? undefined,
            imdbId: match.id ?? undefined,
            year: match.y ?? undefined,
            imdbRating: undefined,
            imdbVotes: undefined,
            rtRating: undefined,
            mcRating: undefined,
            type: mapAgregarrTitleType(match.qid ?? undefined),
            source: undefined,
        });
    }

    /**
     * Fetches detailed ratings from Agregarr API using the cached IMDb ID.
     *
     * @param searchTitle - Title from search results with IMDb ID.
     * @returns Title with ratings or undefined on failure.
     */
    async getDetails(searchTitle: Title): Promise<Title | undefined> {
        const id = searchTitle.imdbId;
        this.logger.debug(`Fetching Agregarr details for ID: ${id} ("${searchTitle.displayTitle}")`);
        const encodedId = encodeURIComponent(String(id ?? ''));
        const ratings = (await this.queuedFetch(
            `https://api.agregarr.org/api/ratings?id=${encodedId}`,
            1
        )) as AgregarrRatingsResponse;
        const entry = ratings?.[0];
        if (!entry) {
            this.logger.warn(`Agregarr details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: ratings ?? undefined,
            });
            return undefined;
        }
        // Agregarr supplies ratings only in the details response; every identity
        // field comes from the search result that produced `id`.
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: searchTitle.apiTitle,
            imdbId: id,
            year: searchTitle.year,
            imdbRating: entry.rating ?? undefined,
            imdbVotes: entry.votes ?? undefined,
            rtRating: undefined,
            mcRating: undefined,
            type: searchTitle.type,
            source: undefined,
        });
    }
}

/** IMDb Suggestions response type */
interface ImdbSuggestionsResponse {
    d?: Array<{
        qid: string;
        id?: string;
        l?: string;
        y?: number;
    }>;
}

/** Agregarr ratings response type */
interface AgregarrRatingsResponse {
    [key: number]: {
        rating?: number;
        votes?: number;
    };
}
