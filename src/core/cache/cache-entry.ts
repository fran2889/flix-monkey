/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title, type Title as TitleType } from '../title.js';

/**
 * Cache entry encapsulating both metadata and API data.
 * Provides clean separation between search keys (displayTitle, imdbId)
 * and API-returned data (Title fields).
 */
export class CacheEntry {
    #displayTitle: string;
    #imdbId: string | null;
    #data: Omit<TitleType, 'displayTitle'> | null;
    #expires: number | null;

    /**
     * @param {string} displayTitle - Netflix display title (search key)
     * @param {string | null} imdbId - IMDb ID for short-circuit optimization
     * @param {Omit<TitleType, 'displayTitle'> | null} data - Title data without displayTitle
     * @param {number | null} expires - Expiry timestamp or null for never expires
     */
    constructor(
        displayTitle: string,
        imdbId: string | null,
        data: Omit<TitleType, 'displayTitle'> | null,
        expires: number | null
    ) {
        this.#displayTitle = displayTitle;
        this.#imdbId = imdbId;
        this.#data = data;
        this.#expires = expires;
    }

    /**
     * Parses a JSON string from storage and returns a CacheEntry instance.
     *
     * @param {string} raw - Raw JSON string from storage
     * @returns {CacheEntry} New CacheEntry instance
     */
    static fromJSON(raw: string): CacheEntry {
        const obj = JSON.parse(raw) as {
            displayTitle: string;
            imdbId: string | null;
            data: object | null;
            expires: number | null;
        };
        return new CacheEntry(obj.displayTitle, obj.imdbId, obj.data as Omit<TitleType, 'displayTitle'> | null, obj.expires);
    }

    /**
     * Combines cached data with entry metadata to create a complete Title object.
     *
     * @returns {Title|null} Hydrated Title, or null if data is missing
     */
    getTitle(): Title | null {
        if (!this.#data) return null;
        return Title.fromCacheJSON(this.#data, this.#displayTitle);
    }

    /**
     * Converts the cache entry to a plain object suitable for JSON storage.
     *
     * @returns {object} Plain object for JSON serialization
     */
    toJSON(): {
        displayTitle: string;
        imdbId: string | null;
        data: Omit<TitleType, 'displayTitle'> | null;
        expires: number | null;
    } {
        return {
            displayTitle: this.#displayTitle,
            imdbId: this.#imdbId,
            data: this.#data,
            expires: this.#expires,
        };
    }

    /**
     * @returns {string | null} The IMDb ID for this cache entry
     */
    get imdbId(): string | null {
        return this.#imdbId;
    }

    /**
     * @returns {boolean} Whether this cache entry has expired
     */
    get isExpired(): boolean {
        return this.#expires !== null && Date.now() > this.#expires;
    }
}
