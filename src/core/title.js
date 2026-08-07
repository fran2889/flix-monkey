/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * @typedef {'xmdb'|'omdb'|'agregarr'} ApiSourceValue
 * @typedef {'movie'|'series'} TitleTypeValue
 */
/**
 * @typedef {Object} TitleOptions
 * @property {string|null} [displayTitle=null] - Title as shown on the Netflix UI.
 * @property {string|null} [apiTitle=null] - Canonical title returned by the API.
 * @property {string|null} [imdbId=null] - IMDb ID (e.g. `"tt1234567"`).
 * @property {number|string|null} [year=null] - Release year; coerced to integer.
 * @property {number|string|null} [rating=null] - IMDb rating (0-10); coerced to float.
 * @property {number|string|null} [imdbVotes=null] - IMDb vote count; coerced to integer.
 * @property {number|string|null} [rtRating=null] - Rotten Tomatoes score (0-100); coerced to integer.
 * @property {number|string|null} [mcRating=null] - Metacritic score (0-100); leading digits extracted, coerced to integer.
 * @property {ApiSourceValue|null} [source=null] - API source that produced this title.
 * @property {TitleTypeValue|null} [type=null] - Movie or series title type.
 */

/**
 * Immutable data class representing a movie or show with its ratings.
 *
 * Rating values are normalised during construction: `null`, `undefined`, empty
 * strings, and `"N/A"` are all collapsed to `null`; numeric strings are parsed
 * to the appropriate number type per field.
 */
export class Title {
    /** @type {string|null} */
    displayTitle;
    /** @type {string|null} */
    apiTitle;
    /** @type {string|null} */
    imdbId;
    /** @type {number|null} */
    year;
    /** @type {number|null} */
    rating;
    /** @type {number|null} */
    imdbVotes;
    /** @type {number|null} */
    rtRating;
    /** @type {number|null} */
    mcRating;
    /** @type {ApiSourceValue|null} */
    source;
    /** @type {TitleTypeValue|null} */
    type;

    /** @param {TitleOptions} [options] */
    constructor({
        displayTitle = null,
        apiTitle = null,
        imdbId = null,
        year = null,
        rating = null,
        imdbVotes = null,
        rtRating = null,
        mcRating = null,
        source = null,
        type = null,
    } = {}) {
        this.displayTitle = displayTitle;
        this.apiTitle = apiTitle;
        this.imdbId = imdbId;
        this.year = year !== null && year !== undefined ? Number.parseInt(year, 10) : null;
        this.rating = this.#normalizeRating(rating, v => {
            const num = parseFloat(v);
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
            const m = String(v).match(/^(\d+)/);
            return m ? Number.parseInt(m[1], 10) : null;
        });
        this.source = source ?? null;
        this.type = type ?? null;
        Object.freeze(this);
    }

    /** @returns {boolean} `true` if at least one rating (IMDb, Metacritic, or RT) is present. */
    get hasRating() {
        return this.rating !== null || this.rtRating !== null || this.mcRating !== null;
    }

    /**
     * @returns {string} IMDb URL for this title. Falls back to an IMDb search
     *   URL when `imdbId` is not available.
     */
    get imdbUrl() {
        return this.imdbId
            ? `https://www.imdb.com/title/${this.imdbId}/`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(this.displayTitle ?? '')}`;
    }

    /**
     * Returns a copy with the API source replaced.
     *
     * @param {ApiSourceValue|null} source - API source that produced this title.
     * @returns {Title}
     */
    withSource(source) {
        return new Title({ ...this, source });
    }

    /**
     * Reconstitutes a `Title` from a plain object (e.g. a parsed cache entry).
     *
     * @param {unknown} obj - Parsed cache data with an optional `TitleOptions` shape.
     * @returns {Title|null} A new `Title` instance, or `null` if `obj` is falsy or not an object.
     */
    static fromJSON(obj) {
        if (!obj || typeof obj !== 'object') return null;
        return new Title(obj);
    }

    /**
     * Creates a `Title` that represents a lookup miss (no ratings, no IDs).
     *
     * @param {string} displayTitle - The Netflix display title that was searched.
     * @param {ApiSourceValue|null} [source=null] - API source that produced the miss.
     * @returns {Title}
     */
    static notFound(displayTitle, source = null) {
        return new Title({ displayTitle, source });
    }

    #normalizeRating(val, converter) {
        if (val === null || val === undefined || val === '' || val === 'N/A') return null;
        return converter ? converter(val) : val;
    }
}
