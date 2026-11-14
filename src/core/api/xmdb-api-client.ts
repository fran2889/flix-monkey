/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ClientStatus } from '../../types/api';
import { ApiSource } from '../constants';
import {
    assertRecord,
    optionalArray,
    optionalNumber,
    optionalString,
    parseRequiredItems,
    requiredString,
} from '../parse-utils';
import { Title } from '../title';
import { type ApiClientDeps, BaseApiClient } from './base-api-client';
import { mapXmdbTitleType } from './title-type-mappers';

/** Normalized XMDb search result. */
interface XmdbSearchResult {
    type: string;
    id: string;
    name: string;
    year?: number | undefined;
}

/** Normalized XMDb search response. */
interface XmdbSearchResponse {
    results?: XmdbSearchResult[] | undefined;
}

/** Normalized XMDb details response for a title that was found. */
interface XmdbDetailsFound {
    status: 'found';
    id: string;
    title: string;
    rating?: number | undefined;
    release_year?: number | undefined;
    metascore?: number | undefined;
    title_type?: string | undefined;
    vote_count?: number | undefined;
}

/** Normalized XMDb details response for a title the provider does not have. */
interface XmdbDetailsNotFound {
    status: 'not-found';
    error?: string | undefined;
}

/** Normalized XMDb details response. */
type XmdbDetailsResponse = XmdbDetailsFound | XmdbDetailsNotFound;

/**
 * API client for XMDb service that provides comprehensive movie and series data with ratings.
 */
export class XmdbApiClient extends BaseApiClient {
    constructor(deps: ApiClientDeps) {
        super(deps, ApiSource.XMDB);
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
        const response = await this.fetchParsed(
            `https://xmdbapi.com/api/v1/search?${searchParams}`,
            0,
            parseXmdbSearchResponse,
            `XMDb search for "${displayTitle}"`
        );
        if (!response) return undefined;
        const { results } = response;
        if (!results?.length) {
            this.logger.info(`No search results found in XMDb for "${displayTitle}"`);
            return undefined;
        }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) {
            this.logger.info(`No supported title-type results found in XMDb for "${displayTitle}"`);
            return undefined;
        }
        const [match] = titleResults;
        return match ? titleFromSearchResult(displayTitle, match) : undefined;
    }

    /**
     * Fetches detailed ratings and metadata from XMDb API.
     *
     * @param searchTitle - Title from search results with IMDb ID.
     * @returns Title with ratings and metadata, or undefined when no IMDb ID is available or the request fails.
     */
    async getDetails(searchTitle: Title): Promise<Title | undefined> {
        const id = searchTitle.imdbId;
        if (!id) return undefined;
        this.logger.debug(`Fetching XMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
        const apiKey = this.config.get('xmdbApiKey');
        const detailsParams = new URLSearchParams({ apiKey });
        const details = await this.fetchParsed(
            `https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`,
            1,
            parseXmdbDetailsResponse,
            `XMDb details for "${searchTitle.displayTitle}" (ID: ${id})`
        );
        if (!details) return undefined;
        if (details.status === 'not-found') {
            const message = details.error ? `: ${details.error}` : '';
            this.logger.info(`No XMDb details found for "${searchTitle.displayTitle}" (ID: ${id})${message}`);
            return undefined;
        }
        return titleFromDetailsResponse(searchTitle, details);
    }
}

function parseXmdbSearchResponse(raw: unknown): XmdbSearchResponse {
    assertRecord(raw);
    const results = optionalArray(raw, 'results');
    if (!results) return {};
    return { results: parseRequiredItems(results, parseXmdbSearchResult, 'the "results" array') };
}

function parseXmdbSearchResult(raw: unknown): XmdbSearchResult {
    assertRecord(raw);
    return {
        type: requiredString(raw, 'type'),
        id: requiredString(raw, 'id'),
        name: requiredString(raw, 'name'),
        year: optionalNumber(raw, 'year'),
    };
}

function titleFromSearchResult(displayTitle: string, result: XmdbSearchResult): Title {
    return new Title({
        displayTitle,
        apiTitle: result.name,
        imdbId: result.id,
        year: result.year,
    });
}

function parseXmdbDetailsResponse(raw: unknown): XmdbDetailsResponse {
    assertRecord(raw);
    const error = optionalString(raw, 'error');
    if (error) return { status: 'not-found', error };
    // The details endpoint keeps id and sends title: null for a missing title.
    if (raw['title'] === null) return { status: 'not-found' };
    return {
        status: 'found',
        id: requiredString(raw, 'id'),
        title: requiredString(raw, 'title'),
        rating: optionalNumber(raw, 'rating'),
        release_year: optionalNumber(raw, 'release_year'),
        metascore: optionalNumber(raw, 'metascore'),
        title_type: optionalString(raw, 'title_type'),
        vote_count: optionalNumber(raw, 'vote_count'),
    };
}

function titleFromDetailsResponse(searchTitle: Title, details: XmdbDetailsFound): Title {
    const { id, rating, release_year, title, metascore, title_type, vote_count } = details;
    return new Title({
        displayTitle: searchTitle.displayTitle,
        apiTitle: title,
        imdbId: id,
        year: release_year ?? searchTitle.year,
        imdbRating: rating,
        imdbVotes: vote_count,
        mcRating: metascore,
        type: mapXmdbTitleType(title_type),
    });
}
