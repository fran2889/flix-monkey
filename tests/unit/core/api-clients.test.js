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
import { describe, expect, it, vi } from 'vitest';

import { AgregarrApiClient, ImdbApiDevClient, OmdbApiClient, XmdbApiClient } from '../../../src/core/api-clients.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should return healthy status when not disabled', async () => {
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
        };
        const client = new XmdbApiClient(mockDisabledManager, {}, { get: _k => 'key' }, createMockLogger());
        const status = await client.getStatus();
        expect(status).toEqual({ healthy: true });
    });

    it('should return unhealthy status when disabled', async () => {
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(true),
        };
        const client = new XmdbApiClient(mockDisabledManager, {}, { get: _k => 'key' }, createMockLogger());
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
        expect(status.reason).toBeDefined();
    });

    it('should throw when fetch encounters an error', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockRejectedValue(new Error('Network error')),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );

        await expect(client.fetch('Some Title')).rejects.toThrow('Network error');
    });

    it('should return null if search returns no match', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.fetch('Unknown');
        expect(result).toBeNull();
    });

    it('should abort and return null if disabled between search and getDetails', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                results: [{ type: 'title', id: 'tt123', title: 'Test' }],
            }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(true) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.fetch('Test Movie');
        expect(result).toBeNull();
        // search httpFetch ran; getDetails httpFetch did not
        expect(mockAdapter.httpFetch).toHaveBeenCalledTimes(1);
    });
});

describe('XmdbApiClient', () => {
    it('should handle search with results', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                results: [{ type: 'title', id: 'm1', title: 'Movie 1', year: 2020 }],
            }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.search('Movie 1');
        expect(result.id).toBe('m1');
    });

    it('should return null if no search results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        expect(await client.search('Movie 1')).toBeNull();
    });

    it('should log info when no search results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const mockLogger = createMockLogger();
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            mockLogger
        );
        await client.search('Movie 1');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
    });

    it('should return null if search results have no titles', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [{ type: 'person', name: 'Someone' }] }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        expect(await client.search('Movie 1')).toBeNull();
    });

    it('should log info when search results have no titles', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [{ type: 'person', name: 'Someone' }] }),
        });
        const mockLogger = createMockLogger();
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            mockLogger
        );
        await client.search('Movie 1');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
    });

    it('should handle details with Metacritic rating in ratings array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({ results: [{ type: 'title', id: 'm1' }] })
                .mockResolvedValueOnce({
                    title: 'Movie 1',
                    release_year: 2020,
                    metascore: 88,
                }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.fetch('Movie 1');
        expect(result.year).toBe(2020);
        expect(result.mcRating).toBe(88);
    });

    it('should return null if details fetch returns an error', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValueOnce({ error: 'not found' }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'm1' }, 'Movie 1');
        expect(result).toBeNull();
    });

    it('should map title_type to TitleType in getDetails', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({ results: [{ type: 'title', id: 'tt1' }] })
                .mockResolvedValueOnce({
                    id: 'tt1',
                    title: 'Movie 1',
                    title_type: 'Movie',
                    release_year: 2020,
                    rating: 8.0,
                }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.fetch('Movie 1');
        expect(result.type).toBe('movie');
    });

    it('should map TV Series title_type to series', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({ results: [{ type: 'title', id: 'tt2' }] })
                .mockResolvedValueOnce({
                    id: 'tt2',
                    title: 'Show 1',
                    title_type: 'TV Series',
                    release_year: 2020,
                    rating: 8.0,
                }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.fetch('Show 1');
        expect(result.type).toBe('series');
    });

    it('should return null for unknown title_type', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({ results: [{ type: 'title', id: 'tt3' }] })
                .mockResolvedValueOnce({
                    id: 'tt3',
                    title: 'Short 1',
                    title_type: 'Short Film',
                    release_year: 2020,
                }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.fetch('Short 1');
        expect(result.type).toBeNull();
    });

    it('should log warn when details response has error field', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValueOnce({ error: 'not found' }),
        });
        const mockLogger = createMockLogger();
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            mockLogger
        );
        await client.getDetails({ id: 'm1' }, 'Movie 1');
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Movie 1'),
            expect.objectContaining({ response: { error: 'not found' } })
        );
    });

    it('should return null when details response has no title', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValueOnce({
                id: 'tt0000000',
                title: null,
                title_type: null,
                release_year: null,
                rating: null,
            }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt0000000' }, 'nonexistent');
        expect(result).toBeNull();
    });

    it('should return unhealthy status when API key is missing', async () => {
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockAdapter(),
            { get: () => '' },
            createMockLogger()
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
    });

    it('getDetails extracts vote_count from XMDB response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                id: 'tt1',
                title: 'Test',
                rating: 8.8,
                vote_count: 2500000,
            }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt1', title: 'Test' }, 'Test');
        expect(result.imdbVotes).toBe(2500000);
    });
});

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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Movie 1' }, 'Movie 1');

        expect(result.rating).toBe(8.0);
        expect(result.imdbId).toBe('tt1');
    });

    it('should return unhealthy status when API key is missing', async () => {
        const client = new OmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockAdapter(),
            { get: () => '' },
            createMockLogger()
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Movie 1' }, 'Movie 1');
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Movie 1' }, 'Movie 1');

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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Movie 1' }, 'Movie 1');
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Show 1' }, 'Show 1');
        expect(result.type).toBe('series');
    });

    it('should log warn with error message on OMDB False response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ Response: 'False', Error: 'Movie not found!' }),
        });
        const mockLogger = createMockLogger();
        const client = new OmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            mockLogger
        );
        await client.getDetails({ title: 'Unknown' }, 'Unknown');
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Unknown'),
            expect.objectContaining({ response: { Response: 'False', Error: 'Movie not found!' } })
        );
    });

    it('should return null on OMDB False response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ Response: 'False' }),
        });
        const client = new OmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Unknown' }, 'Unknown');
        expect(result).toBeNull();
    });

    it('getDetails extracts imdbVotes from OMDB response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbVotes: '2,500,000',
                imdbRating: '8.8',
                Title: 'Test',
            }),
        });
        const client = new OmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Test' }, 'Test');
        expect(result.imdbVotes).toBe(2500000);
    });

    it('getDetails handles missing imdbVotes from OMDB response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.8',
                Title: 'Test',
            }),
        });
        const client = new OmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
        );
        const result = await client.getDetails({ title: 'Test' }, 'Test');
        expect(result.imdbVotes).toBeNull();
    });
});

