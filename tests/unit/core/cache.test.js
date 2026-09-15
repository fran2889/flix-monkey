/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheEntry, CacheManager } from '../../../src/core/cache.js';
import { Title } from '../../../src/core/title.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createConfig } from '../../mocks/config.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('CacheManager', () => {
    let adapter;
    let cacheManager;
    let config;
    let mockLogger;

    beforeEach(() => {
        adapter = createMockAdapter({
            storageGet: vi.fn(),
            storageSet: vi.fn(),
            storageDelete: vi.fn(),
            storageGetKeys: vi.fn(),
        });
        mockLogger = createMockLogger();
        config = createConfig({
            cacheTtlNoRating: '1',
            cacheTtlRatedNewYear: '30',
            cacheTtlRatedOldYear: '-1',
        });
        cacheManager = new CacheManager(adapter, config, mockLogger);
    });

    it('should return null when cache is empty', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Some Title', 'agregarr');
        expect(result).toBeNull();
    });

    it('should treat a cache entry without title data as a cache miss', async () => {
        const entry = new CacheEntry('Missing Data', null, null, Date.now() + 10000);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

        await expect(cacheManager.read('Missing Data', 'agregarr')).resolves.toBeNull();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should write data to storage', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const title = new Title({ apiTitle: 'Test Title' });
        await cacheManager.write('Test Title', title);
        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.stringContaining('Test Title'));
    });

    it('should clear cache', async () => {
        adapter.storageGetKeys.mockResolvedValue(['fmc:key1']);
        await cacheManager.clear();
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:key1');
    });

    it('should write and read cache entry', async () => {
        const titleData = { displayTitle: 'Test Title', year: 2026, imdbRating: '8.0' };
        const titleObj = new Title(titleData);
        adapter.storageSet.mockImplementation((key, value) => {
            // Store the written value so we can return it on read
            adapter.storageGet.mockImplementation(k => (k === key ? Promise.resolve(value) : Promise.resolve(null)));
            return Promise.resolve(null);
        });
        await cacheManager.write('Test Title', titleObj);
        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.any(String));
        const entry = await cacheManager.read('Test Title', 'agregarr');
        expect(entry).not.toBeNull();
        const result = entry.getTitle();
        expect(result.displayTitle).toEqual(titleObj.displayTitle);
        expect(result.year).toEqual(titleObj.year);
    });

    it('should return expired CacheEntry for expired cache', async () => {
        vi.useFakeTimers();
        const now = Date.now();
        vi.setSystemTime(now);
        const titleData = { displayTitle: 'Old Title', year: 2020 };
        const titleObj = new Title(titleData);
        const entry = new CacheEntry('Old Title', null, titleObj.toCacheJSON(), now - 1000);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Old Title', 'agregarr');
        expect(result).not.toBeNull();
        expect(result.isExpired).toBe(true);
        vi.useRealTimers();
    });

    it('should store indefinite TTL as null in storage', async () => {
        const titleData = { displayTitle: 'Indefinite Title', hasRating: true, year: 1900 };
        const titleObj = new Title(titleData);
        config.getInt = vi.fn().mockReturnValue(-1);
        await cacheManager.write('Indefinite Title', titleObj);
        const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:indefinite_title');
        const entry = JSON.parse(setCall[1]);
        expect(entry.expires).toBeNull();
    });

    it('should return valid entry for indefinite cache expiration (null)', async () => {
        const titleObj = new Title({ displayTitle: 'Indefinite Title', imdbRating: '8.0' });
        const entry = new CacheEntry('Indefinite Title', null, titleObj.toCacheJSON(), null);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Indefinite Title', 'agregarr');
        expect(result).not.toBeNull();
        expect(result.getTitle().displayTitle).toBe('Indefinite Title');
    });

    it('should return null and log the display title when JSON parsing fails in read', async () => {
        adapter.storageGet.mockResolvedValue('invalid-json{');
        const result = await cacheManager.read('Some Title', 'agregarr');
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:some_title',
            displayTitle: 'Some Title',
        });
    });

    it('should return not-found entry when source matches active source', async () => {
        const titleObj = Title.notFound('Missing Movie', 'agregarr');
        const entry = new CacheEntry('Missing Movie', null, titleObj.toCacheJSON(), Date.now() + 100000);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Missing Movie', 'agregarr');
        expect(result).not.toBeNull();
        const title = result.getTitle();
        expect(title).not.toBeNull();
        expect(title.hasRating).toBe(false);
        expect(title.source).toBe('agregarr');
    });

    it('should return null for not-found entry when source does not match active source', async () => {
        const titleObj = Title.notFound('Missing Movie', 'omdb');
        const entry = new CacheEntry('Missing Movie', null, titleObj.toCacheJSON(), Date.now() + 100000);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Missing Movie', 'agregarr');
        expect(result).toBeNull();
    });

    it('should return rated entry regardless of source mismatch', async () => {
        const titleObj = new Title({ displayTitle: 'Good Movie', imdbRating: '8.0', source: 'omdb' });
        const entry = new CacheEntry('Good Movie', null, titleObj.toCacheJSON(), Date.now() + 100000);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Good Movie', 'agregarr');
        expect(result).not.toBeNull();
        expect(result.getTitle().imdbRating).toBe(8.0);
    });

    it('should treat not-found entry with null source as cache miss', async () => {
        const titleObj = Title.notFound('Old Entry');
        const entry = new CacheEntry('Old Entry', null, titleObj.toCacheJSON(), Date.now() + 100000);
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Old Entry', 'agregarr');
        expect(result).toBeNull();
    });

    it('should produce the same cache key for titles that differ only by punctuation', async () => {
        const title = new Title({ apiTitle: 'Test Title' });
        await cacheManager.write('Test: Title', title);
        const key1 = adapter.storageSet.mock.calls[0][0];
        adapter.storageSet.mockClear();
        await cacheManager.write('Test Title', title);
        const key2 = adapter.storageSet.mock.calls[0][0];
        expect(key1).toBe(key2);
        expect(key1).toBe('fmc:test_title');
    });
});

