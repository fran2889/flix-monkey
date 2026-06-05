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
import { RequestQueue } from './request-queue.js';
import { Title } from './title.js';
import { ApiSource, RATE_LIMITS, CLIENT_DISABLE_DURATION } from './constants.js';
import { logger } from './logger.js';

function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

export class BaseApiClient {
    #queue;
    #source;
    #disabledManager;
    #adapter;
    #config;

    constructor(queue, source, disabledManager, adapter, config) {
        this.#queue = queue;
        this.#source = source;
        this.#disabledManager = disabledManager;
        this.#adapter = adapter;
        this.#config = config;
    }

    get config() {
        return this.#config;
    }

    get source() {
        return this.#source;
    }

    async isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    async getStatus() {
        if (await this.isDisabled()) {
            return { healthy: false, reason: 'Temporarily disabled due to errors' };
        }
        return { healthy: true };
    }

    async disable(durationMs = CLIENT_DISABLE_DURATION) {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, durationMs);
        logger.warn(`${this.constructor.name} disabled for ${durationMs / 60000}m. Purged ${count} queued requests.`);
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
            const status = err?.status;
            if (status >= 400 && status < 500) await this.disable();
            throw err;
        }
    }

    async fetch(displayTitle) {
        if (await this.isDisabled()) return null;
        try {
            const match = await this.search(displayTitle);
            if (!match) return null;
            const titleObj = await this.getDetails(match, displayTitle);
            if (titleObj) {
                titleObj.displayTitle = displayTitle;
                titleObj.source = this.#source;
            }
            return titleObj;
        } catch (err) {
            logger.warn(`${this.constructor.name} failed: ${err.message}`);
            return null;
        }
    }

    async search(_displayTitle) {
        throw new Error('Not implemented');
    }

    async getDetails(_match, _displayTitle) {
        throw new Error('Not implemented');
    }
}

export class XmdbApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
            ApiSource.XMDB,
            disabledManager,
            adapter,
            config
        );
    }

    async search(displayTitle) {
        const apiKey = this.config.get('xmdbApiKey');
        if (!apiKey || apiKey === 'YOUR_XMDB_API_KEY') return null;
        const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: 5 });
        logger.debug(`Searching XMDB for title: "${displayTitle}"`);
        const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
        if (!results?.length) {
            logger.debug(`No search results found in XMDB for: "${displayTitle}"`);
            return null;
        }
        const titleResults = results.filter(r => r.type === 'title');
        if (!titleResults.length) {
            logger.debug(`No search results found in XMDB for: "${displayTitle}"`);
            return null;
        }
        return titleResults[0];
    }

    async getDetails({ id, title: searchResultTitle }, displayTitle) {
        logger.debug(`Fetching XMDB details for ID: ${id} ("${displayTitle}")`);
        const apiKey = this.config.get('xmdbApiKey');
        const detailsParams = new URLSearchParams({ apiKey });
        const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        if (!detailsJson || detailsJson.error) return null;
        const { rating, release_year, title, metascore } = detailsJson;
        return new Title({
            apiTitle: title ?? searchResultTitle ?? null,
            imdbId: id,
            year: release_year,
            rating,
            rtRating: null,
            mcRating: metascore ?? null,
        });
    }
}

export class OmdbApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.OMDB], null, adapter),
            ApiSource.OMDB,
            disabledManager,
            adapter,
            config
        );
    }

    async search(displayTitle) {
        const apiKey = this.config.get('omdbApiKey');
        if (!apiKey || apiKey === 'YOUR_OMDB_API_KEY') return null;
        return { title: displayTitle };
    }

    async getDetails({ title: t }, displayTitle) {
        const apiKey = this.config.get('omdbApiKey');
        const params = new URLSearchParams({ apikey: apiKey, t });
        logger.debug(`Fetching OMDB details for title: "${t}"${displayTitle ? ` ("${displayTitle}")` : ''}`);
        const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        if (json.Response === 'False') {
            logger.debug(`No search results found in OMDB for: "${t}"`);
            return null;
        }
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
    constructor(disabledManager, adapter, config) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.IMDBAPI], null, adapter),
            ApiSource.IMDBAPI,
            disabledManager,
            adapter,
            config
        );
    }

    async search(displayTitle) {
        const searchParams = new URLSearchParams({ query: displayTitle, limit: 5 });
        logger.debug(`Searching IMDb API Dev for title: "${displayTitle}"`);
        const { titles } = await this.queuedFetch(`https://api.imdbapi.dev/search/titles?${searchParams}`, 0);
        if (!titles?.length) {
            logger.debug(`No search results found in IMDb API Dev for: "${displayTitle}"`);
            return null;
        }
        return titles[0];
    }

    async getDetails(match, displayTitle) {
        const { id } = match;
        logger.debug(`Fetching IMDb API Dev details for ID: ${id} ("${displayTitle}")`);
        const detailsJson = await this.queuedFetch(`https://api.imdbapi.dev/titles/${id}`, 1);
        if (!detailsJson || detailsJson.error) return null;

        // API returns `primaryTitle` per the Swagger spec
        const { primaryTitle, startYear, rating, metacritic } = detailsJson;

        return new Title({
            apiTitle: primaryTitle ?? null,
            imdbId: id,
            year: startYear,
            rating: rating?.aggregateRating ?? null,
            rtRating: null,
            mcRating: metacritic?.score ?? null,
        });
    }
}
