/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { type ApiClientDeps, OmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import { Title, type TitleData } from '../../../../src/core/title';
import type { PlatformAdapter } from '../../../../src/platform/adapter';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

const mockOverrideManager: IdOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(undefined),
    setImdbId: vi.fn().mockResolvedValue(undefined),
} as unknown as IdOverrideManager;

const mockAdapter: PlatformAdapter = buildMockAdapter().build();
const mockConfig: ConfigManager = {
    get: (_k: string) => 'key',
} as unknown as ConfigManager;
const mockDisabledManager: DisabledClientsManager = {
    isDisabled: vi.fn().mockResolvedValue(false),
    disable: vi.fn().mockResolvedValue(undefined),
    resetAll: vi.fn().mockResolvedValue([]),
} as unknown as DisabledClientsManager;
const mockLogger: Logger = buildLogger().build();

const deps: ApiClientDeps = {
    adapter: mockAdapter,
    config: mockConfig,
    disabledManager: mockDisabledManager,
    logger: mockLogger,
    overrideManager: mockOverrideManager,
};

describe('OmdbApiClient', () => {
    it('should fetch details correctly', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt1',
                Year: '2020',
                Title: 'Movie 1',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.imdbRating).toBe(8.0);
        expect(result!.imdbId).toBe('tt1');
    });

    it('should return unhealthy status when API key is missing', async () => {
        const mockConfigForTest: ConfigManager = {
            get: () => '',
        } as unknown as ConfigManager;
        const client = new OmdbApiClient({ ...deps, config: mockConfigForTest });
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
    });

    it('should defer to the base health check when an API key is configured', async () => {
        // mockConfig.get() returns a non-empty key, so the client falls through to
        // BaseApiClient.getStatus(), which gates on the disabled manager.
        const client = new OmdbApiClient(deps);
        expect(await client.getStatus()).toEqual({ healthy: true });
    });

    it('should report unhealthy when disabled even though an API key is configured', async () => {
        const mockDisabledManagerForTest: DisabledClientsManager = {
            isDisabled: vi.fn().mockResolvedValue(true),
            disable: vi.fn().mockResolvedValue(undefined),
            resetAll: vi.fn().mockResolvedValue([]),
        } as unknown as DisabledClientsManager;
        const client = new OmdbApiClient({ ...deps, disabledManager: mockDisabledManagerForTest });
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
        expect((status as { healthy: false; reason: string }).reason).toBe('Temporarily disabled due to errors');
    });

    it('should handle missing or invalid Year', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                Year: 'invalid',
                Title: 'Movie 1',
                imdbID: 'tt1',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');
        expect(result!.year).toBeUndefined();
    });

    // OMDb reports Year as a free-form string, so this client owns extracting the
    // digits. Title only ever receives a number.
    it.each([
        ['2020', 2020],
        ['2020-', 2020],
        ['2020-01-01', 2020],
        ['invalid', undefined],
    ])('should convert Year %o -> %o', async (raw: string, expected: number | undefined) => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ Response: 'True', Year: raw, Title: 'Movie 1', imdbID: 'tt1' })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.year).toBe(expected);
    });

    it('should parse ratings from OMDB correctly', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.0',
                Ratings: [
                    { Source: 'Rotten Tomatoes', Value: '90%' },
                    { Source: 'Metacritic', Value: '85/100' },
                ],
                imdbID: 'tt1',
                Title: 'Movie 1',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.rtRating).toBe(90);
        expect(result!.mcRating).toBe(85);
    });

    it.each(['', ' ', 'N/A'])('should treat imdbRating %o as missing', async (value: string) => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ Response: 'True', imdbRating: value, imdbID: 'tt1', Title: 'Movie 1' })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.imdbRating).toBeUndefined();
        expect(result!.hasRating).toBe(false);
    });

    // The OMDb wire format is stringly typed, so this client owns converting it to
    // numbers. Title only ever receives `number | undefined`.
    it.each([
        ['8.0', 8],
        ['8.7', 8.7],
    ])('should convert imdbRating %o -> %o', async (raw: string, expected: number) => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ Response: 'True', imdbRating: raw, imdbID: 'tt1', Title: 'Movie 1' })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.imdbRating).toBe(expected);
    });

    it.each([
        [{ Source: 'Rotten Tomatoes', Value: '90%' }, 90],
        [{ Source: 'Rotten Tomatoes', Value: '0%' }, 0],
        [{ Source: 'Rotten Tomatoes', Value: 'N/A' }, undefined],
        [{ Source: 'Metacritic', Value: '85/100' }, 85],
        [{ Source: 'Metacritic', Value: '0/100' }, 0],
        [{ Source: 'Metacritic', Value: 'N/A' }, undefined],
    ])('should convert Ratings entry %o -> %o', async (entry: object, expected: number | undefined) => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbID: 'tt1',
                Title: 'Movie 1',
                Ratings: [entry],
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        const rating = entry as { Source: string };
        const isRottenTomatoes = /Rotten Tomatoes/i.test(rating.Source);
        expect(isRottenTomatoes ? result!.rtRating : result!.mcRating).toBe(expected);
    });

    it.each([
        ['2,500,000', 2500000],
        ['2500000', 2500000],
        ['', undefined],
    ])('should convert imdbVotes %o -> %o', async (raw: string, expected: number | undefined) => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.0',
                imdbVotes: raw,
                imdbID: 'tt1',
                Title: 'Movie 1',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.imdbVotes).toBe(expected);
    });

    it('should map Type to TitleType in getDetails', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt1',
                Year: '2020',
                Title: 'Movie 1',
                Type: 'movie',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');
        expect(result!.type).toBe('movie');
    });

    it('should map series Type to series', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt2',
                Year: '2020',
                Title: 'Show 1',
                Type: 'series',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Show 1');
        expect(result!.type).toBe('series');
    });

    it('should log warn with error message on OMDB False response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ Response: 'False', Error: 'Movie not found!' })
            .build();
        const mockLoggerForTest = buildLogger().build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest, logger: mockLoggerForTest });
        await client.search('Unknown');
        expect(mockLoggerForTest.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return undefined on OMDB False response', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False' }).build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Unknown');
        expect(result).toBeUndefined();
    });

    it('should extract imdbVotes from OMDB response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbVotes: '2,500,000',
                imdbRating: '8.8',
                imdbID: 'tt1',
                Title: 'Test',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Test');
        expect(result!.imdbVotes).toBe(2500000);
    });

    it('should handle missing imdbVotes from OMDB response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.8',
                imdbID: 'tt1',
                Title: 'Test',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Test');
        expect(result!.imdbVotes).toBeUndefined();
    });

    it('should drop invalid Ratings entries and keep valid ones', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                Title: 'Some Title',
                imdbID: 'tt1234567',
                imdbRating: '7.5',
                Year: '2020',
                Type: 'movie',
                Ratings: [
                    null,
                    'nope',
                    { Source: 'Metacritic', Value: '80/100' },
                    { Source: 'Rotten Tomatoes', Value: '90%' },
                ],
            })
            .build();
        const mockDisabledManagerForTest: DisabledClientsManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
            resetAll: vi.fn().mockResolvedValue([]),
        } as unknown as DisabledClientsManager;
        const client = new OmdbApiClient({
            ...deps,
            adapter: mockAdapterForTest,
            disabledManager: mockDisabledManagerForTest,
        });
        const result = await client.fetch('Some Title');
        expect(result).not.toBeUndefined();
        expect(result!.mcRating).toBe(80);
        expect(result!.rtRating).toBe(90);
    });

    it('should keep the title when every Ratings entry is invalid', async () => {
        const response = {
            Response: 'True',
            imdbID: 'tt1',
            Title: 'Movie 1',
            imdbRating: '7.5',
            Ratings: [null, 'nope'],
        };
        const adapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
        const logger = buildLogger().build();
        const client = new OmdbApiClient({ ...deps, adapter, logger });

        const result = await client.search('Movie 1');

        expect(result?.apiTitle).toBe('Movie 1');
        expect(result?.imdbRating).toBe(7.5);
        expect(result?.rtRating).toBeUndefined();
        expect(result?.mcRating).toBeUndefined();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should use ID endpoint when searchTitle has imdbId', async () => {
        const mockResponse = {
            Response: 'True',
            imdbID: 'tt1234567',
            Title: 'Test Movie',
            Year: '2024',
            imdbRating: '8.5',
            imdbVotes: '1000',
            Ratings: [],
            Type: 'movie',
        };
        const adapter = buildMockAdapter().withHttpFetchResolvingTo(mockResponse).build();
        const client = new OmdbApiClient({ ...deps, adapter });
        const minimalTitle = buildTitle().withDisplayTitle('Test').withImdbId('tt1234567').build();
        const result = await client.getDetails(minimalTitle);

        expect(result).not.toBeUndefined();
        expect(result!.imdbId).toBe('tt1234567');
        expect(result!.imdbRating).toBe(8.5);
        expect(result!.apiTitle).toBe('Test Movie');
        expect(adapter.httpFetch).toHaveBeenCalledWith('https://www.omdbapi.com/?apikey=key&i=tt1234567');
    });

    it('should return searchTitle directly when it has apiTitle', async () => {
        const mockAdapterForTest = buildMockAdapter().build();
        mockAdapterForTest.httpFetch = vi.fn();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const searchTitle = buildTitle()
            .withDisplayTitle('Test Movie')
            .withApiTitle('Test Movie')
            .withImdbId('tt123')
            .withYear(2020)
            .build();
        const result = await client.getDetails(searchTitle);
        expect(result).toBe(searchTitle);
        expect(mockAdapterForTest.httpFetch).not.toHaveBeenCalled();
    });

    it('should update apiTitle from OMDb response when fallback has no apiTitle', async () => {
        const mockResponse = {
            Response: 'True',
            imdbID: 'tt123',
            Title: 'Updated Title',
            Type: 'movie',
        };
        const adapter = buildMockAdapter().withHttpFetchResolvingTo(mockResponse).build();
        const client = new OmdbApiClient({ ...deps, adapter });
        const minimalTitle = buildTitle().withDisplayTitle('Test').withImdbId('tt123').withApiTitle(undefined).build();
        const result = await client.getDetails(minimalTitle);
        expect(result!.apiTitle).toBe('Updated Title');
        expect(result!.imdbId).toBe('tt123');
        expect(result!.displayTitle).toBe('Test');
    });

    it('should treat a null imdbRating in the response as no rating instead of 0', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: null,
                imdbID: 'tt1',
                Title: 'Movie 1',
            })
            .build();
        const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');

        expect(result!.imdbRating).toBeUndefined();
        expect(result!.hasRating).toBe(false);
    });

    it('should fetch details for a cached title that still carries a null apiTitle', async () => {
        const mockResponse = {
            Response: 'True',
            imdbID: 'tt123',
            Title: 'Updated Title',
            imdbRating: '8.5',
            Type: 'movie',
        };
        const adapter = buildMockAdapter().withHttpFetchResolvingTo(mockResponse).build();
        const client = new OmdbApiClient({ ...deps, adapter });
        // A cache entry written before the null to undefined migration carries a literal null.
        const legacyCachedTitle = Title.fromCacheJSON(
            { apiTitle: null, imdbId: 'tt123', year: null } as unknown as TitleData,
            'Test'
        )!;
        const result = await client.getDetails(legacyCachedTitle);

        expect(result!.apiTitle).toBe('Updated Title');
        expect(result!.imdbRating).toBe(8.5);
        expect(adapter.httpFetch).toHaveBeenCalledWith('https://www.omdbapi.com/?apikey=key&i=tt123');
    });

    it('should warn once when the OMDb response is not an object', async () => {
        const adapter = buildMockAdapter().withHttpFetchResolvingTo([]).build();
        const logger = buildLogger().build();
        const client = new OmdbApiClient({ ...deps, adapter, logger });

        expect(await client.search('Movie 1')).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Malformed OMDb search for "Movie 1"'), {
            response: [],
            error: 'expected an object',
        });
    });

    it('should log info and not warn for a Response "False" payload', async () => {
        const adapter = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False' }).build();
        const logger = buildLogger().build();
        const client = new OmdbApiClient({ ...deps, adapter, logger });

        expect(await client.search('Movie 1')).toBeUndefined();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No OMDb results found'));
        expect(logger.warn).not.toHaveBeenCalled();
    });

    describe('response parsing', () => {
        it.each([
            ['a null body', null],
            ['an empty body', ''],
            ['an array body', []],
        ])('should return undefined when search receives %s', async (_label, response) => {
            const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it.each([
            ['a numeric Response field', { Response: 1 }],
            ['an unknown Response value', { Response: 'Maybe', Title: 'Movie 1', imdbID: 'tt1' }],
            ['a numeric Title field', { Response: 'True', Title: 42, imdbID: 'tt1' }],
            ['a numeric Year field', { Response: 'True', Title: 'Movie 1', imdbID: 'tt1', Year: 2020 }],
            ['a numeric imdbRating field', { Response: 'True', Title: 'Movie 1', imdbID: 'tt1', imdbRating: 8 }],
            ['an object imdbRating field', { Response: 'True', Title: 'Movie 1', imdbID: 'tt1', imdbRating: {} }],
            ['a string Ratings field', { Response: 'True', Title: 'Movie 1', imdbID: 'tt1', Ratings: 'nope' }],
            ['a missing Title field', { Response: 'True', imdbID: 'tt1' }],
            ['a missing imdbID field', { Response: 'True', Title: 'Movie 1' }],
            ['an empty Title field', { Response: 'True', Title: '', imdbID: 'tt1' }],
            ['an empty imdbID field', { Response: 'True', Title: 'Movie 1', imdbID: '' }],
        ])('should fail the lookup when search receives %s', async (_label, response) => {
            const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it('should keep a valid search response that has no rating', async () => {
            const mockAdapterForTest = buildMockAdapter()
                .withHttpFetchResolvingTo({ Response: 'True', Title: 'Movie 1', imdbID: 'tt1' })
                .build();
            const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            const result = await client.search('Movie 1');

            expect(result!.imdbRating).toBeUndefined();
            expect(result!.hasRating).toBe(false);
        });

        it('should treat a False response as a failed lookup without requiring Title or imdbID', async () => {
            const mockAdapterForTest = buildMockAdapter()
                .withHttpFetchResolvingTo({ Response: 'False', Error: 'Movie not found!' })
                .build();
            const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it.each([
            ['a null body', null],
            ['an empty body', ''],
            ['a numeric imdbID field', { Response: 'True', Title: 'Movie 1', imdbID: 42 }],
            ['an object imdbRating field', { Response: 'True', Title: 'Movie 1', imdbID: 'tt1', imdbRating: {} }],
            ['a missing Title field', { Response: 'True', imdbID: 'tt1' }],
            ['a missing imdbID field', { Response: 'True', Title: 'Movie 1' }],
        ])('should fail the details lookup when it receives %s', async (_label, response) => {
            const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Movie 1').build());

            expect(result).toBeUndefined();
        });
    });
});
