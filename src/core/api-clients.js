import { RequestQueue } from './request-queue.js';
import { Title } from './title.js';
import { ApiSource, RATE_LIMITS, CLIENT_DISABLE_DURATION } from './constants.js';
import { CONFIG } from './config.js';

const createClientLogger = clientName => ({
    search: (title, year) =>
        console.warn(`[FlixMonkey] Searching ${clientName} for title: "${title}"${year ? ` (${year})` : ''}`),
    fetchDetails: (id, title) =>
        console.warn(`[FlixMonkey] Fetching ${clientName} details for ID: ${id} ("${title}")`),
    notFound: title => console.warn(`[FlixMonkey] No search results found in ${clientName} for: "${title}"`),
    failed: message => console.warn(`[FlixMonkey] ${clientName} failed: ${message}`),
});

function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

class BaseApiClient {
    #queue;
    #source;
    #disabledManager;
    #adapter;

    constructor(queue, source, disabledManager, adapter) {
        this.#queue = queue;
        this.#source = source;
        this.#disabledManager = disabledManager;
        this.#adapter = adapter;
    }

    get source() {
        return this.#source;
    }

    async isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    async disable(durationMs = CLIENT_DISABLE_DURATION) {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, durationMs);
        console.warn(
            `[FlixMonkey] ${this.constructor.name} disabled for ${durationMs / 60000}m. Purged ${count} queued requests.`
        );
    }

    async queuedFetch(url, priority = 0, responseType = 'json') {
        try {
            return await this.#queue.enqueue(
                url,
                priority,
                (u, rt) => this.#adapter.httpFetch(u, { responseType: rt }),
                responseType
            );
        } catch (err) {
            if (err.status >= 400 && err.status < 500) await this.disable();
            throw err;
        }
    }

    async fetch(displayTitle, domYear) {
        if (await this.isDisabled()) return null;
        try {
            const match = await this.search(displayTitle, domYear);
            if (!match) return null;
            const titleObj = await this.getDetails(match, displayTitle);
            if (titleObj) {
                titleObj.displayTitle = displayTitle;
                titleObj.source = this.#source;
            }
            return titleObj;
        } catch (err) {
            console.warn(`[FlixMonkey] ${this.constructor.name} failed: ${err.message}`);
            return null;
        }
    }

    async search(_displayTitle, _domYear) {
        throw new Error('Not implemented');
    }

    async getDetails(_match, _displayTitle) {
        throw new Error('Not implemented');
    }
}

export class XmdbApiClient extends BaseApiClient {
    #logger = createClientLogger('XMDB');

    constructor(disabledManager, adapter) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
            ApiSource.XMDB,
            disabledManager,
            adapter
        );
    }

    async search(displayTitle, domYear) {
        if (!CONFIG.xmdbApiKey || CONFIG.xmdbApiKey === 'YOUR_XMDB_API_KEY') return null;
        const searchParams = new URLSearchParams({ apiKey: CONFIG.xmdbApiKey, q: displayTitle, limit: 5 });
        this.#logger.search(displayTitle, domYear);
        const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
        if (!results?.length) { this.#logger.notFound(displayTitle); return null; }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) { this.#logger.notFound(displayTitle); return null; }
        return domYear
            ? (titleResults.find(r => String(r.year) === String(domYear)) ?? titleResults[0])
            : titleResults[0];
    }

    async getDetails({ id, title: searchResultTitle }, displayTitle) {
        this.#logger.fetchDetails(id, displayTitle);
        const detailsParams = new URLSearchParams({ apiKey: CONFIG.xmdbApiKey });
        const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        if (!detailsJson || detailsJson.error) return null;
        const { rating, ratings, year, title } = detailsJson;
        return new Title({
            apiTitle: title ?? searchResultTitle ?? null,
            imdbId: id,
            year,
            rating,
            rtRating: parseRatings(ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(ratings, /Metacritic/i),
        });
    }
}

export class OmdbApiClient extends BaseApiClient {
    #logger = createClientLogger('OMDB');

    constructor(disabledManager, adapter) {
        super(new RequestQueue(RATE_LIMITS[ApiSource.OMDB], null, adapter), ApiSource.OMDB, disabledManager, adapter);
    }

    async search(displayTitle, domYear) {
        if (!CONFIG.omdbApiKey || CONFIG.omdbApiKey === 'YOUR_OMDB_API_KEY') return null;
        return { title: displayTitle, year: domYear };
    }

    async getDetails({ title: t, year: y }, _displayTitle) {
        const params = new URLSearchParams({ apikey: CONFIG.omdbApiKey, t });
        if (y) params.set('y', y);
        this.#logger.fetchDetails(t, _displayTitle);
        const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        if (json.Response === 'False') { this.#logger.notFound(t); return null; }
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle } = json;
        const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
        return new Title({
            apiTitle: apiTitle ?? null,
            imdbId: imdbID,
            year: releaseYear,
            rating: imdbRating,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
        });
    }
}

export class ImdbApiDevClient extends BaseApiClient {
    #logger = createClientLogger('IMDb API Dev');

    constructor(disabledManager, adapter) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.IMDBAPI], null, adapter),
            ApiSource.IMDBAPI,
            disabledManager,
            adapter
        );
    }

    async search(displayTitle, domYear) {
        const searchParams = new URLSearchParams({ query: displayTitle });
        this.#logger.search(displayTitle, domYear);
        const { titles } = await this.queuedFetch(`https://api.imdbapi.dev/search/titles?${searchParams}`, 0);
        if (!titles?.length) { this.#logger.notFound(displayTitle); return null; }
        if (domYear) {
            const targetYear = Number.parseInt(domYear);
            const nearYear = titles.find(t => Math.abs(t.startYear - targetYear) <= 1);
            if (nearYear) return nearYear;
        }
        return titles[0];
    }

    async getDetails(match, displayTitle) {
        this.#logger.fetchDetails(match.id, match.title ?? displayTitle);
        return new Title({
            apiTitle: match.title ?? null,
            imdbId: match.id,
            year: match.startYear,
            rating: match.rating?.aggregateRating,
            rtRating: null,
            mcRating: match.metacritic?.score ?? null,
        });
    }
}
