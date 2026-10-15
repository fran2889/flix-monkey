/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title, type TitleData } from '../title';

/**
 * Cache entry encapsulating both metadata and API data.
 * Provides clean separation between search keys (displayTitle, imdbId)
 * and API-returned data (Title fields).
 */
export class CacheEntry {
    readonly #displayTitle: string;
    readonly #imdbId: string | undefined;
    readonly #data: TitleData | undefined;
    readonly #expires: number | undefined;

    /**
     * @param {string} displayTitle - Netflix display title (search key)
     * @param {string | undefined} imdbId - IMDb ID for short-circuit optimization
     * @param {TitleData | undefined} data - Title data without displayTitle
     * @param {number | undefined} expires - Expiry timestamp or undefined for never expires
     */
    constructor(
        displayTitle: string,
        imdbId: string | undefined,
        data: TitleData | undefined,
        expires: number | undefined
    ) {
        this.#displayTitle = displayTitle;
        this.#imdbId = imdbId;
        this.#data = data;
        this.#expires = expires;
    }

    /**
     * Parses a JSON string from storage and returns a CacheEntry instance.
     * Literal nulls from entries written before the null to undefined
     * migration are normalized to undefined.
     *
     * @param {string} raw - Raw JSON string from storage
     * @returns {CacheEntry} New CacheEntry instance
     */
    static fromJSON(raw: string): CacheEntry {
        const obj = JSON.parse(raw) as {
            displayTitle: string;
            imdbId: string | null | undefined;
            data: object | null | undefined;
            expires: number | null | undefined;
        };
        // Entries written before the null to undefined migration carry literal nulls;
        // collapse them here so the parsed entry keeps the undefined-only contract.
        return new CacheEntry(
            obj.displayTitle,
            obj.imdbId ?? undefined,
            (obj.data ?? undefined) as TitleData | undefined,
            obj.expires ?? undefined
        );
    }

    /**
     * Combines cached data with entry metadata to create a complete Title object.
     *
     * @returns {Title|undefined} Hydrated Title, or undefined if data is missing or invalid
     */
    getTitle(): Title | undefined {
        if (!this.#data) return undefined;
        return Title.fromCacheJSON(this.#data, this.#displayTitle);
    }

    /**
     * Converts the cache entry to a plain object suitable for JSON storage.
     *
     * @returns {object} Plain object for JSON serialization
     */
    toJSON(): {
        displayTitle: string;
        imdbId: string | undefined;
        data: TitleData | undefined;
        expires: number | undefined;
    } {
        return {
            displayTitle: this.#displayTitle,
            imdbId: this.#imdbId,
            data: this.#data,
            expires: this.#expires,
        };
    }

    /**
     * @returns {string | undefined} The IMDb ID for this cache entry
     */
    get imdbId(): string | undefined {
        return this.#imdbId;
    }

    /**
     * @returns {boolean} Whether this cache entry has expired
     */
    get isExpired(): boolean {
        return this.#expires !== undefined && Date.now() > this.#expires;
    }
}
