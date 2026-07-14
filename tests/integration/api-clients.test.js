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
import { beforeAll, describe, expect, it } from 'vitest';

import { AgregarrApiClient, OmdbApiClient, XmdbApiClient } from '../../src/core/api-clients';
import { ConfigManager } from '../../src/core/config-manager';
import { ApiSource, TitleType } from '../../src/core/constants';
import { DisabledClientsManager } from '../../src/core/disabled-clients';
import { Title } from '../../src/core/title';
import { createMockAdapter } from '../mocks/adapter.js';

const adapter = {
    httpFetch: async (url, options) => {
        const response = await fetch(url, options);
        const text = await response.text();
        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}: ${text}`);
            err.status = response.status;
            throw err;
        }
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 500)}`);
        }
    },
    storageGet: async () => '0',
    storageSet: async () => {},
};
const disabledManager = new DisabledClientsManager(adapter);

function expectCommonTitleFields(result, source, { displayTitle, apiTitleContains, imdbId, year, type }) {
    expect(result).toBeInstanceOf(Title);
    expect(result.displayTitle).toBe(displayTitle);
    if (apiTitleContains) expect(result.apiTitle).toContain(apiTitleContains);
    expect(result.imdbId).toBe(imdbId);
    if (year !== undefined) expect(result.year).toBe(year);
    expect(result.source).toBe(source);
    if (type !== undefined) expect(result.type).toBe(type);
    expectImdbRating(result.rating);
}

function expectImdbRating(rating, label = 'IMDb rating') {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThan(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(10);
}

function expectPercentageRating(rating, label) {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThanOrEqual(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(100);
}

function _expectImdbVotes(votes, label = 'IMDb votes') {
    expect(votes, `${label} missing`).toBeTypeOf('number');
    expect(votes, `${label} out of range`).toBeGreaterThanOrEqual(0);
}

describe('api-clients integration', () => {
    let configManager;
    let badKeyConfigManager;

    beforeAll(() => {
        const getter = key => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        };
        configManager = new ConfigManager(createMockAdapter({ configGet: getter }));
        badKeyConfigManager = new ConfigManager(createMockAdapter({ configGet: () => 'badkey123' }));
    });

    describe('movie with all ratings', () => {
        const TITLE = 'The Godfather';
        const common = {
            displayTitle: TITLE,
            apiTitleContains: 'Godfather',
            imdbId: 'tt0068646',
            year: 1972,
            type: TitleType.MOVIE,
        };
        const commonAgregarr = {
            displayTitle: TITLE,
            apiTitleContains: 'Godfather',
            imdbId: 'tt0068646',
            year: 1972,
            type: undefined,
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
            expectPercentageRating(result.mcRating, 'XMDB Metacritic');
            expect(result.rtRating).toBeNull();
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
            expectPercentageRating(result.rtRating, 'OMDB Rotten Tomatoes');
            expectPercentageRating(result.mcRating, 'OMDB Metacritic');
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.AGREGARR, commonAgregarr);
            expect(result.rtRating).toBeNull();
            expect(result.mcRating).toBeNull();
        });
    });

    describe('TV show', () => {
        const TITLE = 'Stranger Things';
        const common = {
            displayTitle: TITLE,
            apiTitleContains: 'Stranger',
            imdbId: 'tt4574334',
            year: 2016,
            type: TitleType.SERIES,
        };
        const commonAgregarr = {
            displayTitle: TITLE,
            apiTitleContains: 'Stranger',
            imdbId: 'tt4574334',
            year: 2016,
            type: undefined,
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.AGREGARR, commonAgregarr);
        });
    });

    describe('invalid title search', () => {
        const TITLE = 'xyznonexistenttitle12345';

        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            expect(await client.search(TITLE)).toBeNull();
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.search(TITLE);
            expect(result).toBeNull();
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(disabledManager, adapter, configManager);
            expect(await client.search(TITLE)).toBeNull();
        });
    });

    describe('invalid ID details', () => {
        const INVALID_ID = 'tt0000000';

        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const searchResult = new Title({ imdbId: INVALID_ID, displayTitle: 'nonexistent' });
            const result = await client.getDetails(searchResult);
            expect(result).toBeNull();
        });
    });

    describe('invalid API key', () => {
        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, badKeyConfigManager);
            await expect(client.search('The Godfather')).rejects.toThrow();
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, badKeyConfigManager);
            await expect(client.search('The Godfather')).rejects.toThrow();
        });
    });

    describe('non-ASCII title', () => {
        const TITLE = 'Amélie';
        const common = {
            displayTitle: TITLE,
            imdbId: 'tt0211915',
            type: TitleType.MOVIE,
        };
        const commonAgregarr = {
            displayTitle: TITLE,
            imdbId: 'tt0211915',
            type: undefined,
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.AGREGARR, commonAgregarr);
        });
    });

    describe('foreign original title', () => {
        const TITLE = 'La Vita è Bella';
        const EXPECTED_IMDB_ID = 'tt0118799';
        const common = {
            displayTitle: TITLE,
            imdbId: EXPECTED_IMDB_ID,
            year: 1997,
            type: TitleType.MOVIE,
        };
        const commonAgregarr = {
            displayTitle: TITLE,
            imdbId: EXPECTED_IMDB_ID,
            year: 1997,
            type: undefined,
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        // OMDB does not reliably resolve original foreign-language titles.
        // It matched a 1943 Italian film (tt0036502) instead of the 1997 Benigni film.
        // Assert it does NOT resolve to the expected ID so the test alerts us if this changes.
        it('OMDB: does not resolve to expected ID', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expect(result).toBeInstanceOf(Title);
            expect(result.imdbId).not.toBe(EXPECTED_IMDB_ID);
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.AGREGARR, commonAgregarr);
        });
    });

    describe('imdbVotes verification', () => {
        it('XMDB returns imdbVotes', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch('The Godfather');
            _expectImdbVotes(result.imdbVotes);
        });

        it('OMDB returns imdbVotes', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch('The Godfather');
            _expectImdbVotes(result.imdbVotes);
        });

        it('Agregarr returns imdbVotes', async () => {
            const client = new AgregarrApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch('The Godfather');
            _expectImdbVotes(result.imdbVotes);
        });
    });
});