describe('OmdbApiClient', () => {
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
        const client = new OmdbApiClient(mockDisabledManager, mockAdapter, { get: () => 'apikey' }, createMockLogger());
        const result = await client.fetch('Some Title');
        expect(result).not.toBeNull();
        expect(result.mcRating).toBe(80);
    });
});

describe('ImdbApiDevClient', () => {
    it('should return the first title result', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                titles: [
                    { id: 'tt1', primaryTitle: 'Movie 1' },
                    { id: 'tt2', primaryTitle: 'Movie 2' },
                ],
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );

        const result = await client.search('Movie 1');
        expect(result.id).toBe('tt1');
    });

    it('should return null if no titles found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ titles: [] }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when no titles found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ titles: [] }),
        });
        const mockLogger = createMockLogger();
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            mockLogger
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should handle details and ratings', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                primaryTitle: 'Movie 1',
                startYear: 2020,
                rating: { aggregateRating: 8.5 },
                metacritic: { score: 75 },
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt1' }, 'Movie 1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.year).toBe(2020);
        expect(result.rating).toBe(8.5);
        expect(result.mcRating).toBe(75);
    });

    it('should handle missing optional fields', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                primaryTitle: 'Movie 1',
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt1' }, 'Movie 1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.year).toBeNull();
        expect(result.rating).toBeNull();
        expect(result.mcRating).toBeNull();
    });

    it('should map type to TitleType in getDetails', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                id: 'tt1',
                primaryTitle: 'Movie 1',
                type: 'movie',
                startYear: 2020,
                rating: { aggregateRating: 8.5 },
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt1' }, 'Movie 1');
        expect(result.type).toBe('movie');
    });

    it('should map tvSeries type to series', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                id: 'tt2',
                primaryTitle: 'Show 1',
                type: 'tvSeries',
                startYear: 2020,
                rating: { aggregateRating: 7.0 },
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt2' }, 'Show 1');
        expect(result.type).toBe('series');
    });

    it('should return null and log warn when details fetch returns an error', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ error: 'server error' }),
        });
        const mockLogger = createMockLogger();
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            mockLogger
        );
        const result = await client.getDetails({ id: 'tt1' }, 'Movie 1');
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Movie 1'),
            expect.objectContaining({ response: { error: 'server error' } })
        );
    });

    it('getDetails extracts voteCount from IMDb API Dev response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                primaryTitle: 'Movie 1',
                rating: { aggregateRating: 8.8, voteCount: 2500000 },
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt1' }, 'Movie 1');
        expect(result.imdbVotes).toBe(2500000);
    });

    it('should throw Not implemented for search and getDetails in BaseApiClient', async () => {
        const { BaseApiClient } = await import('../../../src/core/api-clients.js');
        class DummyClient extends BaseApiClient {}
        const dummy = new DummyClient({}, {}, {});

        await expect(dummy.search('title')).rejects.toThrow('Not implemented');
        await expect(dummy.getDetails({}, 'title')).rejects.toThrow('Not implemented');
    });
});

