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
import { isRecord, readOptionalArray, readOptionalString, readRequiredString } from './decode-utils';
import { mapOmdbTitleType } from './title-type-mappers';

/** OMDb signals a successful lookup with this exact `Response` value. */
const OMDB_SUCCESS = 'True';

/** OMDb signals a failed lookup with this exact `Response` value. */
const OMDB_FAILURE = 'False';

/**
 * Converts an OMDb numeric field to a number.
 *
 * OMDb sends ratings as strings, and a literal null, an empty string, or
 * "N/A" all mean "no rating". Unparseable input becomes undefined so a
 * blank field can never be coerced into a 0.0 rating.
 *
 * @param value - Raw field value from the OMDb response.
 * @returns The parsed number, or undefined when the field carries no rating.
 */
function toRating(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = Number.parseFloat(String(value));
    return Number.isNaN(num) ? undefined : num;
}

/**
 * Extracts a rating value from normalized OMDb rating entries by matching the source label.
 *
 * @param ratings - Normalized `Ratings` field from an OMDb response.
 * @param sourcePattern - Pattern matched against the rating source name.
 * @returns Rating value, or undefined when absent.
 */
function parseRatings(ratings: OmdbRatingEntry[] | undefined, sourcePattern: RegExp): number | undefined {
    const entry = ratings?.find(r => sourcePattern.test(r.source));
    return toRating(entry?.value);
}

/**
 * Decodes one OMDb rating entry.
 *
 * @param raw - Untrusted entry.
 * @returns Normalized entry, or undefined when the entry is not a usable rating.
 */
function decodeOmdbRating(raw: unknown): OmdbRatingEntry | undefined {
    if (!isRecord(raw)) return undefined;
    const upperSource = readOptionalString(raw, 'Source');
    const lowerSource = readOptionalString(raw, 'source');
    const upperValue = readOptionalString(raw, 'Value');
    const lowerValue = readOptionalString(raw, 'value');
    if (!upperSource.ok || !lowerSource.ok || !upperValue.ok || !lowerValue.ok) return undefined;
    const source = upperSource.value ?? lowerSource.value;
    const value = upperValue.value ?? lowerValue.value;
    if (source === undefined || value === undefined) return undefined;
    return { source, value };
}

/**
 * Normalizes the `Ratings` array, dropping entries without a usable source or value.
 *
 * @param ratings - Untrusted `Ratings` array, or undefined when absent.
 * @returns The normalized entries, or undefined when the field is absent.
 */
function decodeOmdbRatings(ratings: unknown[] | undefined): OmdbRatingEntry[] | undefined {
    if (!ratings) return undefined;
    const decoded: OmdbRatingEntry[] = [];
    for (const rating of ratings) {
        const entry = decodeOmdbRating(rating);
        if (entry) decoded.push(entry);
    }
    return decoded;
}

/**
 * Decodes a successful OMDb payload.
 *
 * OMDb always includes `Title` and `imdbID` on a successful lookup, so a
 * success response that lacks either is treated as malformed.
 *
 * @param raw - Parsed JSON object.
 * @returns Normalized response, or undefined when a required field is missing or mistyped.
 */
function decodeOmdbSuccessResponse(raw: Record<string, unknown>): OmdbResponse | undefined {
    const imdbRating = readOptionalString(raw, 'imdbRating');
    if (!imdbRating.ok) return undefined;
    const ratings = readOptionalArray(raw, 'Ratings');
    if (!ratings.ok) return undefined;
    const imdbId = readRequiredString(raw, 'imdbID');
    if (!imdbId.ok) return undefined;
    const year = readOptionalString(raw, 'Year');
    if (!year.ok) return undefined;
    const title = readRequiredString(raw, 'Title');
    if (!title.ok) return undefined;
    const apiType = readOptionalString(raw, 'Type');
    if (!apiType.ok) return undefined;
    const imdbVotes = readOptionalString(raw, 'imdbVotes');
    if (!imdbVotes.ok) return undefined;
    if (!title.value) return undefined;
    if (!imdbId.value) return undefined;
    return {
        Response: OMDB_SUCCESS,
        imdbRating: imdbRating.value,
        Ratings: decodeOmdbRatings(ratings.value),
        imdbID: imdbId.value,
        Year: year.value,
        Title: title.value,
        Type: apiType.value,
        imdbVotes: imdbVotes.value,
    };
}

/**
 * Decodes an untrusted OMDb payload before it is mapped to a Title.
 *
 * @param raw - Parsed JSON body, which may be any value.
 * @returns Normalized response, or undefined when the payload is not an OMDb object.
 */
function decodeOmdbResponse(raw: unknown): OmdbResponse | undefined {
    if (!isRecord(raw)) return undefined;
    const response = readRequiredString(raw, 'Response');
    if (!response.ok) return undefined;
    if (response.value === OMDB_FAILURE) return { Response: response.value };
    if (response.value !== OMDB_SUCCESS) return undefined;
    return decodeOmdbSuccessResponse(raw);
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
        const raw = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        const json = decodeOmdbResponse(raw);
        if (!json) {
            this.logger.warn(`Malformed OMDb response for "${displayTitle}"`, { response: raw });
            return undefined;
        }
        if (json.Response === 'False') {
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
            const raw = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
            const json = decodeOmdbResponse(raw);
            if (!json) {
                this.logger.warn(`Malformed OMDb response for "${searchTitle.displayTitle}"`, { response: raw });
                return undefined;
            }
            if (json.Response === 'False') {
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
