/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from '../title.js';

/**
 * Cache entry encapsulating both metadata and API data.
 * Provides clean separation between search keys (displayTitle, imdbId)
 * and API-returned data (Title fields).
 */
export class CacheEntry {
    #displayTitle;
    #imdbId;
    #data;
    #expires;

    /**
     * @param {string} displayTitle - Netflix display title (search key)
     * @param {string|null} imdbId - IMDb ID for short-circuit optimization
     * @param {object} data - Title data without displayTitle
     * @param {number|null} expires - Expiry timestamp or null for never expires
     */
    constructor(displayTitle, imdbId, data, expires) {
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
    static fromJSON(raw) {
        const obj = JSON.parse(raw);
        return new CacheEntry(obj.displayTitle, obj.imdbId, obj.data, obj.expires);
    }

    /**
     * Combines cached data with entry metadata to create a complete Title object.
     *
     * @returns {import('../title.js').Title|null} Hydrated Title, or null if data is missing
     */
    getTitle() {
        if (!this.#data) return null;
        return Title.fromCacheJSON(this.#data, this.#displayTitle);
    }

    /**
     * Converts the cache entry to a plain object suitable for JSON storage.
     *
     * @returns {object} Plain object for JSON serialization
     */
    toJSON() {
        return {
            displayTitle: this.#displayTitle,
            imdbId: this.#imdbId,
            data: this.#data,
            expires: this.#expires,
        };
    }

    /**
     * @returns {string|null}
     */
    get imdbId() {
        return this.#imdbId;
    }

    /**
     * @returns {boolean}
     */
    get isExpired() {
        return this.#expires !== null && Date.now() > this.#expires;
    }
}
