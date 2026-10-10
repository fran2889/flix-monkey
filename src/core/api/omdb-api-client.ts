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
import { RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { BaseApiClient } from './base-api-client';
import { mapOmdbTitleType } from './title-type-mappers';

/**
 * Extracts a rating value from an OMDb `Ratings` array by matching its source label.
 *
 * @param ratings - The `Ratings` field from an OMDb response.
 * @param sourcePattern - Pattern matched against the rating source name.
 * @returns Rating value, or null when absent or not an array.
 */
function parseRatings(ratings: unknown, sourcePattern: RegExp): number | null {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(
        r => r && sourcePattern.test((r as OmdbRatingEntry).source ?? (r as OmdbRatingEntry).Source ?? '')
    ) as OmdbRatingEntry | undefined;
    return entry?.value ?? entry?.Value ?? null;
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
            new RequestQueue(adapter, RATE_LIMITS[ApiSource.OMDB], null),
            ApiSource.OMDB
        );
    }

    /**
     * Checks if API key is configured and client is healthy.
     *
     * @returns A health result suitable for provider selection.
     */
    async getStatus(): Promise<ClientStatus> {
        const apiKey = this.config.get('omdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    /**
     * Searches for a title using OMDb API.
     *
     * @param displayTitle - The title to search for.
     * @returns Title object or null if not found.
     */
    async search(displayTitle: string): Promise<Title | null> {
        const apiKey = this.config.get('omdbApiKey');
        const params = new URLSearchParams({ apikey: apiKey, t: displayTitle });
        this.logger.debug(`Searching OMDb for title: "${displayTitle}"`);
        const json = (await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1)) as OmdbResponse;
        if (json.Response === 'False') {
            this.logger.info(`No OMDb results found for "${displayTitle}"`);
            return null;
        }
        return this.#parseOmdbResponse(json, displayTitle, null);
    }

    /**
     * Fetches full details for a title when search returned minimal data.
     *
     * @param searchTitle - Title from search results.
     * @returns Title with full details.
     */
    async getDetails(searchTitle: Title): Promise<Title | null> {
        // OMDb search already returns full details; only fetch if we have a minimal title (no apiTitle)
        if (searchTitle.imdbId && searchTitle.apiTitle === null) {
            const id = searchTitle.imdbId;
            const apiKey = this.config.get('omdbApiKey');
            const params = new URLSearchParams({ apikey: apiKey, i: id });
            this.logger.debug(`Fetching OMDb details by ID: ${id} ("${searchTitle.displayTitle}")`);
            const json = (await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1)) as OmdbResponse;
            if (json.Response === 'False') {
                this.logger.info(`No OMDb results found for ID: ${id}`);
                return null;
            }
            // @ts-ignore - TypeScript incorrectly infers parameter type due to exactOptionalPropertyTypes
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
    #parseOmdbResponse(json: OmdbResponse, displayTitle: string, fallbackImdbId: string | null): Title {
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
        const releaseYear = Year ? (Year.match(/^\d{4}/)?.[0] ?? null) : null;
        const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replaceAll(',', ''), 10) : null;
        return new Title({
            displayTitle,
            apiTitle: apiTitle ?? null,
            imdbId: imdbID ?? fallbackImdbId ?? null,
            year: releaseYear ? Number(releaseYear) : null,
            imdbRating: imdbRating !== undefined ? Number(imdbRating) : null,
            imdbVotes: votes,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
            type: mapOmdbTitleType(apiType ?? null),
            source: null,
        });
    }
}

/** OMDb rating entry type */
interface OmdbRatingEntry {
    source?: string;
    Source?: string;
    value?: number;
    Value?: number;
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
