/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * @typedef {Object} TitleOptions
 * @property {string|null} [displayTitle=null] - Title as shown on the Netflix UI.
 * @property {string|null} [apiTitle=null] - Canonical title returned by the API.
 * @property {string|null} [imdbId=null] - IMDb ID (e.g. `"tt1234567"`).
 * @property {number|string|null} [year=null] - Release year; coerced to integer.
 * @property {number|string|null} [rating=null] - IMDb rating (0–10); coerced to float.
 * @property {number|string|null} [rtRating=null] - Rotten Tomatoes score (0–100); coerced to integer.
 * @property {number|string|null} [mcRating=null] - Metacritic score (0–100); leading digits extracted, coerced to integer.
 * @property {string|null} [source=null] - API source that produced this title (an `ApiSource` value).
 */

/**
 * Immutable-style data class representing a movie or show with its ratings.
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
    rtRating;
    /** @type {number|null} */
    mcRating;
    /** @type {string|null} */
    source;

    /** @param {TitleOptions} [options] */
    constructor({
        displayTitle = null,
        apiTitle = null,
        imdbId = null,
        year = null,
        rating = null,
        rtRating = null,
        mcRating = null,
        source = null,
    } = {}) {
        this.displayTitle = displayTitle;
        this.apiTitle = apiTitle;
        this.imdbId = imdbId;
        this.year = year !== null && year !== undefined ? Number.parseInt(year, 10) : null;
        this.rating = this.#normalizeRating(rating, v => {
            const num = parseFloat(v);
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
    }

    /** @returns {boolean} `true` if at least one rating (IMDb, RT, or Metacritic) is present. */
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
     * Reconstitutes a `Title` from a plain object (e.g. a parsed cache entry).
     *
     * @param {Object|null} obj - Plain object with `TitleOptions` shape.
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
     * @param {string|null} [source=null] - API source that produced the miss.
     * @returns {Title}
     */
    static notFound(displayTitle, source = null) {
        return new Title({ displayTitle, source });
    }

    /**
     * @param {*} val - Raw rating value from an API response.
     * @param {(v: *) => number|null} converter - Type-specific parser.
     * @returns {number|null}
     */
    #normalizeRating(val, converter) {
        if (val === null || val === undefined || val === '' || val === 'N/A') return null;
        return converter ? converter(val) : val;
    }
}
