/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { buildImdbUrl } from './utils/index';

/**
 * Options for creating a Title instance.
 * String values for numeric fields are accepted and normalized to numbers.
 */
export interface TitleOptions {
    displayTitle?: string | undefined;
    apiTitle?: string | undefined;
    imdbId?: string | undefined;
    year?: string | number | undefined;
    imdbRating?: string | number | undefined;
    imdbVotes?: string | number | undefined;
    rtRating?: string | number | undefined;
    mcRating?: string | number | undefined;
    source?: string | undefined;
    type?: string | undefined;
}

/**
 * Immutable data class representing a movie or show with its ratings.
 *
 * Rating values are normalised during construction: `undefined`, empty
 * strings, and `"N/A"` are all collapsed to `undefined`; numeric strings are parsed
 * to the appropriate number type per field.
 */
export class Title {
    displayTitle: string | undefined;
    apiTitle: string | undefined;
    imdbId: string | undefined;
    year: number | undefined;
    imdbRating: number | undefined;
    imdbVotes: number | undefined;
    rtRating: number | undefined;
    mcRating: number | undefined;
    source: string | undefined;
    type: string | undefined;

    /**
     * @param {TitleOptions} [options]
     */
    constructor({
        displayTitle,
        apiTitle,
        imdbId,
        year,
        imdbRating,
        imdbVotes,
        rtRating,
        mcRating,
        source,
        type,
    }: TitleOptions = {}) {
        // JSON-decoded input (legacy cache entries, untyped callers) can carry literal
        // nulls; collapse them here so no instance ever holds a null field.
        this.displayTitle = displayTitle ?? undefined;
        this.apiTitle = apiTitle ?? undefined;
        this.imdbId = imdbId ?? undefined;
        const normalizedYear = year ?? undefined;
        this.year = normalizedYear === undefined ? undefined : Number.parseInt(normalizedYear as string, 10);
        this.imdbRating = this.#normalizeRating(imdbRating, (v: unknown) => {
            const num = Number.parseFloat(v as string);
            return Number.isNaN(num) ? undefined : num;
        });
        this.imdbVotes = this.#normalizeRating(imdbVotes, (v: unknown) => {
            const num = Number.parseInt(v as string, 10);
            return Number.isNaN(num) ? undefined : num;
        });
        this.rtRating = this.#normalizeRating(rtRating, (v: unknown) => {
            const num = Number.parseInt(v as string, 10);
            return Number.isNaN(num) ? undefined : num;
        });
        this.mcRating = this.#normalizeRating(mcRating, (v: unknown) => {
            const m = /^(\d+)/.exec(String(v));
            return m ? Number.parseInt(m[1], 10) : undefined;
        });
        this.source = source ?? undefined;
        this.type = type ?? undefined;
        Object.freeze(this);
    }

    /**
     * Returns a plain object representation suitable for cache serialization,
     * excluding displayTitle which is stored separately at the cache entry level.
     * @returns {TitleData} Title fields without displayTitle
     */
    toCacheJSON(): TitleData {
        const rest = { ...this };
        delete (rest as { displayTitle?: string }).displayTitle;
        return rest;
    }

    /**
     * Reconstructs a Title from cache data with displayTitle provided separately.
     * @param {TitleData} obj - Cache data object without displayTitle
     * @param {string} displayTitle - Display title from cache entry
     * @returns {Title} New Title instance
     */
    static fromCacheJSON(obj: TitleData, displayTitle: string): Title {
        return new Title({ ...obj, displayTitle });
    }

    #normalizeRating(val: unknown, converter: (_v: unknown) => number | undefined): number | undefined {
        if (val === null || val === undefined || val === '' || val === 'N/A') return undefined;
        return converter(val);
    }

    /**
     * Indicates whether this title has at least one rating (IMDb, Rotten Tomatoes, or Metacritic).
     *
     * @returns {boolean}
     */
    get hasRating(): boolean {
        return this.imdbRating !== undefined || this.rtRating !== undefined || this.mcRating !== undefined;
    }

    /**
     * @returns {string} IMDb URL for this title. Falls back to an IMDb search
     *   URL when `imdbId` is not available.
     */
    get imdbUrl(): string {
        return buildImdbUrl({ imdbId: this.imdbId, displayTitle: this.displayTitle });
    }

    /**
     * @param {string} source - API source that produced this title.
     * @returns {Title} A new immutable Title with this source.
     */
    withSource(source: string): Title {
        return new Title({ ...this, source });
    }

    /**
     * Creates a `Title` that represents a lookup miss (no ratings, no IDs).
     *
     * @param {string} displayTitle - The streaming-service title that was searched.
     * @param {string} [source] - API source that produced the miss.
     * @returns {Title}
     */
    static notFound(displayTitle: string, source?: string): Title {
        return new Title({ displayTitle, source });
    }
}

/**
 * Plain data shape for a serialized Title: the normalized field values
 * without displayTitle (stored separately at the cache entry level).
 */
export type TitleData = Pick<
    Title,
    'apiTitle' | 'imdbId' | 'year' | 'imdbRating' | 'imdbVotes' | 'rtRating' | 'mcRating' | 'source' | 'type'
>;
