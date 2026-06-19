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
export class Title {
    constructor({
        displayTitle = null,
        apiTitle = null,
        imdbId = null,
        year = null,
        rating = null,
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
    }

    get hasRating() {
        return this.rating !== null || this.rtRating !== null || this.mcRating !== null;
    }

    get imdbUrl() {
        return this.imdbId
            ? `https://www.imdb.com/title/${this.imdbId}/`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(this.displayTitle ?? '')}`;
    }

    static fromJSON(obj) {
        if (!obj || typeof obj !== 'object') return null;
        return new Title(obj);
    }

    static notFound(displayTitle, source = null) {
        return new Title({ displayTitle, source });
    }

    #normalizeRating(val, converter) {
        if (val === null || val === undefined || val === '' || val === 'N/A') return null;
        return converter ? converter(val) : val;
    }
}