describe('CacheEntry class', () => {
    let adapter;
    let cacheManager;
    let config;
    let mockLogger;

    beforeEach(() => {
        adapter = createMockAdapter({
            storageGet: vi.fn(),
            storageSet: vi.fn(),
            storageDelete: vi.fn(),
            storageGetKeys: vi.fn(),
        });
        mockLogger = createMockLogger();
        config = createConfig({
            cacheTtlNoRating: '1',
            cacheTtlRatedNewYear: '30',
            cacheTtlRatedOldYear: '-1',
        });
        cacheManager = new CacheManager(adapter, config, mockLogger);
    });

    it('should store displayTitle and imdbId at top level', async () => {
        const title = new Title({ displayTitle: 'Test', apiTitle: 'Test', imdbId: 'tt123', year: 2024 });
        adapter.storageSet.mockResolvedValue(null);
        await cacheManager.write('Test', title);
        const call = adapter.storageSet.mock.calls[0];
        const entry = JSON.parse(call[1]);
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
        const result = await cacheManager.read('Cached Movie', 'agregarr');
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result.getTitle()).toBeInstanceOf(Title);
        expect(result.getTitle().displayTitle).toBe('Cached Movie');
        expect(result.imdbId).toBe('tt456');
        expect(result.isExpired).toBe(false);
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
        const result = await cacheManager.read('Expired Movie', 'agregarr');
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result.isExpired).toBe(true);
        expect(result.imdbId).toBe('tt789');
        expect(result.displayTitle).toBe('Expired Movie');
    });

    it('should return null for cache miss', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Missing Movie', 'agregarr');
        expect(result).toBeNull();
    });
});