describe('AgregarrApiClient', () => {
    it('should return first result from FM-DB even when query does not match', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                ok: true,
                description: [
                    { '#IMDB_ID': 'tt0001', '#TITLE': 'Some Video', '#YEAR': 2020 },
                    { '#IMDB_ID': 'tt0002', '#TITLE': 'Some Short', '#YEAR': 2020 },
                    { '#IMDB_ID': 'tt0003', '#TITLE': 'Movie 1', '#YEAR': 2020 },
                ],
            }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.search('Movie 1');
        expect(result['#IMDB_ID']).toBe('tt0001');
    });

    it('should return null if no results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ ok: true, description: [] }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when no results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ ok: true, description: [] }),
        });
        const mockLogger = createMockLogger();
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            mockLogger
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null if FM-DB response has no description array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ ok: true }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when FM-DB response has no description array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ ok: true }),
        });
        const mockLogger = createMockLogger();
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            mockLogger
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null if FM-DB response is not ok', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ ok: false, description: [] }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should build correct FM-DB search URL', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ ok: true, description: [] });
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        await client.search('Movie 1');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toContain('imdb.iamidiotareyoutoo.com/search?');
        expect(calledUrl).toContain('q=Movie%201');
    });

    it('should fetch rating from Agregarr and return Title with FM-DB format', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ '#IMDB_ID': 'tt1', '#TITLE': 'Movie 1', '#YEAR': 2020 }, 'Movie 1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.imdbId).toBe('tt1');
        expect(result.year).toBe(2020);
        expect(result.rating).toBe(8.8);
        expect(result.rtRating).toBeNull();
        expect(result.mcRating).toBeNull();
        expect(result.type).toBeNull();
    });

    it('should handle null rating from Agregarr with FM-DB format', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt4', rating: null, votes: null }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ '#IMDB_ID': 'tt4', '#TITLE': 'Movie 1', '#YEAR': 2020 }, 'Movie 1');
        expect(result.rating).toBeNull();
        expect(result.type).toBeNull();
    });

    it('should handle full fetch flow (search + details) with FM-DB', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    description: [{ '#IMDB_ID': 'tt1', '#TITLE': 'Movie 1', '#YEAR': 2020 }],
                })
                .mockResolvedValueOnce([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.fetch('Movie 1');
        expect(result.displayTitle).toBe('Movie 1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.imdbId).toBe('tt1');
        expect(result.rating).toBe(8.8);
        expect(result.source).toBe('agregarr');
        expect(result.type).toBeNull();
    });

    it('should build correct FM-DB URL for non-ASCII titles', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ ok: true, description: [] });
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        await client.search('Élite');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toContain('imdb.iamidiotareyoutoo.com/search?');
        expect(calledUrl).toContain('q=');
    });

    it('getDetails extracts votes from Agregarr response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ '#IMDB_ID': 'tt1', '#TITLE': 'Test', '#YEAR': 2020 }, 'Test');
        expect(result.imdbVotes).toBe(2500000);
    });

    it('getDetails handles null votes from Agregarr response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: null }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ '#IMDB_ID': 'tt1', '#TITLE': 'Test', '#YEAR': 2020 }, 'Test');
        expect(result.imdbVotes).toBeNull();
    });
});
