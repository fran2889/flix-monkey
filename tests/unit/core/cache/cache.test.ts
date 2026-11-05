/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheEntry, CacheManager } from '../../../../src/core/cache/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { Logger } from '../../../../src/core/logger';
import { ParseError } from '../../../../src/core/parse-utils';
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
            .withStorageGetResolvingTo(undefined)
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

    it('should return undefined when cache is empty', async () => {
        adapter.storageGet.mockResolvedValue(undefined);
        const result = await cacheManager.read('Some Title');
        expect(result).toBeUndefined();
    });

    it('should treat an entry without title data as a cache miss', async () => {
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({ displayTitle: 'Missing Data', expires: Date.now() + 10000 })
        );

        const result = await cacheManager.read('Missing Data');
        expect(result).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:missing_data',
            displayTitle: 'Missing Data',
            error: expect.any(ParseError),
        });
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:missing_data');
    });

    it('should write data to storage', async () => {
        adapter.storageGet.mockResolvedValue(undefined);
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
            .withImdbRating(8.0)
            .build();
        adapter.storageSet.mockImplementation((key, value) => {
            // Store the written value so we can return it on read
            adapter.storageGet.mockImplementation(k =>
                k === key ? Promise.resolve(value) : Promise.resolve(undefined)
            );
            return Promise.resolve(undefined);
        });
        await cacheManager.write('Test Title', titleObj);
        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.any(String));
        const entry = await cacheManager.read('Test Title');
        expect(entry).not.toBeUndefined();
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
            .withImdbId(undefined)
            .withData(titleObj.toCacheJSON())
            .withExpiry(now - 1000)
            .build();
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Old Title');
        expect(result).not.toBeUndefined();
        expect(result!.isExpired).toBe(true);
        vi.useRealTimers();
    });

    it('should store indefinite TTL as undefined in storage', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Indefinite Title')
            .withApiTitle('Indefinite Title')
            .withYear(1900)
            .withImdbRating(undefined)
            .build();
        config.getInt = vi.fn().mockReturnValue(-1);
        await cacheManager.write('Indefinite Title', titleObj);
        const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:indefinite_title');
        const entry = JSON.parse(setCall![1] as string);
        expect(entry.expires).toBeUndefined();
    });

    it('should apply the rated-new-year TTL to a rated title that has no year', async () => {
        // A rated title without a release year cannot be classified as old or new,
        // so it falls back to cacheTtlRatedNewYear rather than cacheTtlNoRating.
        const titleObj = buildTitle()
            .withDisplayTitle('Yearless Title')
            .withApiTitle('Yearless Title')
            .withImdbRating(8.0)
            .build();
        expect(titleObj.hasRating).toBe(true);
        expect(titleObj.year).toBeUndefined();
        const getInt = vi.spyOn(config, 'getInt');

        await cacheManager.write('Yearless Title', titleObj);

        expect(getInt).toHaveBeenCalledWith('cacheTtlRatedNewYear');
        expect(getInt).not.toHaveBeenCalledWith('cacheTtlNoRating');
        expect(getInt).not.toHaveBeenCalledWith('cacheTtlRatedOldYear');

        // cacheTtlRatedNewYear is 30 days, so the entry expires rather than being indefinite.
        const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:yearless_title');
        const entry = JSON.parse(setCall![1] as string);
        expect(entry.expires).toBeGreaterThan(Date.now());
    });

    it('should apply the rated-old-year TTL to a rated title released long ago', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Old Title')
            .withApiTitle('Old Title')
            .withYear(1990)
            .withImdbRating(8.0)
            .build();
        const getInt = vi.spyOn(config, 'getInt');

        await cacheManager.write('Old Title', titleObj);

        expect(getInt).toHaveBeenCalledWith('cacheTtlRatedOldYear');
        expect(getInt).not.toHaveBeenCalledWith('cacheTtlNoRating');

        // cacheTtlRatedOldYear is -1 (indefinite), so no expiry is persisted.
        const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:old_title');
        const entry = JSON.parse(setCall![1] as string);
        expect(entry.expires).toBeUndefined();
    });

    it('should return valid entry for indefinite cache expiration (undefined)', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Indefinite Title')
            .withApiTitle('Indefinite Title')
            .withImdbRating(8.0)
            .build();
        const entry = buildCacheEntry()
            .withDisplayTitle('Indefinite Title')
            .withImdbId(undefined)
            .withData(titleObj.toCacheJSON())
            .withExpiry(undefined)
            .build();
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));
        const result = await cacheManager.read('Indefinite Title');
        expect(result).not.toBeUndefined();
        expect(result!.getTitle()?.displayTitle).toBe('Indefinite Title');
    });

    it('treats a pre-migration entry with null expiry as never expiring', async () => {
        const legacyRaw = JSON.stringify({
            displayTitle: 'Legacy Movie',
            imdbId: null,
            data: { apiTitle: 'Legacy Movie', imdbRating: 8.1 },
            expires: null,
        });
        adapter.storageGet.mockResolvedValue(legacyRaw);

        const result = await cacheManager.read('Legacy Movie');

        expect(result).toBeDefined();
        expect(result!.isExpired).toBe(false);
        expect(result!.imdbId).toBeUndefined();
    });

    it('should return undefined, log the syntax error, and delete the entry when JSON parsing fails', async () => {
        adapter.storageGet.mockResolvedValue('invalid-json{');
        const result = await cacheManager.read('Some Title');
        expect(result).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:some_title',
            displayTitle: 'Some Title',
            error: expect.any(SyntaxError),
        });
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:some_title');
    });

    it('logs the failing field when a cache entry is corrupt', async () => {
        adapter.storageGet.mockResolvedValue(JSON.stringify({ displayTitle: 'Bad Expiry', data: {}, expires: 'soon' }));

        await expect(cacheManager.read('Bad Expiry')).resolves.toBeUndefined();

        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:bad_expiry',
            displayTitle: 'Bad Expiry',
            error: expect.objectContaining({ message: 'expected number at "expires"' }),
        });
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:bad_expiry');
    });

    it.each([
        ['null', 'null'],
        ['an array', '[]'],
        ['a string', '"value"'],
        ['a number', '42'],
    ])('should treat %s JSON as a cache miss', async (_label, raw) => {
        adapter.storageGet.mockResolvedValue(raw);

        await expect(cacheManager.read('Corrupt Title')).resolves.toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:corrupt_title',
            displayTitle: 'Corrupt Title',
            error: expect.any(ParseError),
        });
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:corrupt_title');
    });

    it.each([
        ['a missing display title', { data: {} }],
        ['a non-string display title', { displayTitle: 42, data: {} }],
        ['a non-string IMDb ID', { displayTitle: 'Corrupt', imdbId: 42, data: {} }],
        ['a non-number expiry', { displayTitle: 'Corrupt', expires: 'soon', data: {} }],
        ['a missing data payload', { displayTitle: 'Corrupt' }],
        ['a non-object data payload', { displayTitle: 'Corrupt', data: null }],
        ['an array data payload', { displayTitle: 'Corrupt', data: [] }],
        ['a string data payload', { displayTitle: 'Corrupt', data: 'text' }],
        ['a number data payload', { displayTitle: 'Corrupt', data: 42 }],
        ['a string rating', { displayTitle: 'Corrupt', data: { imdbRating: '7.5' } }],
    ])('should treat an entry with %s as a cache miss', async (_label, entry) => {
        adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

        await expect(cacheManager.read('Corrupt Title')).resolves.toBeUndefined();
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:corrupt_title');
    });

    it('ignores unknown entry and title fields', async () => {
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                displayTitle: 'Cached Movie',
                imdbId: 'tt456',
                data: { apiTitle: 'Cached Movie', imdbRating: 7.5, rating: 9.9, extra: true },
                expires: Date.now() + 10000,
                unknownEntryField: 'ignored',
            })
        );

        const entry = await cacheManager.read('Cached Movie');

        expect(entry).toBeInstanceOf(CacheEntry);
        expect(entry!.getTitle().imdbRating).toBe(7.5);
        expect(entry!.toJSON().data).not.toHaveProperty('rating');
        expect(entry!.toJSON().data).not.toHaveProperty('extra');
    });

    it('returns a Title for an entry with empty title data', async () => {
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({ displayTitle: 'Empty Movie', data: {}, expires: Date.now() + 10000 })
        );

        const entry = await cacheManager.read('Empty Movie');

        expect(entry!.getTitle()).toBeInstanceOf(Title);
        expect(entry!.getTitle().displayTitle).toBe('Empty Movie');
    });

    it('keeps every known title field', async () => {
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                displayTitle: 'Full Movie',
                imdbId: 'tt1',
                data: {
                    apiTitle: 'Full Movie',
                    imdbId: 'tt1',
                    year: 2020,
                    imdbRating: 7.5,
                    imdbVotes: 1000,
                    rtRating: 90,
                    mcRating: 80,
                    source: 'omdb',
                    type: 'movie',
                },
                expires: Date.now() + 10000,
            })
        );

        const title = (await cacheManager.read('Full Movie'))!.getTitle();

        expect(title).toMatchObject({
            apiTitle: 'Full Movie',
            imdbId: 'tt1',
            year: 2020,
            imdbRating: 7.5,
            imdbVotes: 1000,
            rtRating: 90,
            mcRating: 80,
            source: 'omdb',
            type: 'movie',
        });
    });

    it('should treat a legacy nested entry as a cache miss', async () => {
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                data: { displayTitle: 'Legacy Movie', imdbId: 'tt1', rating: 8.1 },
                expires: null,
            })
        );

        await expect(cacheManager.read('Legacy Movie')).resolves.toBeUndefined();
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:legacy_movie');
    });

    it('should resolve a miss when deleting a corrupt entry fails', async () => {
        adapter.storageGet.mockResolvedValue('invalid-json{');
        adapter.storageDelete.mockRejectedValue(new Error('delete failed'));

        await expect(cacheManager.read('Some Title')).resolves.toBeUndefined();

        expect(mockLogger.debug).toHaveBeenCalledWith('Failed to delete corrupt cache entry', {
            key: 'fmc:some_title',
            error: expect.any(Error),
        });
    });

    it('should return cache entry for cache hit', async () => {
        const titleObj = buildTitle()
            .withDisplayTitle('Cached Movie')
            .withApiTitle('Cached Movie')
            .withImdbRating(8.0)
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
        expect(result).not.toBeUndefined();
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
        adapter.storageSet.mockResolvedValue(undefined);
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
                imdbRating: 7.5,
                imdbVotes: undefined,
                rtRating: undefined,
                mcRating: undefined,
                source: undefined,
                type: undefined,
            },
            expires: now + 10000,
        };
        adapter.storageGet.mockResolvedValue(JSON.stringify(entryData));
        const result = await cacheManager.read('Cached Movie');
        expect(result).not.toBeUndefined();
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
                imdbRating: 6.5,
                imdbVotes: undefined,
                rtRating: undefined,
                mcRating: undefined,
                source: undefined,
                type: undefined,
            },
            expires: now - 1000,
        };
        adapter.storageGet.mockResolvedValue(JSON.stringify(entryData));
        const result = await cacheManager.read('Expired Movie');
        expect(result).not.toBeUndefined();
        expect(result).toBeInstanceOf(CacheEntry);
        expect(result!.isExpired).toBe(true);
        expect(result!.imdbId).toBe('tt789');
        expect(result!.getTitle()?.displayTitle).toBe('Expired Movie');
    });

    it('should return undefined for cache miss', async () => {
        adapter.storageGet.mockResolvedValue(undefined);
        const result = await cacheManager.read('Missing Movie');
        expect(result).toBeUndefined();
    });
});
