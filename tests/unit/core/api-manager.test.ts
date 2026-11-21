/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../../../src/core/api/base-api-client';
import { ApiClientManager } from '../../../src/core/api-manager';
import { DisabledClientsManager } from '../../../src/core/disabled-clients';
import { FlixMonkeyError } from '../../../src/core/utils/index';
import { buildMockAdapter } from '../../mocks/adapter';
import { buildCacheEntry } from '../../mocks/cache';
import { buildLogger } from '../../mocks/logger';
import { buildTitle, emptyTitleData } from '../../mocks/title';

const disabledManager = new DisabledClientsManager(buildMockAdapter().build());

describe('ApiClientManager', () => {
    it('returns cached data when the cache has an entry', async () => {
        const titleObj = buildTitle().withApiTitle('Cached Movie').withImdbRating(8.0).withSource('agregarr').build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Some Title')
            .withImdbId(undefined)
            .withData(titleObj.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn(),
            fetch: vi.fn(),
            disable: vi.fn(),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalledWith('Some Title');
        expect(mockClient.fetch).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Cache hit for "Some Title" from agregarr')
        );
    });

    it('fetches and returns the client result on a cache miss', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Fetched Movie').withSource('agregarr').build()),
            disable: vi.fn(),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Fetched Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Successfully retrieved ratings for "Some Title" from agregarr')
        );
    });

    it('returns a not-found title with no rating when the client returns nothing', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const client: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(undefined),
            disable: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, client);
        const result = await manager.getData('Some Title');
        expect(result).not.toBeUndefined();
        expect(result.hasRating).toBe(false);
        expect(result.displayTitle).toBe('Some Title');
        expect(client.fetch).toHaveBeenCalled();
    });

    it('caches a not-found result with its source', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const client: ApiClient = {
            source: 'omdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(undefined),
            disable: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, client);
        const result = await manager.getData('Unknown Movie');
        expect(result.hasRating).toBe(false);
        expect(result.source).toBe('omdb');
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            expect.objectContaining({ source: 'omdb', imdbRating: undefined })
        );
    });

    it('skips an unhealthy client and does not cache the result', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const unhealthyClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
            disable: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, unhealthyClient);
        const result = await manager.getData('Test Movie');
        expect(result.hasRating).toBe(false);
        expect(result.source).toBe('agregarr');
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
        expect(mockCache.write).not.toHaveBeenCalled();
    });

    it('does not cache the result and warns when the fetch throws', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(new Error('API error')),
            disable: vi.fn(),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);
        const result = await manager.getData('Error Movie');
        expect(result.hasRating).toBe(false);
        expect(result.displayTitle).toBe('Error Movie');
        expect(result.source).toBe('agregarr');
        expect(mockCache.write).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error Movie'), {
            url: undefined,
            status: undefined,
            body: undefined,
        });
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('disables the client on a 4xx HTTP error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 401', 'https://api.example.com', 401, 'Unauthorized');
        const mockClient: ApiClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);
        const result = await manager.getData('Test Movie');
        expect(mockClient.disable).toHaveBeenCalled();
        expect(result.hasRating).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
            url: 'https://api.example.com',
            status: 401,
            body: 'Unauthorized',
        });
    });

    it('does not disable the client on a 5xx HTTP error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 500', 'https://api.example.com', 500, 'Internal Server Error');
        const mockClient: ApiClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);
        await manager.getData('Test Movie');
        expect(mockClient.disable).not.toHaveBeenCalled();
    });

    it('returns a not-found title and warns without metadata when the fetch rejects with a non-Error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue('boom'),
            disable: vi.fn(),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);

        const result = await manager.getData('Broken Movie');

        expect(result.hasRating).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Broken Movie'), {
            url: undefined,
            status: undefined,
            body: undefined,
        });
    });

    it('fetches with the cached IMDb ID when the entry is expired', async () => {
        const expiredEntry = {
            displayTitle: 'Cached Movie',
            imdbId: 'tt123',
            data: emptyTitleData,
            expires: Date.now() - 1000,
        };
        const entry = buildCacheEntry()
            .withDisplayTitle(expiredEntry.displayTitle)
            .withImdbId(expiredEntry.imdbId)
            .withData(expiredEntry.data)
            .withExpiry(expiredEntry.expires)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Cached Movie').withImdbId('tt123').build()),
            disable: vi.fn(),
        };
        const mockLogger = buildLogger().build();
        const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);
        await manager.getData('Cached Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Cached Movie', 'tt123');
        expect(mockLogger.debug).toHaveBeenCalledWith('Using cached IMDb ID tt123 for "Cached Movie"');
    });

    it('fetches by title when an expired entry has no IMDb ID', async () => {
        const expiredEntry = {
            displayTitle: 'No ID Movie',
            imdbId: undefined,
            data: emptyTitleData,
            expires: Date.now() - 1000,
        };
        const entry = buildCacheEntry()
            .withDisplayTitle(expiredEntry.displayTitle)
            .withImdbId(expiredEntry.imdbId)
            .withData(expiredEntry.data)
            .withExpiry(expiredEntry.expires)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('No ID Movie').build()),
            disable: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, mockClient);
        await manager.getData('No ID Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('No ID Movie', undefined);
    });

    it('fetches with the cached IMDb ID when the entry has empty title data', async () => {
        const emptyEntry = {
            displayTitle: 'Stale Movie',
            imdbId: 'tt789',
            data: emptyTitleData,
            expires: Date.now() + 100000,
        };
        const entry = buildCacheEntry()
            .withDisplayTitle(emptyEntry.displayTitle)
            .withImdbId(emptyEntry.imdbId)
            .withData(emptyEntry.data)
            .withExpiry(emptyEntry.expires)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(buildTitle().withApiTitle('Stale Movie').withImdbId('tt789').build()),
            disable: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, mockClient);
        await manager.getData('Stale Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Stale Movie', 'tt789');
    });

    it('retries with the cached IMDb ID when the provider changed and the cached title has no rating', async () => {
        const cachedTitle = buildTitle()
            .withDisplayTitle('Provider Switch Movie')
            .withImdbId('tt1234567')
            .withImdbRating(undefined)
            .withSource('omdb')
            .build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Provider Switch Movie')
            .withImdbId('tt1234567')
            .withData(cachedTitle.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        const mockCache = { read: vi.fn().mockResolvedValue(entry), write: vi.fn() };
        const mockClient: ApiClient = {
            source: 'agregarr',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi
                .fn()
                .mockResolvedValue(
                    buildTitle()
                        .withApiTitle('Provider Switch Movie')
                        .withImdbId('tt1234567')
                        .withImdbRating(7.5)
                        .withSource('agregarr')
                        .build()
                ),
            disable: vi.fn(),
        };
        const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, mockClient);
        const result = await manager.getData('Provider Switch Movie');
        expect(mockClient.fetch).toHaveBeenCalledWith('Provider Switch Movie', 'tt1234567');
        expect(result.imdbRating).toBe(7.5);
        expect(result.source).toBe('agregarr');
    });
});
