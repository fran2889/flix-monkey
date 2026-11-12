/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ClientStatus } from '../../types/api';
import { ApiSource } from '../constants';
import {
    assertRecord,
    optionalArray,
    optionalString,
    ParseError,
    parseValidItems,
    requiredString,
} from '../parse-utils';
import { PROVIDER_RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { type ApiClientDeps, BaseApiClient } from './base-api-client';
import { mapOmdbTitleType } from './title-type-mappers';

/** Normalized OMDb rating entry. OMDb sends every rating value as a string, for example "8.5" or "90%". */
interface OmdbRatingEntry {
    source: string;
    value: string;
}

/**
 * Normalized successful OMDb API response.
 *
 * A successful response always carries `Title` and `imdbID`, so both fields
 * are required. The remaining fields are optional because OMDb omits them when
 * it has no value.
 */
interface OmdbSuccessResponse {
    Response: typeof OMDB_SUCCESS;
    imdbRating?: string | undefined;
    Ratings?: OmdbRatingEntry[] | undefined;
    imdbID: string;
    Year?: string | undefined;
    Title: string;
    Type?: string | undefined;
    imdbVotes?: string | undefined;
}

/** Normalized failed OMDb API response. */
interface OmdbFailureResponse {
    Response: typeof OMDB_FAILURE;
    Error?: string | undefined;
}

/** Normalized OMDb API response, discriminated by `Response`. */
type OmdbResponse = OmdbSuccessResponse | OmdbFailureResponse;

/** OMDb signals a successful lookup with this exact `Response` value. */
const OMDB_SUCCESS = 'True';

/** OMDb signals a failed lookup with this exact `Response` value. */
const OMDB_FAILURE = 'False';

/**
 * API client for OMDb service that provides movie and series information with ratings.
 */
export class OmdbApiClient extends BaseApiClient {
    constructor(deps: ApiClientDeps) {
        const { minIntervalMs, syncKey } = PROVIDER_RATE_LIMITS[ApiSource.OMDB];
        super(deps, new RequestQueue(deps.adapter, deps.logger, minIntervalMs, syncKey), ApiSource.OMDB);
    }

    /**
     * Checks if API key is configured and client is healthy.
     *
     * @returns A health result suitable for provider selection.
     */
    override async getStatus(): Promise<ClientStatus> {
        const apiKey = this.config.get('omdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    /**
     * Searches for a title using OMDb API.
     *
     * @param displayTitle - The title to search for.
     * @returns Title object or undefined if not found.
     */
    async search(displayTitle: string): Promise<Title | undefined> {
        const apiKey = this.config.get('omdbApiKey');
        const params = new URLSearchParams({ apikey: apiKey, t: displayTitle });
        this.logger.debug(`Searching OMDb for title: "${displayTitle}"`);
        const response = await this.fetchParsed(
            `https://www.omdbapi.com/?${params}`,
            1,
            parseOmdbResponse,
            `OMDb search for "${displayTitle}"`
        );
        if (!response) return undefined;
        if (response.Response === OMDB_FAILURE) {
            const message = response.Error ? `: ${response.Error}` : '';
            this.logger.info(`No search results found in OMDb for "${displayTitle}"${message}`);
            return undefined;
        }
        return titleFromOmdbSuccessResponse(response, displayTitle);
    }

    /**
     * Fetches full details for a title when search returned minimal data.
     *
     * @param searchTitle - Title from search results.
     * @returns Title with full details.
     */
    async getDetails(searchTitle: Title): Promise<Title | undefined> {
        // OMDb search already returns full details; only fetch if we have a minimal title (no apiTitle)
        if (searchTitle.imdbId && searchTitle.apiTitle === undefined) {
            const id = searchTitle.imdbId;
            const apiKey = this.config.get('omdbApiKey');
            const params = new URLSearchParams({ apikey: apiKey, i: id });
            this.logger.debug(`Fetching OMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
            const response = await this.fetchParsed(
                `https://www.omdbapi.com/?${params}`,
                1,
                parseOmdbResponse,
                `OMDb details for "${searchTitle.displayTitle}" (ID: ${id})`
            );
            if (!response) return undefined;
            if (response.Response === OMDB_FAILURE) {
                const message = response.Error ? `: ${response.Error}` : '';
                this.logger.info(`No OMDb results found for "${searchTitle.displayTitle}" (ID: ${id})${message}`);
                return undefined;
            }
            return titleFromOmdbSuccessResponse(response, searchTitle.displayTitle);
        }
        return searchTitle;
    }
}

function parseOmdbResponse(raw: unknown): OmdbResponse {
    assertRecord(raw);
    const response = requiredString(raw, 'Response');
    if (response === OMDB_FAILURE) return { Response: response, Error: optionalString(raw, 'Error') };
    if (response !== OMDB_SUCCESS) {
        throw new ParseError(`expected Response "True" or "False", got "${response}"`);
    }
    return parseOmdbSuccessResponse(raw);
}

function parseOmdbSuccessResponse(raw: Record<string, unknown>): OmdbSuccessResponse {
    return {
        Response: OMDB_SUCCESS,
        imdbRating: optionalString(raw, 'imdbRating'),
        Ratings: parseOmdbRatings(optionalArray(raw, 'Ratings')),
        imdbID: requiredString(raw, 'imdbID'),
        Year: optionalString(raw, 'Year'),
        Title: requiredString(raw, 'Title'),
        Type: optionalString(raw, 'Type'),
        imdbVotes: optionalString(raw, 'imdbVotes'),
    };
}

function parseOmdbRatings(ratings: unknown[] | undefined): OmdbRatingEntry[] | undefined {
    if (!ratings) return undefined;
    return parseValidItems(ratings, parseOmdbRating);
}

function parseOmdbRating(raw: unknown): OmdbRatingEntry {
    assertRecord(raw);
    return {
        source: requiredString(raw, 'Source'),
        value: requiredString(raw, 'Value'),
    };
}

function titleFromOmdbSuccessResponse(response: OmdbSuccessResponse, displayTitle: string): Title {
    const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = response;
    const releaseYear = Year ? (Year.match(/^\d{4}/)?.[0] ?? undefined) : undefined;
    const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replaceAll(',', ''), 10) : undefined;
    return new Title({
        displayTitle,
        apiTitle,
        imdbId: imdbID,
        year: releaseYear ? Number(releaseYear) : undefined,
        imdbRating: toRating(imdbRating),
        imdbVotes: votes,
        rtRating: ratingFromSource(Ratings, /Rotten Tomatoes/i),
        mcRating: ratingFromSource(Ratings, /Metacritic/i),
        type: mapOmdbTitleType(apiType),
        source: undefined,
    });
}

function ratingFromSource(ratings: OmdbRatingEntry[] | undefined, sourcePattern: RegExp): number | undefined {
    const entry = ratings?.find(r => sourcePattern.test(r.source));
    return toRating(entry?.value);
}

/** OMDb sends ratings as strings; null, empty, and "N/A" mean no rating. */
function toRating(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = Number.parseFloat(String(value));
    return Number.isNaN(num) ? undefined : num;
}
