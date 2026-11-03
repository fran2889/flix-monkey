/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants';
import { PROVIDER_RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { type ApiClientDeps, BaseApiClient } from './base-api-client';
import {
    assertRecord,
    optionalArray,
    optionalNumber,
    ParseError,
    parseRequiredItems,
    requiredString,
} from './parse-utils';
import { mapAgregarrTitleType } from './title-type-mappers';

/** IMDb Suggestions `qid` values this provider can map to a canonical TitleType. */
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);

function parseImdbSuggestionsResponse(raw: unknown): ImdbSuggestionsResponse {
    assertRecord(raw);
    const results = optionalArray(raw, 'd');
    if (!results) return {};
    return { d: parseRequiredItems(results, parseImdbSuggestionsResult, 'the "d" array') };
}

function parseImdbSuggestionsResult(raw: unknown): ImdbSuggestionsResult {
    assertRecord(raw);
    return {
        qid: requiredString(raw, 'qid'),
        id: requiredString(raw, 'id'),
        l: requiredString(raw, 'l'),
        // People and other results have no release year.
        y: optionalNumber(raw, 'y'),
    };
}

function parseAgregarrRatingsResponse(raw: unknown): AgregarrRatingEntry[] {
    if (!Array.isArray(raw)) throw new ParseError('expected an array');
    return parseRequiredItems(raw, parseAgregarrRatingEntry, 'the ratings array');
}

function parseAgregarrRatingEntry(raw: unknown): AgregarrRatingEntry {
    assertRecord(raw);
    return {
        imdbId: requiredString(raw, 'imdbId'),
        // rating and votes are null when the title is unknown.
        rating: optionalNumber(raw, 'rating'),
        votes: optionalNumber(raw, 'votes'),
    };
}

/**
 * API client for Agregarr service that fetches ratings from IMDb Suggestions and Agregarr API.
 */
export class AgregarrApiClient extends BaseApiClient {
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
        const data = await this.fetchParsed(
            `https://v3.sg.media-imdb.com/suggestion/titles/x/${encoded}.json`,
            0,
            parseImdbSuggestionsResponse,
            `IMDb Suggestions search for "${displayTitle}"`
        );
        if (!data) return undefined;
        const results = data.d;
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
            apiTitle: match.l,
            imdbId: match.id,
            year: match.y,
            imdbRating: undefined,
            imdbVotes: undefined,
            rtRating: undefined,
            mcRating: undefined,
            type: mapAgregarrTitleType(match.qid),
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
        const ratings = await this.fetchParsed(
            `https://api.agregarr.org/api/ratings?id=${encodedId}`,
            1,
            parseAgregarrRatingsResponse,
            `Agregarr details for "${searchTitle.displayTitle}" (ID: ${id})`
        );
        if (!ratings) return undefined;
        const entry = ratings[0];
        if (!entry) {
            this.logger.warn(`Agregarr details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: ratings,
            });
            return undefined;
        }
        // Agregarr supplies ratings and the canonical IMDb ID in the details
        // response; every other identity field comes from the search result.
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: searchTitle.apiTitle,
            imdbId: entry.imdbId,
            year: searchTitle.year,
            imdbRating: entry.rating,
            imdbVotes: entry.votes,
            rtRating: undefined,
            mcRating: undefined,
            type: searchTitle.type,
            source: undefined,
        });
    }
}

/** Normalized IMDb Suggestions result. */
interface ImdbSuggestionsResult {
    qid: string;
    id: string;
    l: string;
    y?: number | undefined;
}

/** Normalized IMDb Suggestions response. */
interface ImdbSuggestionsResponse {
    d?: ImdbSuggestionsResult[] | undefined;
}

/** Normalized Agregarr rating entry. */
interface AgregarrRatingEntry {
    imdbId: string;
    rating?: number | undefined;
    votes?: number | undefined;
}
