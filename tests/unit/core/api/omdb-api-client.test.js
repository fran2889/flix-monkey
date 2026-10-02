/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { OmdbApiClient } from '../../../../src/core/api/';
import { Title } from '../../../../src/core/title.js';
import { createMockAdapter } from '../../../mocks/adapter.js';
import { createMockLogger } from '../../../mocks/logger.js';

const mockOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(null),
};

describe('OmdbApiClient', () => {
    it('should fetch details correctly', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt1',
                Year: '2020',
                Title: 'Movie 1',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');

        expect(result.imdbRating).toBe(8.0);
        expect(result.imdbId).toBe('tt1');
    });

    it('should return unhealthy status when API key is missing', async () => {
        const client = new OmdbApiClient(
            createMockAdapter(),
            { get: () => '' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            undefined
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
    });

    it('should handle missing or invalid Year', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                Year: 'invalid',
                Title: 'Movie 1',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');
        expect(result.year).toBeNull();
    });

    it('should parse ratings from OMDB correctly', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.0',
                Ratings: [
                    { Source: 'Rotten Tomatoes', Value: '90%' },
                    { Source: 'Metacritic', Value: '85/100' },
                ],
                imdbID: 'tt1',
                Title: 'Movie 1',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');

        expect(result.rtRating).toBe(90);
        expect(result.mcRating).toBe(85);
    });

    it('should map Type to TitleType in getDetails', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt1',
                Year: '2020',
                Title: 'Movie 1',
                Type: 'movie',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');
        expect(result.type).toBe('movie');
    });

    it('should map series Type to series', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt2',
                Year: '2020',
                Title: 'Show 1',
                Type: 'series',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Show 1');
        expect(result.type).toBe('series');
    });

    it('should log warn with error message on OMDB False response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ Response: 'False', Error: 'Movie not found!' }),
        });
        const mockLogger = createMockLogger();
        const client = new OmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null on OMDB False response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ Response: 'False' }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Unknown');
        expect(result).toBeNull();
    });

    it('should extract imdbVotes from OMDB response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbVotes: '2,500,000',
                imdbRating: '8.8',
                Title: 'Test',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Test');
        expect(result.imdbVotes).toBe(2500000);
    });

    it('should handle missing imdbVotes from OMDB response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.8',
                Title: 'Test',
            }),
        });
        const client = new OmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Test');
        expect(result.imdbVotes).toBeNull();
    });

    it('should not throw when the Ratings array contains a null element', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                Title: 'Some Title',
                imdbID: 'tt1234567',
                imdbRating: '7.5',
                Year: '2020',
                Type: 'movie',
                Ratings: [null, { Source: 'Metacritic', Value: '80/100' }],
            }),
        });
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const client = new OmdbApiClient(
            mockAdapter,
            { get: () => 'apikey' },
            mockDisabledManager,
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.fetch('Some Title');
        expect(result).not.toBeNull();
        expect(result.mcRating).toBe(80);
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
        const client = new OmdbApiClient(
            createMockAdapter({}),
            { get: _k => 'test-api-key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            undefined
        );
        client.queuedFetch = vi.fn().mockResolvedValue(mockResponse);
        const minimalTitle = new Title({ displayTitle: 'Test', imdbId: 'tt1234567' });
        const result = await client.getDetails(minimalTitle);

        expect(result).not.toBeNull();
        expect(result.imdbId).toBe('tt1234567');
        expect(result.imdbRating).toBe(8.5);
        expect(result.apiTitle).toBe('Test Movie');
        expect(client.queuedFetch).toHaveBeenCalledWith('https://www.omdbapi.com/?apikey=test-api-key&i=tt1234567', 1);
    });

    it('should return searchTitle directly when it has apiTitle', async () => {
        const mockAdapter = createMockAdapter({ httpFetch: vi.fn() });
        const client = new OmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const searchTitle = new Title({
            displayTitle: 'Test Movie',
            apiTitle: 'Test Movie',
            imdbId: 'tt123',
            year: 2020,
        });
        const result = await client.getDetails(searchTitle);
        expect(result).toBe(searchTitle);
        expect(mockAdapter.httpFetch).not.toHaveBeenCalled();
    });

    it('should update apiTitle from OMDb response when fallback has null apiTitle', async () => {
        const mockResponse = {
            Response: 'True',
            imdbID: 'tt123',
            Title: 'Updated Title',
            Type: 'movie',
        };
        const client = new OmdbApiClient(
            createMockAdapter({}),
            { get: _k => 'test-api-key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            undefined
        );
        client.queuedFetch = vi.fn().mockResolvedValue(mockResponse);
        const minimalTitle = new Title({
            displayTitle: 'Test',
            imdbId: 'tt123',
            apiTitle: null,
        });
        const result = await client.getDetails(minimalTitle);
        expect(result.apiTitle).toBe('Updated Title');
        expect(result.imdbId).toBe('tt123');
        expect(result.displayTitle).toBe('Test');
    });
});
