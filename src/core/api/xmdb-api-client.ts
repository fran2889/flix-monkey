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
import { GLOBAL_SYNC_KEY, RequestQueue } from '../request-queue';
import { Title } from '../title';
import { BaseApiClient } from './base-api-client';
import { mapXmdbTitleType } from './title-type-mappers';

/**
 * API client for XMDb service that provides comprehensive movie and series data with ratings.
 */
export class XmdbApiClient extends BaseApiClient {
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
            new RequestQueue(adapter, RATE_LIMITS[ApiSource.XMDB], GLOBAL_SYNC_KEY),
            ApiSource.XMDB
        );
    }

    /**
     * Checks if API key is configured and client is healthy.
     *
     * @returns A health result suitable for provider selection.
     */
    override async getStatus(): Promise<ClientStatus> {
        const apiKey = this.config.get('xmdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    /**
     * Searches for a title using XMDb API.
     *
     * @param displayTitle - The title to search for.
     * @returns Title object or undefined if not found.
     */
    async search(displayTitle: string): Promise<Title | undefined> {
        const apiKey = this.config.get('xmdbApiKey');
        const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: String(5) });
        this.logger.debug(`Searching XMDb for title: "${displayTitle}"`);
        const response = (await this.queuedFetch(
            `https://xmdbapi.com/api/v1/search?${searchParams}`,
            0
        )) as XmdbSearchResponse;
        const { results } = response;
        if (!results?.length) {
            this.logger.info(`No search results found in XMDb for "${displayTitle}"`);
            return undefined;
        }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) {
            this.logger.info(`No title-type results found in XMDb for "${displayTitle}"`);
            return undefined;
        }
        const match = titleResults[0];
        return new Title({
            displayTitle,
            apiTitle: match.title ?? undefined,
            imdbId: match.id ?? undefined,
            year: match.release_year ?? match.year ?? undefined,
            imdbRating: undefined,
            imdbVotes: undefined,
            rtRating: undefined,
            mcRating: undefined,
            type: undefined,
            source: undefined,
        });
    }

    /**
     * Fetches detailed ratings and metadata from XMDb API.
     *
     * @param searchTitle - Title from search results with IMDb ID.
     * @returns Title with ratings and metadata or undefined on failure.
     */
    async getDetails(searchTitle: Title): Promise<Title | undefined> {
        const id = searchTitle.imdbId;
        this.logger.debug(`Fetching XMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
        const apiKey = this.config.get('xmdbApiKey');
        const detailsParams = new URLSearchParams({ apiKey });
        const detailsJson = (await this.queuedFetch(
            `https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`,
            1
        )) as XmdbDetailsResponse;
        if (!detailsJson || detailsJson.error || !detailsJson.title) {
            this.logger.warn(`XMDb details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: detailsJson ?? undefined,
            });
            return undefined;
        }
        const { rating, release_year, title, metascore, title_type, vote_count } = detailsJson;
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: title ?? searchTitle.apiTitle,
            imdbId: id,
            year: release_year ?? searchTitle.year,
            imdbRating: rating ?? undefined,
            imdbVotes: vote_count ?? undefined,
            rtRating: undefined,
            mcRating: metascore ?? undefined,
            type: mapXmdbTitleType(title_type ?? undefined),
            source: undefined,
        });
    }
}

/** XMDb search API response type */
interface XmdbSearchResponse {
    results?: Array<{
        type: string;
        title?: string;
        id?: string;
        release_year?: number;
        year?: number;
    }>;
}

/** XMDb details API response type */
interface XmdbDetailsResponse {
    error?: string;
    title?: string;
    rating?: number;
    release_year?: number;
    metascore?: number;
    title_type?: string;
    vote_count?: number;
}
