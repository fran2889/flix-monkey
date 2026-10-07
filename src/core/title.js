/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { buildImdbUrl } from './utils/index.js';

/**
 * Immutable data class representing a movie or show with its ratings.
 *
 * Rating values are normalised during construction: `null`, `undefined`, empty
 * strings, and `"N/A"` are all collapsed to `null`; numeric strings are parsed
 * to the appropriate number type per field.
 */
export class Title {
    displayTitle;
    apiTitle;
    imdbId;
    year;
    imdbRating;
    imdbVotes;
    rtRating;
    mcRating;
    source;
    type;

    /**
     * Creates a title from an options object; every field defaults to null.
     *
     * @param {import('../types/title.js').TitleOptions} [options] - Partial title fields to initialize.
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
    } = {}) {
        this.displayTitle = displayTitle;
        this.apiTitle = apiTitle;
        this.imdbId = imdbId;
        this.year = year !== null ? Number.parseInt(year, 10) : null;
        this.imdbRating = this.#normalizeRating(imdbRating, v => {
            const num = Number.parseFloat(v);
            return Number.isNaN(num) ? null : num;
        });
        this.imdbVotes = this.#normalizeRating(imdbVotes, v => {
            const num = Number.parseInt(v, 10);
            return Number.isNaN(num) ? null : num;
        });
        this.rtRating = this.#normalizeRating(rtRating, v => {
            const num = Number.parseInt(v, 10);
            return Number.isNaN(num) ? null : num;
        });
        this.mcRating = this.#normalizeRating(mcRating, v => {
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
     * @returns {object} Title fields without displayTitle
     */
    toCacheJSON() {
        const rest = { ...this };
        delete rest.displayTitle;
        return rest;
    }

    /**
     * Reconstructs a Title from cache data with displayTitle provided separately.
     * @param {object} obj - Cache data object without displayTitle
     * @param {string|null} displayTitle - Display title from cache entry
     * @returns {Title} New Title instance
     */
    static fromCacheJSON(obj, displayTitle) {
        if (!obj || typeof obj !== 'object') return null;
        return new Title({ ...obj, displayTitle });
    }

    #normalizeRating(val, converter) {
        if (val === null || val === undefined || val === '' || val === 'N/A') return null;
        return converter(val);
    }

    get hasRating() {
        return this.imdbRating !== null || this.rtRating !== null || this.mcRating !== null;
    }

    /**
     * Builds the IMDb URL for this title.
     *
     * @returns {string} IMDb URL for this title. Falls back to an IMDb search
     *   URL when `imdbId` is not available.
     */
    get imdbUrl() {
        return buildImdbUrl({ imdbId: this.imdbId, displayTitle: this.displayTitle });
    }

    /**
     * Returns a copy of this title tagged with the API source that produced it.
     *
     * @param {import('../types/title.js').ApiSourceValue} source - API source that produced this title.
     * @returns {Title} A new immutable Title with this source.
     */
    withSource(source) {
        return new Title({ ...this, source });
    }

    /**
     * Creates a `Title` that represents a lookup miss (no ratings, no IDs).
     *
     * @param {string} displayTitle - The streaming-service title that was searched.
     * @param {import('../types/title.js').ApiSourceValue|null} [source=null] - API source that produced the miss.
     * @returns {Title} Title carrying no ratings and no IMDb ID.
     */
    static notFound(displayTitle, source = null) {
        return new Title({ displayTitle, source });
    }
}
