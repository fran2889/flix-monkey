/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { XmdbApiClient } from '../../../../src/core/api/';
import { Title } from '../../../../src/core/title.js';
import { createMockAdapter } from '../../../mocks/adapter.js';
import { createMockLogger } from '../../../mocks/logger.js';

const mockOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(null),
};

describe('XmdbApiClient', () => {
    it('should handle search with results', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                results: [{ type: 'title', id: 'm1', title: 'Movie 1', year: 2020 }],
            }),
        });
        const client = new XmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');
        expect(result.imdbId).toBe('m1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.year).toBe(2020);
        expect(result.imdbRating).toBeNull();
    });

    it('should return null if no search results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const client = new XmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        expect(await client.search('Movie 1')).toBeNull();
    });

    it('should log info when no search results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const mockLogger = createMockLogger();
        const client = new XmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
        );
        await client.search('Movie 1');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
    });

    it('should return null if search results have no titles', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [{ type: 'person', name: 'Someone' }] }),
        });
        const client = new XmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        expect(await client.search('Movie 1')).toBeNull();
    });

    it('should log info when search results have no titles', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [{ type: 'person', name: 'Someone' }] }),
        });
        const mockLogger = createMockLogger();
        const client = new XmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
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
            mockAdapter,
            {
                get: _k => 'key',
            },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.getDetails(new Title({ imdbId: 'tt0000000', displayTitle: 'nonexistent' }));
        expect(result).toBeNull();
    });

    it('should return unhealthy status when API key is missing', async () => {
        const client = new XmdbApiClient(
            createMockAdapter(),
            { get: () => '' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            undefined
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
            mockAdapter,
            { get: _k => 'key' },
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.getDetails(new Title({ imdbId: 'tt1', displayTitle: 'Test' }));
        expect(result.imdbVotes).toBe(2500000);
    });
});
