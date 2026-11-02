/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from '../constants';
import { PROVIDER_RATE_LIMITS } from '../rate-limits';
import { RequestQueue } from '../request-queue';
import { Title } from '../title';
import { type ApiClientDeps, BaseApiClient } from './base-api-client';
import { decodeArray, isRecord, readOptionalArray, readOptionalNumber, readRequiredString } from './decode-utils';
import { mapAgregarrTitleType } from './title-type-mappers';

/** IMDb Suggestions `qid` values this provider can map to a canonical TitleType. */
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);

/**
 * Decodes one IMDb Suggestions result.
 *
 * Every suggestion carries `id`, `l`, and `qid`; `y` is absent (or null) for
 * people and other results that have no release year.
 *
 * @param raw - Untrusted result.
 * @returns Normalized result, or undefined when a required field is missing or mistyped.
 */
function decodeImdbSuggestionsResult(raw: unknown): ImdbSuggestionsResult | undefined {
    if (!isRecord(raw)) return undefined;
    const qid = readRequiredString(raw, 'qid');
    if (!qid.ok) return undefined;
    const id = readRequiredString(raw, 'id');
    if (!id.ok) return undefined;
    const label = readRequiredString(raw, 'l');
    if (!label.ok) return undefined;
    const year = readOptionalNumber(raw, 'y');
    if (!year.ok) return undefined;
    return { qid: qid.value, id: id.value, l: label.value, y: year.value };
}

/**
 * Decodes an untrusted IMDb Suggestions payload.
 *
 * @param raw - Parsed JSON body, which may be any value.
 * @returns Normalized response, or undefined when the payload is not a suggestions object.
 */
function decodeImdbSuggestionsResponse(raw: unknown): ImdbSuggestionsResponse | undefined {
    if (!isRecord(raw)) return undefined;
    const results = readOptionalArray(raw, 'd');
    if (!results.ok) return undefined;
    if (!results.value) return {};
    const decoded = decodeArray(results.value, decodeImdbSuggestionsResult);
    return decoded ? { d: decoded } : undefined;
}

/**
 * Decodes one Agregarr rating entry.
 *
 * Agregarr always echoes `imdbId`; `rating` and `votes` are `null` when the
 * title is unknown, so both stay optional.
 *
 * @param raw - Untrusted entry.
 * @returns Normalized entry, or undefined when a required field is missing or mistyped.
 */
function decodeAgregarrRatingEntry(raw: unknown): AgregarrRatingEntry | undefined {
    if (!isRecord(raw)) return undefined;
    const imdbId = readRequiredString(raw, 'imdbId');
    if (!imdbId.ok) return undefined;
    const rating = readOptionalNumber(raw, 'rating');
    if (!rating.ok) return undefined;
    const votes = readOptionalNumber(raw, 'votes');
    if (!votes.ok) return undefined;
    return { imdbId: imdbId.value, rating: rating.value, votes: votes.value };
}

/**
 * Decodes an untrusted Agregarr ratings payload.
 *
 * @param raw - Parsed JSON body, which may be any value.
 * @returns Normalized entries, or undefined when the payload is not an array.
 */
function decodeAgregarrRatingsResponse(raw: unknown): AgregarrRatingEntry[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    return decodeArray(raw, decodeAgregarrRatingEntry);
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
        const raw = await this.queuedFetch(`https://v3.sg.media-imdb.com/suggestion/titles/x/${encoded}.json`, 0);
        const data = decodeImdbSuggestionsResponse(raw);
        if (!data) {
            this.logger.warn(`Malformed IMDb Suggestions response for "${displayTitle}"`, { response: raw });
            return undefined;
        }
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
            year: match.y ?? undefined,
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
        const raw = await this.queuedFetch(`https://api.agregarr.org/api/ratings?id=${encodedId}`, 1);
        const ratings = decodeAgregarrRatingsResponse(raw);
        const entry = ratings?.[0];
        if (!entry) {
            this.logger.warn(`Agregarr details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
                response: raw ?? undefined,
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
