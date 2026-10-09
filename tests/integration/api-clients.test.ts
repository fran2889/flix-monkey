/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { AgregarrApiClient, OmdbApiClient, XmdbApiClient } from '../../src/core/api/index.js';
import { ConfigManager } from '../../src/core/config/index.js';
import { ApiSource, ApiSourceType, TitleType, TitleTypeType } from '../../src/core/constants.js';
import { DisabledClientsManager } from '../../src/core/disabled-clients.js';
import { IdOverrideManager } from '../../src/core/id-override-manager.js';
import { Logger } from '../../src/core/logger.js';
import { Title } from '../../src/core/title.js';
import type { PlatformAdapter } from '../../src/platform/adapter.js';
import { buildMockAdapter } from '../mocks/adapter.js';

const adapter: Partial<PlatformAdapter> = {
    httpFetch: async (url, options) => {
        const response = await fetch(url, options);
        const text = await response.text();
        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}: ${text}`);
            (err as Error & { status: number }).status = response.status;
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
    configGet: (key: string) => (key === 'debug' ? 'false' : undefined),
};
const disabledManager = new DisabledClientsManager(adapter as PlatformAdapter);
const overrideManager = new IdOverrideManager(adapter as PlatformAdapter);

function assertNonNullTitle(result: Title | null): asserts result is Title {
    expect(result).not.toBeNull();
}

function expectCommonTitleFields(
    result: Title,
    source: ApiSourceType,
    {
        displayTitle,
        apiTitleContains,
        imdbId,
        year,
        type,
    }: {
        displayTitle: string;
        apiTitleContains?: string;
        imdbId: string;
        year?: number;
        type?: TitleTypeType;
    }
): void {
    expect(result).toBeInstanceOf(Title);
    expect(result.displayTitle).toBe(displayTitle);
    if (apiTitleContains !== undefined) expect(result.apiTitle).toContain(apiTitleContains);
    expect(result.imdbId).toBe(imdbId);
    if (year !== undefined) expect(result.year).toBe(year);
    expect(result.source).toBe(source);
    if (type !== undefined) expect(result.type).toBe(type);
    expectImdbRating(result.imdbRating);
}

function expectImdbRating(rating: number | null, label: string = 'IMDb rating'): void {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThan(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(10);
}

function expectPercentageRating(rating: number | null, label: string): void {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThanOrEqual(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(100);
}

function _expectImdbVotes(votes: number | null, label: string = 'IMDb votes'): void {
    expect(votes, `${label} missing`).toBeTypeOf('number');
    expect(votes, `${label} out of range`).toBeGreaterThanOrEqual(0);
}

describe('api-clients integration', () => {
    let configManager: ConfigManager;
    let badKeyConfigManager: ConfigManager;
    let logger: Logger;

    beforeAll(() => {
        logger = new Logger(adapter as PlatformAdapter);
        const getter = (key: string): string | null => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        };
        configManager = new ConfigManager(buildMockAdapter().withConfigGetReturning(getter).build(), logger);
        badKeyConfigManager = new ConfigManager(
            buildMockAdapter()
                .withConfigGetReturning(() => 'badkey123')
                .build(),
            logger
        );
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
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
            expectPercentageRating(result.mcRating, 'XMDB Metacritic');
            expect(result.rtRating).toBeNull();
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
            expectPercentageRating(result.rtRating, 'OMDB Rotten Tomatoes');
            expectPercentageRating(result.mcRating, 'OMDB Metacritic');
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            assertNonNullTitle(result);
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
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.AGREGARR, commonAgregarr);
        });
    });

    describe('invalid title search', () => {
        const TITLE = 'xyznonexistenttitle12345';

        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            expect(await client.search(TITLE)).toBeNull();
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.search(TITLE);
            expect(result).toBeNull();
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            expect(await client.search(TITLE)).toBeNull();
        });
    });

    describe('invalid ID details', () => {
        const INVALID_ID = 'tt0000000';

        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const searchResult = new Title({ imdbId: INVALID_ID, displayTitle: 'nonexistent' });
            const result = await client.getDetails(searchResult);
            expect(result).toBeNull();
        });
    });

    describe('invalid API key', () => {
        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                badKeyConfigManager,
                disabledManager,
                logger,
                overrideManager
            );
            await expect(client.search('The Godfather')).rejects.toThrow();
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                badKeyConfigManager,
                disabledManager,
                logger,
                overrideManager
            );
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
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        it('OMDB', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
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
        };

        it('XMDB', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        // OMDB does not reliably resolve original foreign-language titles.
        // It matched a 1943 Italian film (tt0036502) instead of the 1997 Benigni film.
        // Assert it does NOT resolve to the expected ID so the test alerts us if this changes.
        it('OMDB: does not resolve to expected ID', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expect(result).toBeInstanceOf(Title);
            expect(result.imdbId).not.toBe(EXPECTED_IMDB_ID);
        });

        it('Agregarr', async () => {
            const client = new AgregarrApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch(TITLE);
            assertNonNullTitle(result);
            expectCommonTitleFields(result, ApiSource.AGREGARR, commonAgregarr);
        });
    });

    describe('imdbVotes verification', () => {
        it('XMDB returns imdbVotes', async () => {
            const client = new XmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch('The Godfather');
            assertNonNullTitle(result);
            _expectImdbVotes(result.imdbVotes);
        });

        it('OMDB returns imdbVotes', async () => {
            const client = new OmdbApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch('The Godfather');
            assertNonNullTitle(result);
            _expectImdbVotes(result.imdbVotes);
        });

        it('Agregarr returns imdbVotes', async () => {
            const client = new AgregarrApiClient(
                adapter as PlatformAdapter,
                configManager,
                disabledManager,
                logger,
                overrideManager
            );
            const result = await client.fetch('The Godfather');
            assertNonNullTitle(result);
            _expectImdbVotes(result.imdbVotes);
        });
    });
});
