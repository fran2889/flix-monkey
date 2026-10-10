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
    displayTitle?: string | null;
    apiTitle?: string | null;
    imdbId?: string | null;
    year?: string | number | null;
    imdbRating?: string | number | null;
    imdbVotes?: string | number | null;
    rtRating?: string | number | null;
    mcRating?: string | number | null;
    source?: string | null;
    type?: string | null;
}

/**
 * Immutable data class representing a movie or show with its ratings.
 *
 * Rating values are normalised during construction: `null`, empty
 * strings, and `"N/A"` are all collapsed to `null`; numeric strings are parsed
 * to the appropriate number type per field.
 */
export class Title {
    displayTitle: string | null;
    apiTitle: string | null;
    imdbId: string | null;
    year: number | null;
    imdbRating: number | null;
    imdbVotes: number | null;
    rtRating: number | null;
    mcRating: number | null;
    source: string | null;
    type: string | null;

    /**
     * @param {TitleOptions} [options]
     */
    constructor({
        displayTitle = null,
        apiTitle = null,
        imdbId = null,
        year = null,
        imdbRating = null,
        imdbVotes = null,
        rtRating = null,
        mcRating = null,
        source = null,
        type = null,
    }: TitleOptions = {}) {
        this.displayTitle = displayTitle;
        this.apiTitle = apiTitle;
        this.imdbId = imdbId;
        this.year = year !== null ? Number.parseInt(year as string, 10) : null;
        this.imdbRating = this.#normalizeRating(imdbRating, (v: unknown) => {
            const num = Number.parseFloat(v as string);
            return Number.isNaN(num) ? null : num;
        });
        this.imdbVotes = this.#normalizeRating(imdbVotes, (v: unknown) => {
            const num = Number.parseInt(v as string, 10);
            return Number.isNaN(num) ? null : num;
        });
        this.rtRating = this.#normalizeRating(rtRating, (v: unknown) => {
            const num = Number.parseInt(v as string, 10);
            return Number.isNaN(num) ? null : num;
        });
        this.mcRating = this.#normalizeRating(mcRating, (v: unknown) => {
            const m = /^(\d+)/.exec(String(v));
            return m ? Number.parseInt(m[1], 10) : null;
        });
        this.source = source;
        this.type = type;
        Object.freeze(this);
    }

    /**
     * Returns a plain object representation suitable for cache serialization,
     * excluding displayTitle which is stored separately at the cache entry level.
     * @returns {Omit<Title, 'displayTitle'>} Title fields without displayTitle
     */
    toCacheJSON(): Omit<Title, 'displayTitle'> {
        const rest = { ...this };
        delete (rest as { displayTitle?: string | null }).displayTitle;
        return rest as Omit<Title, 'displayTitle'>;
    }

    /**
     * Reconstructs a Title from cache data with displayTitle provided separately.
     * @param {object} obj - Cache data object without displayTitle
     * @param {string | null} displayTitle - Display title from cache entry
     * @returns {Title | null} New Title instance or null if invalid
     */
    static fromCacheJSON(obj: unknown, displayTitle: string | null): Title | null {
        if (!obj || typeof obj !== 'object') return null;
        return new Title({ ...(obj as object), displayTitle });
    }

    #normalizeRating(val: unknown, converter: (_v: unknown) => number | null): number | null {
        if (val === null || val === undefined || val === '' || val === 'N/A') return null;
        return converter(val);
    }

    /**
     * Indicates whether this title has at least one rating (IMDb, Rotten Tomatoes, or Metacritic).
     *
     * @returns {boolean}
     */
    get hasRating(): boolean {
        return this.imdbRating !== null || this.rtRating !== null || this.mcRating !== null;
    }

    /**
     * @returns {string} IMDb URL for this title. Falls back to an IMDb search
     *   URL when `imdbId` is not available.
     */
    get imdbUrl(): string {
        return buildImdbUrl({ imdbId: this.imdbId, displayTitle: this.displayTitle });
    }

    /**
     * @param {string | null} source - API source that produced this title.
     * @returns {Title} A new immutable Title with this source.
     */
    withSource(source: string | null): Title {
        return new Title({ ...this, source });
    }

    /**
     * Creates a `Title` that represents a lookup miss (no ratings, no IDs).
     *
     * @param {string} displayTitle - The streaming-service title that was searched.
     * @param {string | null} [source=null] - API source that produced the miss.
     * @returns {Title}
     */
    static notFound(displayTitle: string, source: string | null = null): Title {
        return new Title({ displayTitle, source });
    }
}
