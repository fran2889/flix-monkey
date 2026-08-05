/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { AgregarrApiClient, OmdbApiClient, XmdbApiClient } from '../../../src/core/api-clients.js';
import { Title } from '../../../src/core/title.js';
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
        expect(result.imdbId).toBe('m1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.year).toBe(2020);
        expect(result.rating).toBeNull();
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
        const result = await client.getDetails(new Title({ imdbId: 'm1', displayTitle: 'Movie 1' }));
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
        await client.getDetails(new Title({ imdbId: 'm1', displayTitle: 'Movie 1' }));
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
        const result = await client.getDetails(new Title({ imdbId: 'tt0000000', displayTitle: 'nonexistent' }));
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

    it('should extract vote_count from XMDB response', async () => {
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
        const result = await client.getDetails(new Title({ imdbId: 'tt1', displayTitle: 'Test' }));
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
        const result = await client.search('Movie 1');

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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            mockLogger
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
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
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger()
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
        const client = new OmdbApiClient(mockDisabledManager, mockAdapter, { get: () => 'apikey' }, createMockLogger());
        const result = await client.fetch('Some Title');
        expect(result).not.toBeNull();
        expect(result.mcRating).toBe(80);
    });
});

describe('AgregarrApiClient', () => {
    it('should return the first supported IMDb Suggestions result', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [
                    { id: 'tt0001', l: 'Some Video', qid: 'video', y: 2020 },
                    { id: 'tt0002', l: 'Some Short', qid: 'short', y: 2020 },
                    { id: 'tt0003', l: 'Movie 1', qid: 'movie', y: 2020 },
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
        expect(result.imdbId).toBe('tt0003');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.type).toBe('movie');
    });

    it.each([
        ['tvSeries', 'series'],
        ['tvMiniSeries', 'series'],
    ])('should map IMDb Suggestions %s results to %s', async (qid, type) => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [{ id: 'tt1', l: 'Show 1', qid, y: 2020 }],
            }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );

        const result = await client.search('Show 1');

        expect(result.type).toBe(type);
    });

    it('should return null if no results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ d: [] }),
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
            httpFetch: vi.fn().mockResolvedValue({ d: [] }),
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

    it('should return null if IMDb Suggestions response has no d array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({}),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when IMDb Suggestions response has no d array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({}),
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

    it('should return null when IMDb Suggestions has no supported title types', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ d: [{ id: 'nm1', l: 'Some Person', qid: 'name' }] }),
        });
        const mockLogger = createMockLogger();
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            mockLogger
        );
        expect(await client.search('Unknown')).toBeNull();
        expect(mockLogger.info).toHaveBeenCalledWith(
            'No supported title-type results found in IMDb Suggestions for "Unknown"'
        );
    });

    it('should build the correct IMDb Suggestions URL', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        await client.search('Movie 1');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/movie%201.json');
    });

    it('should fetch rating from Agregarr and retain IMDb Suggestions metadata', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const searchResult = new Title({
            imdbId: 'tt1',
            apiTitle: 'Movie 1',
            year: 2020,
            displayTitle: 'Movie 1',
            type: 'movie',
        });
        const result = await client.getDetails(searchResult);
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.imdbId).toBe('tt1');
        expect(result.year).toBe(2020);
        expect(result.rating).toBe(8.8);
        expect(result.rtRating).toBeNull();
        expect(result.mcRating).toBeNull();
        expect(result.type).toBe('movie');
    });

    it('should retain IMDb Suggestions type when Agregarr returns a null rating', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt4', rating: null, votes: null }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const searchResult = new Title({
            imdbId: 'tt4',
            apiTitle: 'Movie 1',
            year: 2020,
            displayTitle: 'Movie 1',
            type: 'series',
        });
        const result = await client.getDetails(searchResult);
        expect(result.rating).toBeNull();
        expect(result.type).toBe('series');
    });

    it('should handle the full IMDb Suggestions and Agregarr fetch flow', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({
                    d: [{ id: 'tt1', l: 'Movie 1', qid: 'movie', y: 2020 }],
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
        expect(result.type).toBe('movie');
    });

    it('should lowercase and encode non-ASCII titles in IMDb Suggestions URLs', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        await client.search('Élite');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/%C3%A9lite.json');
    });

    it('should extract votes from Agregarr response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const searchResult = new Title({ imdbId: 'tt1', apiTitle: 'Test', year: 2020, displayTitle: 'Test' });
        const result = await client.getDetails(searchResult);
        expect(result.imdbVotes).toBe(2500000);
    });

    it('should handle null votes from Agregarr response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: null }]),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const searchResult = new Title({ imdbId: 'tt1', apiTitle: 'Test', year: 2020, displayTitle: 'Test' });
        const result = await client.getDetails(searchResult);
        expect(result.imdbVotes).toBeNull();
    });
});
