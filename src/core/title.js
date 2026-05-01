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

    get hasRating() {
        return !!(this.rating || this.rtRating || this.mcRating);
    }

    get imdbUrl() {
        return this.imdbId
            ? `https://www.imdb.com/title/${this.imdbId}/`
            : `https://www.imdb.com/find/?q=${encodeURIComponent(this.displayTitle ?? '')}`;
    }

    isBetterThan(other) {
        return !!this.rating && !other?.rating;
    }

    static fromJSON(obj) {
        return new Title(obj ?? {});
    }

    static notFound(displayTitle) {
        return new Title({ displayTitle });
    }

    #normalizeRating(val, converter) {
        if (!val || val === 'N/A') return null;
        return converter ? converter(val) : val;
    }
}
