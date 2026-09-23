/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { ApiClientManager } from '../../../src/core/api-manager.js';
import { CacheEntry } from '../../../src/core/cache.js';
import { Title } from '../../../src/core/title.js';
import { FlixMonkeyError } from '../../../src/core/utils.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('ApiClientManager', () => {
    it('should return cached data if available', async () => {
        const titleObj = new Title({ apiTitle: 'Cached Movie', imdbRating: '8.0', source: 'agregarr' });
        const entry = new CacheEntry('Some Title', null, titleObj.toCacheJSON(), Date.now() + 100000);
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient = { source: 'agregarr' };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalledWith('Some Title', 'agregarr');
    });

    it('should fetch and return result from client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
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
        const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
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
        const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
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
        const manager = new ApiClientManager(mockCache, {}, unhealthyClient, createMockLogger());
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
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
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
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
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
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
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
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
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
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Test Movie');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
            url: null,
            status: null,
            body: null,
        });
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should reset all disabled clients and return the list of re-enabled ones', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue(['xmdb', 'omdb']) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, createMockLogger());
        const reenabled = await manager.resetDisabledClients();
        expect(mockDisabledManager.resetAll).toHaveBeenCalled();
        expect(reenabled).toEqual(['xmdb', 'omdb']);
    });

    it('should handle resetDisabledClients when no clients are re-enabled', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue([]) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, createMockLogger());
        const reenabled = await manager.resetDisabledClients();
        expect(reenabled).toEqual([]);
    });

    it('should log on successful data retrieval', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const title = new Title({ apiTitle: 'Logged Movie', source: 'agregarr' });
        const mockClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(title),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Logged Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from agregarr')
        );
    });

    describe('cache refresh optimization', () => {
        it('should use short-circuit fetch when cache entry is expired with imdbId', async () => {
            const expiredEntry = {
                displayTitle: 'Cached Movie',
                imdbId: 'tt123',
                data: null,
                expires: Date.now() - 1000,
            };
            const entry = CacheEntry.fromJSON(JSON.stringify(expiredEntry));
            const mockCache = { read: vi.fn().mockResolvedValue(entry) };
            const mockClient = {
                source: 'agregarr',
                getStatus: vi.fn().mockResolvedValue({ healthy: true }),
                fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Cached Movie', imdbId: 'tt123' })),
            };
            const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
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
            const entry = CacheEntry.fromJSON(JSON.stringify(expiredEntry));
            const mockCache = { read: vi.fn().mockResolvedValue(entry) };
            const mockClient = {
                source: 'agregarr',
                getStatus: vi.fn().mockResolvedValue({ healthy: true }),
                fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'No ID Movie' })),
            };
            const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
            await manager.getData('No ID Movie');
            expect(mockClient.fetch).toHaveBeenCalledWith('No ID Movie');
            expect(mockClient.fetch).not.toHaveBeenCalledWith('No ID Movie', null);
        });

        it('should return cached title for valid non-expired entry', async () => {
            const titleObj = new Title({
                displayTitle: 'Fresh Movie',
                apiTitle: 'Fresh Movie',
                imdbId: 'tt456',
                imdbRating: '8.0',
            });
            const validEntry = {
                displayTitle: 'Fresh Movie',
                imdbId: 'tt456',
                data: titleObj.toCacheJSON(),
                expires: Date.now() + 100000,
            };
            const entry = CacheEntry.fromJSON(JSON.stringify(validEntry));
            const mockCache = { read: vi.fn().mockResolvedValue(entry) };
            const mockClient = {
                source: 'agregarr',
                getStatus: vi.fn(),
                fetch: vi.fn(),
            };
            const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
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
            const entry = CacheEntry.fromJSON(JSON.stringify(invalidEntry));
            const mockCache = { read: vi.fn().mockResolvedValue(entry) };
            const mockClient = {
                source: 'agregarr',
                getStatus: vi.fn().mockResolvedValue({ healthy: true }),
                fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Stale Movie', imdbId: 'tt789' })),
            };
            const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
            await manager.getData('Stale Movie');
            expect(mockClient.fetch).toHaveBeenCalledWith('Stale Movie', 'tt789');
        });

        it('should use full fetch when cache entry has data but null imdbId', async () => {
            const titleObj = new Title({ apiTitle: 'Cached Movie', imdbRating: '8.0' });
            const entry = new CacheEntry('Cached Movie', null, titleObj.toCacheJSON(), Date.now() + 100000);
            const mockCache = { read: vi.fn().mockResolvedValue(entry) };
            const mockClient = {
                source: 'agregarr',
                getStatus: vi.fn().mockResolvedValue({ healthy: true }),
                fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Cached Movie' })),
            };
            const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
            await manager.getData('Cached Movie');
            expect(mockClient.fetch).toHaveBeenCalledWith('Cached Movie');
            expect(mockClient.fetch).not.toHaveBeenCalledWith('Cached Movie', null);
        });
    });
});
