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
import { describe, it, expect, vi } from 'vitest';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from '../../../src/core/api-clients.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should disable itself and purge queue on 4xx error', async () => {
        const error = new Error('HTTP 403');
        error.status = 403;

        // We need a slow promise to keep it in queue
        let _resolveFetch;
        const slowPromise = new Promise(resolve => {
            _resolveFetch = resolve;
        });

        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockRejectedValueOnce(error).mockReturnValue(slowPromise),
        });
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };

        const client = new XmdbApiClient(mockDisabledManager, mockAdapter, { get: _k => 'key' }, createMockLogger());

        // Trigger first fetch that fails and disables the client
        const p1 = client.queuedFetch('url1').catch(e => e);

        // Enqueue second fetch that should be purged
        const p2 = client.queuedFetch('url2').catch(e => e);

        const [err1, err2] = await Promise.all([p1, p2]);

        expect(err1.status).toBe(403);
        expect(err2.message).toBe('Client Disabled');
        expect(mockDisabledManager.disable).toHaveBeenCalled();
    });

    it('should NOT disable itself on 5xx error', async () => {
        const error = new Error('HTTP 500');
        error.status = 500;

        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockRejectedValueOnce(error),
        });
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };

        const client = new XmdbApiClient(mockDisabledManager, mockAdapter, { get: _k => 'key' }, createMockLogger());

        await expect(client.queuedFetch('url1')).rejects.toThrow('HTTP 500');
        expect(mockDisabledManager.disable).not.toHaveBeenCalled();
    });

    it('should NOT disable itself on a network error with no status property', async () => {
        const error = new Error('Network failure');
        // Deliberately no .status property

        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockRejectedValueOnce(error),
        });
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };

        const client = new XmdbApiClient(mockDisabledManager, mockAdapter, { get: _k => 'key' }, createMockLogger());

        await expect(client.queuedFetch('url1')).rejects.toThrow('Network failure');
        expect(mockDisabledManager.disable).not.toHaveBeenCalled();
    });

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

    it('should return null if client is disabled', async () => {
        const client = new XmdbApiClient({ isDisabled: vi.fn().mockResolvedValue(true) }, {}, {}, createMockLogger());
        const result = await client.fetch('Movie 1');
        expect(result).toBeNull();
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

    it('should throw if details fetch returns an error', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValueOnce({ error: 'not found' }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger()
        );
        await expect(client.getDetails({ id: 'm1' }, 'Movie 1')).rejects.toThrow();
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
});

describe('OmdbApiClient', () => {
    it('should fetch details correctly', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                imdbRating: '8.0',
                imdbID: 'tt123',
                Year: '2022',
                Title: 'OMDB Movie',
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
        const result = await client.getDetails({ title: 'OMDB Movie' }, 'OMDB Movie');

        expect(result.rating).toBe(8.0);
        expect(result.imdbId).toBe('tt123');
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
                Title: 'OMDB Movie',
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
        const result = await client.getDetails({ title: 'OMDB Movie' }, 'OMDB Movie');
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
                imdbID: 'tt123',
                Title: 'OMDB Movie',
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
        const result = await client.getDetails({ title: 'OMDB Movie' }, 'OMDB Movie');

        expect(result.rtRating).toBe(90);
        expect(result.mcRating).toBe(85);
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
});

describe('ImdbApiDevClient', () => {
    it('should return the first title result', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                titles: [
                    { id: 'tt1', primaryTitle: 'First Movie' },
                    { id: 'tt2', primaryTitle: 'Second Movie' },
                ],
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );

        const result = await client.search('Some Movie');
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

    it('should handle details and ratings', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                primaryTitle: 'Movie',
                startYear: 2026,
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
        const result = await client.getDetails({ id: 'tt1' }, 'Movie');
        expect(result.apiTitle).toBe('Movie');
        expect(result.year).toBe(2026);
        expect(result.rating).toBe(8.5);
        expect(result.mcRating).toBe(75);
    });

    it('should handle missing optional fields', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                primaryTitle: 'Movie',
            }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.getDetails({ id: 'tt1' }, 'Movie');
        expect(result.apiTitle).toBe('Movie');
        expect(result.year).toBeNull();
        expect(result.rating).toBeNull();
        expect(result.mcRating).toBeNull();
    });

    it('should throw if details fetch returns an error', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ error: 'server error' }),
        });
        const client = new ImdbApiDevClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        await expect(client.getDetails({ id: 'tt1' }, 'Movie')).rejects.toThrow();
    });

    it('should throw Not implemented for search and getDetails in BaseApiClient', async () => {
        const { BaseApiClient } = await import('../../../src/core/api-clients.js');
        class DummyClient extends BaseApiClient {}
        const dummy = new DummyClient({}, {}, {});

        await expect(dummy.search('title')).rejects.toThrow('Not implemented');
        await expect(dummy.getDetails({}, 'title')).rejects.toThrow('Not implemented');
    });
});
