/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { OmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import type { PlatformAdapter } from '../../../../src/platform/adapter';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

const mockOverrideManager: IdOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(null),
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
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Movie 1');

        expect(result!.imdbRating).toBe(8.0);
        expect(result!.imdbId).toBe('tt1');
    });

    it('should return unhealthy status when API key is missing', async () => {
        const mockConfigForTest: ConfigManager = {
            get: () => '',
        } as unknown as ConfigManager;
        const client = new OmdbApiClient(
            mockAdapter,
            mockConfigForTest,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
    });

    it('should handle missing or invalid Year', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                Year: 'invalid',
                Title: 'Movie 1',
            })
            .build();
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Movie 1');
        expect(result!.year).toBeNull();
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
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Movie 1');

        expect(result!.rtRating).toBe(90);
        expect(result!.mcRating).toBe(85);
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
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
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
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Show 1');
        expect(result!.type).toBe('series');
    });

    it('should log warn with error message on OMDB False response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ Response: 'False', Error: 'Movie not found!' })
            .build();
        const mockLoggerForTest = buildLogger().build();
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLoggerForTest,
            mockOverrideManager
        );
        await client.search('Unknown');
        expect(mockLoggerForTest.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null on OMDB False response', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False' }).build();
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Unknown');
        expect(result).toBeNull();
    });

    it('should extract imdbVotes from OMDB response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbVotes: '2,500,000',
                imdbRating: '8.8',
                Title: 'Test',
            })
            .build();
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Test');
        expect(result!.imdbVotes).toBe(2500000);
    });

    it('should handle missing imdbVotes from OMDB response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                imdbRating: '8.8',
                Title: 'Test',
            })
            .build();
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.search('Test');
        expect(result!.imdbVotes).toBeNull();
    });

    it('should not throw when the Ratings array contains a null element', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                Response: 'True',
                Title: 'Some Title',
                imdbID: 'tt1234567',
                imdbRating: '7.5',
                Year: '2020',
                Type: 'movie',
                Ratings: [null, { Source: 'Metacritic', Value: '80/100' }],
            })
            .build();
        const mockDisabledManagerForTest: DisabledClientsManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
            resetAll: vi.fn().mockResolvedValue([]),
        } as unknown as DisabledClientsManager;
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManagerForTest,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.fetch('Some Title');
        expect(result).not.toBeNull();
        expect(result!.mcRating).toBe(80);
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
        const client = new OmdbApiClient(mockAdapter, mockConfig, mockDisabledManager, mockLogger, mockOverrideManager);
        client.queuedFetch = vi.fn().mockResolvedValue(mockResponse);
        const minimalTitle = buildTitle().withDisplayTitle('Test').withImdbId('tt1234567').build();
        const result = await client.getDetails(minimalTitle);

        expect(result).not.toBeNull();
        expect(result!.imdbId).toBe('tt1234567');
        expect(result!.imdbRating).toBe(8.5);
        expect(result!.apiTitle).toBe('Test Movie');
        expect(client.queuedFetch).toHaveBeenCalledWith('https://www.omdbapi.com/?apikey=key&i=tt1234567', 1);
    });

    it('should return searchTitle directly when it has apiTitle', async () => {
        const mockAdapterForTest = buildMockAdapter().build();
        mockAdapterForTest.httpFetch = vi.fn();
        const client = new OmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
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

    it('should update apiTitle from OMDb response when fallback has null apiTitle', async () => {
        const mockResponse = {
            Response: 'True',
            imdbID: 'tt123',
            Title: 'Updated Title',
            Type: 'movie',
        };
        const client = new OmdbApiClient(mockAdapter, mockConfig, mockDisabledManager, mockLogger, mockOverrideManager);
        client.queuedFetch = vi.fn().mockResolvedValue(mockResponse);
        const minimalTitle = buildTitle().withDisplayTitle('Test').withImdbId('tt123').withApiTitle(null).build();
        const result = await client.getDetails(minimalTitle);
        expect(result!.apiTitle).toBe('Updated Title');
        expect(result!.imdbId).toBe('tt123');
        expect(result!.displayTitle).toBe('Test');
    });
});
