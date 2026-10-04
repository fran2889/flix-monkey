/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { ApiClientManager } from '../../../src/core/api-manager.js';
import { FlixMonkeyError } from '../../../src/core/utils/index.js';
import { buildCacheEntry } from '../../mocks/cache.js';
import { buildLogger } from '../../mocks/logger.js';
import { buildTitle } from '../../mocks/title.js';

describe('ApiClientManager', () => {
    it('should return cached data if available', async () => {
        const titleObj = buildTitle().withApiTitle('Cached Movie').withImdbRating('8.0').withSource('agregarr').build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Some Title')
            .withImdbId(null)
            .withData(titleObj.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient = { source: 'agregarr' };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalledWith('Some Title');
    });

    it('should fetch and return result from client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Fetched Movie').build()),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Fetched Movie');
    });

    it('should handle fail if client returns null', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, client);
        const result = await manager.getData('Some Title');
        expect(result).not.toBeNull();
        expect(result.hasRating).toBe(false);
        expect(result.displayTitle).toBe('Some Title');
        expect(client.fetch).toHaveBeenCalled();
    });

    it('should cache genuine not-found result with source', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            source: 'omdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, client);
        const result = await manager.getData('Unknown Movie');
        expect(result.hasRating).toBe(false);
        expect(result.source).toBe('omdb');
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            expect.objectContaining({ source: 'omdb', imdbRating: null })
        );
    });

    it('should skip unhealthy client and not cache the result', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const unhealthyClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, unhealthyClient);
        const result = await manager.getData('Test Movie');
        expect(result.hasRating).toBe(false);
        expect(result.source).toBe('agregarr');
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
        expect(mockCache.write).not.toHaveBeenCalled();
    });

    it('should not cache result when fetch throws an error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(new Error('API error')),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        const result = await manager.getData('Error Movie');
        expect(result.hasRating).toBe(false);
        expect(result.displayTitle).toBe('Error Movie');
        expect(result.source).toBe('agregarr');
        expect(mockCache.write).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error Movie'), {
            url: null,
            status: null,
            body: null,
        });
    });

    it('should disable client on 4xx HTTP error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 401', 'https://api.example.com', 401, 'Unauthorized');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        const result = await manager.getData('Test Movie');
        expect(mockClient.disable).toHaveBeenCalled();
        expect(result.hasRating).toBe(false);
    });

    it('should NOT disable client on 5xx HTTP error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 500', 'https://api.example.com', 500, 'Internal Server Error');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        await manager.getData('Test Movie');
        expect(mockClient.disable).not.toHaveBeenCalled();
    });

    it('should log at error level for HTTP errors with status, url, and body', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 403', 'https://api.example.com/search', 403, 'Forbidden');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        await manager.getData('Test Movie');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
            url: 'https://api.example.com/search',
            status: 403,
            body: 'Forbidden',
        });
    });

    it('should log at warn level for non-HTTP errors', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new Error('network error');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        await manager.getData('Test Movie');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
            url: null,
            status: null,
            body: null,
        });
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log on successful data retrieval', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const title = buildTitle().withApiTitle('Logged Movie').withSource('agregarr').build();
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(title),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        await manager.getData('Logged Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from agregarr')
        );
    });

    it('should log when ratings are served from cache', async () => {
        const titleObj = buildTitle().withApiTitle('Cached Movie').withImdbRating(8).withSource('agregarr').build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Cached Movie')
            .withImdbId('tt1')
            .withData(titleObj.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, { source: 'agregarr' });
        await manager.getData('Cached Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Cache hit for "Cached Movie" from agregarr')
        );
    });

    it('should log when a cached IMDb ID is used to fetch ratings', async () => {
        const entry = buildCacheEntry()
            .withDisplayTitle('Cached Movie')
            .withImdbId('tt123')
            .withData(null)
            .withExpiry(Date.now() - 1000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Cached Movie').withImdbId('tt123').build()),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, {}, mockClient);
        await manager.getData('Cached Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith('Using cached IMDb ID tt123 for "Cached Movie"');
    });

    it('should use short-circuit fetch when cache entry is expired with imdbId', async () => {
        const expiredEntry = {
            displayTitle: 'Cached Movie',
            imdbId: 'tt123',
            data: null,
            expires: Date.now() - 1000,
        };
        const entry = buildCacheEntry()
            .withDisplayTitle(expiredEntry.displayTitle)
            .withImdbId(expiredEntry.imdbId)
            .withData(expiredEntry.data)
            .withExpiry(expiredEntry.expires)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Cached Movie').withImdbId('tt123').build()),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        await manager.getData('Cached Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Cached Movie', 'tt123');
    });

    it('should use full fetch when cache entry is expired without imdbId', async () => {
        const expiredEntry = {
            displayTitle: 'No ID Movie',
            imdbId: null,
            data: null,
            expires: Date.now() - 1000,
        };
        const entry = buildCacheEntry()
            .withDisplayTitle(expiredEntry.displayTitle)
            .withImdbId(expiredEntry.imdbId)
            .withData(expiredEntry.data)
            .withExpiry(expiredEntry.expires)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('No ID Movie').build()),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        await manager.getData('No ID Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('No ID Movie', null);
    });

    it('should return cached title for valid non-expired entry', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Fresh Movie')
            .withApiTitle('Fresh Movie')
            .withImdbId('tt456')
            .withImdbRating('8.0')
            .build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Fresh Movie')
            .withImdbId('tt456')
            .withData(titleObj.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn(),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        const result = await manager.getData('Fresh Movie');
        expect(result).toEqual(titleObj);
        expect(mockClient.fetch).not.toHaveBeenCalled();
    });

    it('should use short-circuit fetch for non-expired entry with imdbId but invalid data', async () => {
        const invalidEntry = {
            displayTitle: 'Stale Movie',
            imdbId: 'tt789',
            data: null,
            expires: Date.now() + 100000,
        };
        const entry = buildCacheEntry()
            .withDisplayTitle(invalidEntry.displayTitle)
            .withImdbId(invalidEntry.imdbId)
            .withData(invalidEntry.data)
            .withExpiry(invalidEntry.expires)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Stale Movie').withImdbId('tt789').build()),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        await manager.getData('Stale Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Stale Movie', 'tt789');
    });

    it('should use full fetch when cache entry has data but null imdbId', async () => {
        const titleObj = buildTitle().withApiTitle('Cached Movie').build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Cached Movie')
            .withImdbId(null)
            .withData(titleObj.toCacheJSON())
            .withExpiry(Date.now() - 1000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry) };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Cached Movie').build()),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        await manager.getData('Cached Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Cached Movie', null);
    });

    it('should retry with imdbId when provider was changed and original provider returned no ratings', async () => {
        const cachedTitle = buildTitle()
            .withDisplayTitle('Provider Switch Movie')
            .withImdbId('tt1234567')
            .withImdbRating(null)
            .withSource('omdb')
            .build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Provider Switch Movie')
            .withImdbId('tt1234567')
            .withData(cachedTitle.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi
                .fn()
                .mockResolvedValue(
                    buildTitle()
                        .withApiTitle('Provider Switch Movie')
                        .withImdbId('tt1234567')
                        .withImdbRating('7.5')
                        .withSource('agregarr')
                        .build()
                ),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, {}, mockClient);
        const result = await manager.getData('Provider Switch Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Provider Switch Movie', 'tt1234567');
        expect(result.imdbRating).toBe(7.5);
        expect(result.source).toBe('agregarr');
    });
});
