/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheEntry, CacheManager } from '../../../../src/core/cache/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { Logger } from '../../../../src/core/logger';
import { Title } from '../../../../src/core/title';
import { buildMockAdapter, type MockPlatformAdapter } from '../../../mocks/adapter';
import { buildCacheEntry } from '../../../mocks/cache';
import { buildConfig } from '../../../mocks/config';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

describe('CacheManager', () => {
    let adapter: MockPlatformAdapter;
    let cacheManager: CacheManager;
    let config: ConfigManager;
    let mockLogger: Logger;

    beforeEach(() => {
        adapter = buildMockAdapter()
            .withStorageGetResolvingTo(null)
            .withStorageSetResolvingTo(undefined)
            .withStorageDeleteResolvingTo(undefined)
            .withStorageGetKeysResolvingTo([])
            .build();
        mockLogger = buildLogger().build();
        config = buildConfig()
            .withCacheTtlNoRating('1')
            .withCacheTtlRatedNewYear('30')
            .withCacheTtlRatedOldYear('-1')
            .build();
        cacheManager = new CacheManager(adapter, config, mockLogger);
    });

    it('should return null when cache is empty', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Some Title');
        expect(result).toBeNull();
    });

    it('should return cache entry even without title data', async () => {
        const entry = buildCacheEntry()
            .withDisplayTitle('Missing Data')
            .withImdbId(null)
            .withData(null)
            .withExpiry(Date.now() + 10000)
            .build();
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

        const result = await cacheManager.read('Missing Data');
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result!.getTitle()).toBeNull();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should write data to storage', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const title = buildTitle().withApiTitle('Test Title').build();
        await cacheManager.write('Test Title', title);
        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.stringContaining('Test Title'));
    });

    it('should clear cache', async () => {
        adapter.storageGetKeys.mockResolvedValue(['fmc:key1']);
        await cacheManager.clear();
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:key1');
    });

    it('should delete single cache entry', async () => {
        await cacheManager.delete('Some Title');
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:some_title');
    });

    it('should write and read cache entry', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Test Title')
            .withApiTitle('Test Title')
            .withYear(2026)
            .withImdbRating('8.0')
            .build();
        adapter.storageSet.mockImplementation((key, value) => {
            // Store the written value so we can return it on read
            adapter.storageGet.mockImplementation(k => (k === key ? Promise.resolve(value) : Promise.resolve(null)));
            return Promise.resolve(null as unknown as void);
        });
        await cacheManager.write('Test Title', titleObj);
        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.any(String));
        const entry = await cacheManager.read('Test Title');
        expect(entry).not.toBeNull();
        const result = entry!.getTitle();
        expect(result?.displayTitle).toEqual(titleObj.displayTitle);
        expect(result?.year).toEqual(titleObj.year);
    });

    it('should return expired CacheEntry for expired cache', async () => {
        vi.useFakeTimers();
        const now = Date.now();
        vi.setSystemTime(now);
        const titleObj = buildTitle().withDisplayTitle('Old Title').withApiTitle('Old Title').withYear(2020).build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Old Title')
            .withImdbId(null)
            .withData(titleObj.toCacheJSON())
            .withExpiry(now - 1000)
            .build();
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Old Title');
        expect(result).not.toBeNull();
        expect(result!.isExpired).toBe(true);
        vi.useRealTimers();
    });

    it('should store indefinite TTL as null in storage', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Indefinite Title')
            .withApiTitle('Indefinite Title')
            .withYear(1900)
            .withImdbRating(null)
            .build();
        config.getInt = vi.fn().mockReturnValue(-1);
        await cacheManager.write('Indefinite Title', titleObj);
        const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:indefinite_title');
        const entry = JSON.parse(setCall![1] as string);
        expect(entry.expires).toBeNull();
    });

    it('should return valid entry for indefinite cache expiration (null)', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Indefinite Title')
            .withApiTitle('Indefinite Title')
            .withImdbRating('8.0')
            .build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Indefinite Title')
            .withImdbId(null)
            .withData(titleObj.toCacheJSON())
            .withExpiry(null)
            .build();
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Indefinite Title');
        expect(result).not.toBeNull();
        expect(result!.getTitle()?.displayTitle).toBe('Indefinite Title');
    });

    it('should return null and log the display title when JSON parsing fails in read', async () => {
        adapter.storageGet.mockResolvedValue('invalid-json{');
        const result = await cacheManager.read('Some Title');
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:some_title',
            displayTitle: 'Some Title',
        });
    });

    it('should return cache entry for cache hit', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Cached Movie')
            .withApiTitle('Cached Movie')
            .withImdbRating('8.0')
            .withSource('omdb')
            .build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Cached Movie')
            .withImdbId('tt123')
            .withData(titleObj.toCacheJSON())
            .withExpiry(Date.now() + 100000)
            .build();
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Cached Movie');
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result!.imdbId).toBe('tt123');
        expect(result!.getTitle()?.imdbRating).toBe(8.0);
    });

    it('should produce the same cache key for titles that differ only by punctuation', async () => {
        const title = buildTitle().withApiTitle('Test Title').build();
        await cacheManager.write('Test: Title', title);
        const key1 = adapter.storageSet.mock.calls[0][0];
        adapter.storageSet.mockClear();
        await cacheManager.write('Test Title', title);
        const key2 = adapter.storageSet.mock.calls[0][0];
        expect(key1).toBe(key2);
        expect(key1).toBe('fmc:test_title');
    });

    it('should store displayTitle and imdbId at top level', async () => {
        const title = buildTitle()
            .withDisplayTitle('Test')
            .withApiTitle('Test')
            .withImdbId('tt123')
            .withYear(2024)
            .build();
        adapter.storageSet.mockResolvedValue(null as unknown as void);
        await cacheManager.write('Test', title);
        const call = adapter.storageSet.mock.calls[0];
        const entry = JSON.parse(call[1] as string);
        expect(entry.displayTitle).toBe('Test');
        expect(entry.imdbId).toBe('tt123');
        expect(entry.data).not.toHaveProperty('displayTitle');
        expect(entry.data.apiTitle).toBe('Test');
    });

    it('should return CacheEntry with getTitle for valid entry', async () => {
        const now = Date.now();
        const entryData = {
            displayTitle: 'Cached Movie',
            imdbId: 'tt456',
            data: {
                apiTitle: 'Cached Movie',
                imdbId: 'tt456',
                year: 2020,
                imdbRating: '7.5',
                imdbVotes: null,
                rtRating: null,
                mcRating: null,
                source: null,
                type: null,
            },
            expires: now + 10000,
        };
        adapter.storageGet.mockResolvedValue(JSON.stringify(entryData));
        const result = await cacheManager.read('Cached Movie');
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result!.getTitle()).toBeInstanceOf(Title);
        expect(result!.getTitle()?.displayTitle).toBe('Cached Movie');
        expect(result!.imdbId).toBe('tt456');
        expect(result!.isExpired).toBe(false);
    });

    it('should identify expired entry', async () => {
        const now = Date.now();
        const entryData = {
            displayTitle: 'Expired Movie',
            imdbId: 'tt789',
            data: {
                apiTitle: 'Expired Movie',
                imdbId: 'tt789',
                year: 2020,
                imdbRating: '6.5',
                imdbVotes: null,
                rtRating: null,
                mcRating: null,
                source: null,
                type: null,
            },
            expires: now - 1000,
        };
        adapter.storageGet.mockResolvedValue(JSON.stringify(entryData));
        const result = await cacheManager.read('Expired Movie');
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result!.isExpired).toBe(true);
        expect(result!.imdbId).toBe('tt789');
        expect(result!.getTitle()?.displayTitle).toBe('Expired Movie');
    });

    it('should return null for cache miss', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Missing Movie');
        expect(result).toBeNull();
    });
});
