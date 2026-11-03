/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ClientStatus } from '../../types/api';
import { ApiSource } from '../constants';
import { PROVIDER_RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { type ApiClientDeps, BaseApiClient } from './base-api-client';
import {
    assertRecord,
    optionalArray,
    optionalString,
    ParseError,
    parseValidItems,
    requiredString,
} from './parse-utils';
import { mapOmdbTitleType } from './title-type-mappers';

/** OMDb signals a successful lookup with this exact `Response` value. */
const OMDB_SUCCESS = 'True';

/** OMDb signals a failed lookup with this exact `Response` value. */
const OMDB_FAILURE = 'False';

function parseOmdbResponse(raw: unknown): OmdbResponse {
    assertRecord(raw);
    const response = requiredString(raw, 'Response');
    if (response === OMDB_FAILURE) return { Response: response };
    if (response !== OMDB_SUCCESS) {
        throw new ParseError(`expected Response "True" or "False", got "${response}"`);
    }
    return parseOmdbSuccessResponse(raw);
}

function parseOmdbSuccessResponse(raw: Record<string, unknown>): OmdbResponse {
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
    const upperSource = optionalString(raw, 'Source');
    const lowerSource = optionalString(raw, 'source');
    const upperValue = optionalString(raw, 'Value');
    const lowerValue = optionalString(raw, 'value');
    const source = upperSource ?? lowerSource;
    const value = upperValue ?? lowerValue;
    if (source === undefined || value === undefined) {
        throw new ParseError('expected source and value');
    }
    return { source, value };
}

function parseRatings(ratings: OmdbRatingEntry[] | undefined, sourcePattern: RegExp): number | undefined {
    const entry = ratings?.find(r => sourcePattern.test(r.source));
    return toRating(entry?.value);
}

/** OMDb sends ratings as strings; null, empty, and "N/A" mean no rating. */
function toRating(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = Number.parseFloat(String(value));
    return Number.isNaN(num) ? undefined : num;
}

/**
 * API client for OMDb service that provides movie and series information with ratings.
 */
export class OmdbApiClient extends BaseApiClient {
    constructor(deps: ApiClientDeps) {
        const { minIntervalMs, syncKey } = PROVIDER_RATE_LIMITS[ApiSource.OMDB];
        super(deps, new RequestQueue(deps.adapter, minIntervalMs, syncKey), ApiSource.OMDB);
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
        const json = await this.fetchParsed(
            `https://www.omdbapi.com/?${params}`,
            1,
            parseOmdbResponse,
            `OMDb search for "${displayTitle}"`
        );
        if (!json) return undefined;
        if (json.Response === OMDB_FAILURE) {
            this.logger.info(`No OMDb results found for "${displayTitle}"`);
            return undefined;
        }
        return this.#parseOmdbResponse(json, displayTitle, undefined);
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
            this.logger.debug(`Fetching OMDb details by ID: ${id} ("${searchTitle.displayTitle}")`);
            const json = await this.fetchParsed(
                `https://www.omdbapi.com/?${params}`,
                1,
                parseOmdbResponse,
                `OMDb details for "${searchTitle.displayTitle}" (ID: ${id})`
            );
            if (!json) return undefined;
            if (json.Response === OMDB_FAILURE) {
                this.logger.info(`No OMDb results found for ID: ${id}`);
                return undefined;
            }
            return this.#parseOmdbResponse(json, searchTitle.displayTitle, searchTitle.imdbId);
        }
        return searchTitle;
    }

    /**
     * Parses OMDb JSON response into a Title.
     *
     * @param json - Decoded OMDb API response.
     * @param displayTitle - Display title from streaming service.
     * @param fallbackImdbId - Fallback IMDb ID from search results.
     * @returns Title instance.
     */
    #parseOmdbResponse(json: OmdbResponse, displayTitle: string, fallbackImdbId: string | undefined): Title {
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
        const releaseYear = Year ? (Year.match(/^\d{4}/)?.[0] ?? undefined) : undefined;
        const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replaceAll(',', ''), 10) : undefined;
        return new Title({
            displayTitle,
            apiTitle: apiTitle ?? undefined,
            imdbId: imdbID ?? fallbackImdbId ?? undefined,
            year: releaseYear ? Number(releaseYear) : undefined,
            imdbRating: toRating(imdbRating),
            imdbVotes: votes,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
            type: mapOmdbTitleType(apiType ?? undefined),
            source: undefined,
        });
    }
}

/** Normalized OMDb rating entry. OMDb sends every rating value as a string, for example "8.5" or "90%". */
interface OmdbRatingEntry {
    source: string;
    value: string;
}

/**
 * Normalized OMDb API response.
 *
 * A successful response always carries `Title` and `imdbID`; a failed response
 * (`Response: "False"`) carries neither. The fields stay optional because this
 * type covers both shapes.
 */
interface OmdbResponse {
    Response: string;
    imdbRating?: string | undefined;
    Ratings?: OmdbRatingEntry[] | undefined;
    imdbID?: string | undefined;
    Year?: string | undefined;
    Title?: string | undefined;
    Type?: string | undefined;
    imdbVotes?: string | undefined;
}
