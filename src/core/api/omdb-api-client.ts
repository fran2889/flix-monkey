/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { ClientStatus } from '../../types/api';
import type { ConfigManager } from '../config/config-manager';
import { ApiSource } from '../constants';
import type { DisabledClientsManager } from '../disabled-clients';
import type { IdOverrideManager } from '../id-override-manager';
import type { Logger } from '../logger';
import { RATE_LIMIT_SYNC_KEYS, RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { BaseApiClient } from './base-api-client';
import { mapOmdbTitleType } from './title-type-mappers';

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
 * Extracts a rating value from an OMDb `Ratings` array by matching its source label.
 *
 * @param ratings - The `Ratings` field from an OMDb response.
 * @param sourcePattern - Pattern matched against the rating source name.
 * @returns Rating value, or undefined when absent or not an array.
 */
function parseRatings(ratings: unknown, sourcePattern: RegExp): number | undefined {
    if (!Array.isArray(ratings)) return undefined;
    const entry = ratings.find(
        r => r && sourcePattern.test((r as OmdbRatingEntry).source ?? (r as OmdbRatingEntry).Source ?? '')
    ) as OmdbRatingEntry | undefined;
    return toRating(entry?.value ?? entry?.Value);
}

/**
 * API client for OMDb service that provides movie and series information with ratings.
 */
export class OmdbApiClient extends BaseApiClient {
    /**
     * @param adapter - Platform adapter for HTTP and storage.
     * @param config - Application configuration.
     * @param disabledManager - Tracks temporarily disabled clients.
     * @param logger - Required; every lookup and failure path logs.
     * @param overrideManager - Manager for ID overrides.
     */
    constructor(
        adapter: PlatformAdapter,
        config: ConfigManager,
        disabledManager: DisabledClientsManager,
        logger: Logger,
        overrideManager: IdOverrideManager
    ) {
        super(
            adapter,
            config,
            disabledManager,
            logger,
            overrideManager,
            new RequestQueue(adapter, RATE_LIMITS[ApiSource.OMDB], RATE_LIMIT_SYNC_KEYS[ApiSource.OMDB]),
            ApiSource.OMDB
        );
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
        const json = (await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1)) as OmdbResponse;
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
            const json = (await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1)) as OmdbResponse;
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
     * @param json - OMDb API response
     * @param displayTitle - Display title from streaming service
     * @param fallbackImdbId - Fallback IMDb ID from search results
     * @returns Title instance
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

/** OMDb rating entry type. Ratings arrive as strings, for example "8.5" or "90%". */
interface OmdbRatingEntry {
    source?: string;
    Source?: string;
    value?: string | number;
    Value?: string | number;
}

/** OMDb API response type */
interface OmdbResponse {
    Response: string;
    imdbRating?: string | number;
    Ratings?: unknown;
    imdbID?: string;
    Year?: string;
    Title?: string;
    Type?: string;
    imdbVotes?: string;
}
