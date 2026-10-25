/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { buildImdbUrl } from './utils/index';

/**
 * Options for creating a Title instance.
 *
 * Numeric fields are strictly numeric: each API client owns the wire format of
 * its provider and converts it to a number before constructing a Title. Anything
 * that is not a finite number is collapsed to `undefined`.
 */
export interface TitleOptions {
    displayTitle: string;
    apiTitle?: string | undefined;
    imdbId?: string | undefined;
    year?: number | undefined;
    imdbRating?: number | undefined;
    imdbVotes?: number | undefined;
    rtRating?: number | undefined;
    mcRating?: number | undefined;
    source?: string | undefined;
    type?: string | undefined;
}

/**
 * Immutable data class representing a movie or show with its ratings.
 *
 * `year` and the rating fields are normalised during construction: every field
 * that is not a finite number is collapsed to `undefined`.
 */
export class Title {
    readonly displayTitle: string;
    readonly apiTitle: string | undefined;
    readonly imdbId: string | undefined;
    readonly year: number | undefined;
    readonly imdbRating: number | undefined;
    readonly imdbVotes: number | undefined;
    readonly rtRating: number | undefined;
    readonly mcRating: number | undefined;
    readonly source: string | undefined;
    readonly type: string | undefined;

    /**
     * @param options - Title fields to initialize.
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
    }: TitleOptions) {
        // JSON-decoded input (legacy cache entries, untyped callers) can carry literal
        // nulls; collapse them here so no instance ever holds a null field.
        this.displayTitle = displayTitle;
        this.apiTitle = apiTitle ?? undefined;
        this.imdbId = imdbId ?? undefined;
        this.year = this.#toFiniteNumber(year);
        this.imdbRating = this.#toFiniteNumber(imdbRating);
        this.imdbVotes = this.#toFiniteNumber(imdbVotes);
        this.rtRating = this.#toFiniteNumber(rtRating);
        this.mcRating = this.#toFiniteNumber(mcRating);
        this.source = source ?? undefined;
        this.type = type ?? undefined;
        Object.freeze(this);
    }

    /**
     * Returns a plain object representation suitable for cache serialization,
     * excluding displayTitle which is stored separately at the cache entry level.
     * @returns Title fields without displayTitle
     */
    toCacheJSON(): TitleData {
        const { displayTitle: _displayTitle, ...rest } = this;
        return rest;
    }

    /**
     * Reconstructs a Title from cache data with displayTitle provided separately.
     * This is the single validation boundary for untrusted Title payloads, so
     * callers holding decoded storage JSON hand the value over unchecked.
     *
     * @param obj - Untrusted cache data object without displayTitle
     * @param displayTitle - Display title from cache entry
     * @returns New Title instance, or undefined if obj is not a title object
     */
    static fromCacheJSON(obj: unknown, displayTitle: string): Title | undefined {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
        return new Title({ ...(obj as TitleData), displayTitle });
    }

    /**
     * Enforces the numeric contract: anything that is not a finite number (null,
     * undefined, NaN, Infinity, or a raw wire-format string) carries no value.
     */
    #toFiniteNumber(val: unknown): number | undefined {
        return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
    }

    /**
     * Indicates whether this title has at least one rating (IMDb, Rotten Tomatoes, or Metacritic).
     *
     * @returns True when at least one rating is present.
     */
    get hasRating(): boolean {
        return this.imdbRating !== undefined || this.rtRating !== undefined || this.mcRating !== undefined;
    }

    /**
     * @returns IMDb URL for this title. Falls back to an IMDb search
     *   URL when `imdbId` is not available.
     */
    get imdbUrl(): string {
        return buildImdbUrl({ imdbId: this.imdbId, displayTitle: this.displayTitle });
    }

    /**
     * Returns a copy of this title with the given API source.
     *
     * @param source - API source that produced this title.
     * @returns A new immutable Title with this source.
     */
    withSource(source: string): Title {
        return new Title({ ...this, source });
    }

    /**
     * Creates a `Title` that represents a lookup miss (no ratings, no IDs).
     *
     * @param displayTitle - The streaming-service title that was searched.
     * @param [source] - API source that produced the miss.
     * @returns A Title marked with no ratings or metadata.
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
