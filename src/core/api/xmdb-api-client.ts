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
    decodeValidItems,
    isRecord,
    readOptionalArray,
    readOptionalNumber,
    readOptionalString,
    readRequiredString,
} from './decode-utils';
import { mapXmdbTitleType } from './title-type-mappers';

function decodeXmdbSearchResponse(raw: unknown): XmdbSearchResponse | undefined {
    if (!isRecord(raw)) return undefined;
    const results = readOptionalArray(raw, 'results');
    if (!results.ok) return undefined;
    if (!results.value) return {};
    return { results: decodeValidItems(results.value, decodeXmdbSearchResult) };
}

function decodeXmdbSearchResult(raw: unknown): XmdbSearchResult | undefined {
    if (!isRecord(raw)) return undefined;
    const type = readRequiredString(raw, 'type');
    if (!type.ok) return undefined;
    const id = readRequiredString(raw, 'id');
    if (!id.ok) return undefined;
    const name = readRequiredString(raw, 'name');
    if (!name.ok) return undefined;
    // Person results have no release year.
    const year = readOptionalNumber(raw, 'year');
    if (!year.ok) return undefined;
    return { type: type.value, id: id.value, name: name.value, year: year.value };
}

function decodeXmdbDetailsResponse(raw: unknown): XmdbDetailsResponse | undefined {
    if (!isRecord(raw)) return undefined;
    const error = readOptionalString(raw, 'error');
    if (!error.ok) return undefined;
    if (error.value) return undefined;
    const id = readRequiredString(raw, 'id');
    if (!id.ok) return undefined;
    // The not-found payload keeps id but sends title: null.
    const title = readRequiredString(raw, 'title');
    if (!title.ok) return undefined;
    const fields = decodeXmdbDetailsFields(raw);
    if (!fields) return undefined;
    return { id: id.value, title: title.value, ...fields };
}

function decodeXmdbDetailsFields(raw: Record<string, unknown>): XmdbDetailsFields | undefined {
    const rating = readOptionalNumber(raw, 'rating');
    if (!rating.ok) return undefined;
    const releaseYear = readOptionalNumber(raw, 'release_year');
    if (!releaseYear.ok) return undefined;
    const metascore = readOptionalNumber(raw, 'metascore');
    if (!metascore.ok) return undefined;
    const titleType = readOptionalString(raw, 'title_type');
    if (!titleType.ok) return undefined;
    const voteCount = readOptionalNumber(raw, 'vote_count');
    if (!voteCount.ok) return undefined;
    return {
        rating: rating.value,
        release_year: releaseYear.value,
        metascore: metascore.value,
        title_type: titleType.value,
        vote_count: voteCount.value,
    };
}

/**
 * API client for XMDb service that provides comprehensive movie and series data with ratings.
 */
export class XmdbApiClient extends BaseApiClient {
    constructor(deps: ApiClientDeps) {
        const { minIntervalMs, syncKey } = PROVIDER_RATE_LIMITS[ApiSource.XMDB];
        super(deps, new RequestQueue(deps.adapter, minIntervalMs, syncKey), ApiSource.XMDB);
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
        const raw = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
        const response = decodeXmdbSearchResponse(raw);
        if (!response) {
            this.logger.warn(`Malformed XMDb response for "${displayTitle}"`, { response: raw });
            return undefined;
        }
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
            apiTitle: match.name,
            imdbId: match.id,
            year: match.year ?? undefined,
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
        const raw = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        const detailsJson = decodeXmdbDetailsResponse(raw);
        if (!detailsJson) {
            this.logger.warn(`XMDb details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: raw ?? undefined,
            });
            return undefined;
        }
        return this.#titleFromDetails(searchTitle, detailsJson);
    }

    #titleFromDetails(searchTitle: Title, details: XmdbDetailsResponse): Title {
        const { rating, release_year, title, metascore, title_type, vote_count } = details;
        return new Title({
            displayTitle: searchTitle.displayTitle,
            apiTitle: title ?? searchTitle.apiTitle,
            imdbId: searchTitle.imdbId,
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

/** Optional metadata fields of an XMDb details response. */
interface XmdbDetailsFields {
    rating?: number | undefined;
    release_year?: number | undefined;
    metascore?: number | undefined;
    title_type?: string | undefined;
    vote_count?: number | undefined;
}

/** Normalized XMDb details response. */
interface XmdbDetailsResponse extends XmdbDetailsFields {
    id: string;
    title: string;
}
