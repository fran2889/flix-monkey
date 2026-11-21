/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../../../../src/core/api/base-api-client';
import { ApiClientManager } from '../../../../src/core/api-manager';
import { CacheEntry, CacheManager } from '../../../../src/core/cache/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import { ParseError } from '../../../../src/core/parse-utils';
import { Title } from '../../../../src/core/title';
import { buildMockAdapter, type MockPlatformAdapter } from '../../../mocks/adapter';
import { buildCacheEntry } from '../../../mocks/cache';
import { buildConfig } from '../../../mocks/config';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

function buildMemoryAdapter(): { adapter: MockPlatformAdapter; store: Map<string, string> } {
    const store = new Map<string, string>();
    const adapter = buildMockAdapter()
        .withStorageGetResolvingTo(vi.fn(async (key: string) => store.get(key)))
        .withStorageSetResolvingTo(
            vi.fn(async (key: string, value: string) => {
                store.set(key, value);
            })
        )
        .withStorageSetManyResolvingTo(
            vi.fn(async (values: Record<string, string>) => {
                for (const [key, value] of Object.entries(values)) store.set(key, value);
            })
        )
        .withStorageDeleteResolvingTo(
            vi.fn(async (key: string) => {
                store.delete(key);
            })
        )
        .withStorageGetKeysResolvingTo(
            vi.fn(async (prefix: string) => [...store.keys()].filter(key => key.startsWith(prefix)))
        )
        .build();
    return { adapter, store };
}

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
        const overrides = new IdOverrideManager(adapter);
        cacheManager = new CacheManager(adapter, config, mockLogger, overrides);
    });

    function buildManager(): {
        adapter: MockPlatformAdapter;
        store: Map<string, string>;
        manager: CacheManager;
        overrides: IdOverrideManager;
    } {
        const { adapter: memoryAdapter, store } = buildMemoryAdapter();
        const overrides = new IdOverrideManager(memoryAdapter);
        return {
            adapter: memoryAdapter,
            store,
            manager: new CacheManager(memoryAdapter, config, mockLogger, overrides),
            overrides,
        };
    }

    describe('read', () => {
        it('treats an entry without title data as a cache miss', async () => {
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
        it('returns an entry with an indefinite expiry', async () => {
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
            expect(result!.getTitle().displayTitle).toBe('Indefinite Title');
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
        it('returns undefined, logs the syntax error, and deletes the entry when JSON parsing fails', async () => {
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
        it('treats a non-string storage value as a corrupt entry', async () => {
            adapter.storageGet.mockResolvedValue(true);

            await expect(cacheManager.read('Some Title')).resolves.toBeUndefined();

            expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
                key: 'fmc:some_title',
                displayTitle: 'Some Title',
                error: expect.objectContaining({ message: 'expected serialized JSON string' }),
            });
            expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:some_title');
        });
        it('propagates errors that are not parse failures', async () => {
            adapter.storageGet.mockResolvedValue('{}');
            vi.spyOn(CacheEntry, 'fromJSON').mockImplementationOnce(() => {
                throw new TypeError('unexpected parser error');
            });

            await expect(cacheManager.read('Some Title')).rejects.toThrow('unexpected parser error');

            expect(adapter.storageDelete).not.toHaveBeenCalled();
        });
        it.each([
            [
                'a wrong-typed field',
                { displayTitle: 'Corrupt Title', data: {}, expires: 'soon' },
                'expected number at "expires"',
            ],
            [
                'a non-object data payload',
                { displayTitle: 'Corrupt Title', data: null },
                'expected an object at "data"',
            ],
        ])(
            'returns undefined, deletes the entry, and logs the parser detail for %s',
            async (_label, entry, message) => {
                adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

                await expect(cacheManager.read('Corrupt Title')).resolves.toBeUndefined();

                expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
                    key: 'fmc:corrupt_title',
                    displayTitle: 'Corrupt Title',
                    error: expect.objectContaining({ message }),
                });
                expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:corrupt_title');
            }
        );
        it.each([
            ['null', 'null'],
            ['an array', '[]'],
            ['a string', '"value"'],
            ['a number', '42'],
        ])('treats %s JSON as a cache miss', async (_label, raw) => {
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
        ])('treats an entry with %s as a cache miss', async (_label, entry) => {
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
        it('returns a title for an entry with empty title data', async () => {
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
        it('treats a legacy nested entry as a cache miss', async () => {
            adapter.storageGet.mockResolvedValue(
                JSON.stringify({
                    data: { displayTitle: 'Legacy Movie', imdbId: 'tt1', rating: 8.1 },
                    expires: null,
                })
            );

            await expect(cacheManager.read('Legacy Movie')).resolves.toBeUndefined();
            expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:legacy_movie');
        });
        it('resolves a miss when deleting a corrupt entry fails', async () => {
            adapter.storageGet.mockResolvedValue('invalid-json{');
            adapter.storageDelete.mockRejectedValue(new Error('delete failed'));

            await expect(cacheManager.read('Some Title')).resolves.toBeUndefined();

            expect(mockLogger.debug).toHaveBeenCalledWith('Failed to delete corrupt cache entry', {
                key: 'fmc:some_title',
                error: expect.any(Error),
            });
        });
        it('returns the cache entry on a hit', async () => {
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
            expect(result!.getTitle().imdbRating).toBe(8.0);
        });
        it('returns a cache entry with a title for valid data', async () => {
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
            expect(result!.getTitle().displayTitle).toBe('Cached Movie');
            expect(result!.imdbId).toBe('tt456');
            expect(result!.isExpired).toBe(false);
        });
        it('marks an entry past its expiry as expired', async () => {
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
            expect(result!.getTitle().displayTitle).toBe('Expired Movie');
        });
        it('returns undefined on a cache miss', async () => {
            adapter.storageGet.mockResolvedValue(undefined);
            const result = await cacheManager.read('Missing Movie');
            expect(result).toBeUndefined();
        });
    });

    describe('write', () => {
        it('writes cache data to storage', async () => {
            adapter.storageGet.mockResolvedValue(undefined);
            const title = buildTitle().withApiTitle('Test Title').build();
            await cacheManager.write('Test Title', title);
            expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.stringContaining('Test Title'));
        });
        it('writes and reads back a cache entry', async () => {
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
        it('stores an indefinite TTL as an undefined expiry', async () => {
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
        it('applies the rated-new-year TTL to a rated title with no year', async () => {
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
        it('applies the rated-old-year TTL to an old rated title', async () => {
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
        it('produces the same cache key for titles that differ only by punctuation', async () => {
            const title = buildTitle().withApiTitle('Test Title').build();
            await cacheManager.write('Test: Title', title);
            const key1 = adapter.storageSet.mock.calls[0]?.[0];
            adapter.storageSet.mockClear();
            await cacheManager.write('Test Title', title);
            const key2 = adapter.storageSet.mock.calls[0]?.[0];
            expect(key1).toBe(key2);
            expect(key1).toBe('fmc:test_title');
        });
        it('stores displayTitle and imdbId at the top level', async () => {
            const title = buildTitle()
                .withDisplayTitle('Test')
                .withApiTitle('Test')
                .withImdbId('tt123')
                .withYear(2024)
                .build();
            adapter.storageSet.mockResolvedValue(undefined);
            await cacheManager.write('Test', title);
            const [call] = adapter.storageSet.mock.calls;
            if (call === undefined) throw new Error('storageSet was not called');
            const [, raw] = call;
            if (typeof raw !== 'string') throw new Error('storageSet payload was not a string');
            const entry = JSON.parse(raw);
            expect(entry.displayTitle).toBe('Test');
            expect(entry.imdbId).toBe('tt123');
            expect(entry.data).not.toHaveProperty('displayTitle');
            expect(entry.data.apiTitle).toBe('Test');
        });
    });

    describe('write queue', () => {
        it('runs a write queued behind a rejected write', async () => {
            const { adapter: memoryAdapter, manager } = buildManager();
            let failFirst: (error: Error) => void = () => undefined;
            const gate = new Promise<void>((_, reject) => {
                failFirst = reject;
            });
            memoryAdapter.storageSet.mockImplementationOnce(async () => {
                await gate;
            });

            const first = manager.write(
                'Queued Movie',
                buildTitle().withDisplayTitle('Queued Movie').withImdbRating(7).build()
            );
            const second = manager.write(
                'Queued Movie',
                buildTitle().withDisplayTitle('Queued Movie').withImdbRating(8).build()
            );
            failFirst(new Error('storage failed'));

            await expect(first).rejects.toThrow('storage failed');
            await expect(second).resolves.toBeUndefined();
            const entry = await manager.read('Queued Movie');
            expect(entry?.getTitle().imdbRating).toBe(8);
        });

        it('keeps a later operation queued after an earlier one settles', async () => {
            const { adapter: memoryAdapter, store, manager } = buildManager();
            let releaseFirst: () => void = () => undefined;
            const firstGate = new Promise<void>(resolve => {
                releaseFirst = resolve;
            });
            let releaseSecond: () => void = () => undefined;
            const secondGate = new Promise<void>(resolve => {
                releaseSecond = resolve;
            });
            let calls = 0;
            memoryAdapter.storageSet.mockImplementation(async (key: string, value: string) => {
                calls += 1;
                if (calls === 1) await firstGate;
                if (calls === 2) await secondGate;
                store.set(key, value);
            });

            const first = manager.write(
                'Chained Movie',
                buildTitle().withDisplayTitle('Chained Movie').withImdbRating(7).build()
            );
            const second = manager.write(
                'Chained Movie',
                buildTitle().withDisplayTitle('Chained Movie').withImdbRating(8).build()
            );
            releaseFirst();
            await first;
            const third = manager.write(
                'Chained Movie',
                buildTitle().withDisplayTitle('Chained Movie').withImdbRating(9).build()
            );
            await new Promise(resolve => setTimeout(resolve, 0));

            // The third write must wait for the gated second write, not start behind a cleared chain.
            expect(calls).toBe(2);

            releaseSecond();
            await Promise.all([second, third]);

            const entry = await manager.read('Chained Movie');
            expect(entry?.getTitle().imdbRating).toBe(9);
        });

        it('keeps the chain usable after a write rejects', async () => {
            const { adapter: memoryAdapter, manager } = buildManager();
            const title = buildTitle().withDisplayTitle('Retry Movie').withImdbRating(7).build();
            memoryAdapter.storageSet.mockRejectedValueOnce(new Error('storage failed'));

            await expect(manager.write('Retry Movie', title)).rejects.toThrow('storage failed');
            await expect(manager.write('Retry Movie', title)).resolves.toBeUndefined();
            await expect(manager.read('Retry Movie')).resolves.toBeDefined();
        });
    });

    describe('write invariants', () => {
        it('does not replace a rated entry with a bare miss', async () => {
            const { manager } = buildManager();
            await manager.write(
                'Keep Movie',
                buildTitle().withDisplayTitle('Keep Movie').withImdbId('tt1').withImdbRating(8).build()
            );

            await manager.write('Keep Movie', Title.notFound('Keep Movie'));

            const entry = await manager.read('Keep Movie');
            expect(entry?.getTitle().imdbRating).toBe(8);
        });

        it('replaces an ID-only entry with a bare miss', async () => {
            const { manager } = buildManager();
            await manager.write('Hint Movie', new Title({ displayTitle: 'Hint Movie', imdbId: 'tt2' }));

            await manager.write('Hint Movie', Title.notFound('Hint Movie'));

            const entry = await manager.read('Hint Movie');
            expect(entry?.imdbId).toBeUndefined();
        });

        it('replaces an expired rated entry with a bare miss', async () => {
            const { store, manager } = buildManager();
            store.set(
                'fmc:expired_movie',
                JSON.stringify(
                    buildCacheEntry()
                        .withDisplayTitle('Expired Movie')
                        .withImdbId('tt3')
                        .withData(buildTitle().withImdbRating(9).build().toCacheJSON())
                        .withExpiry(Date.now() - 1000)
                        .build()
                )
            );

            await manager.write('Expired Movie', Title.notFound('Expired Movie'));

            const entry = await manager.read('Expired Movie');
            expect(entry?.imdbId).toBeUndefined();
        });

        it('replaces a corrupt entry while checking for a downgrade', async () => {
            const { store, manager } = buildManager();
            store.set('fmc:corrupt', '{not json');

            await manager.write('Corrupt', Title.notFound('Corrupt'));

            await expect(manager.read('Corrupt')).resolves.toBeDefined();
            expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
                key: 'fmc:corrupt',
                displayTitle: 'Corrupt',
                error: expect.any(SyntaxError),
            });
        });

        it('skips a result whose IMDb ID differs from the override', async () => {
            const { manager, overrides } = buildManager();
            await overrides.setImdbId('Override Movie', 'tt999');

            await manager.write(
                'Override Movie',
                buildTitle().withDisplayTitle('Override Movie').withImdbId('tt111').withImdbRating(8).build()
            );

            await expect(manager.read('Override Movie')).resolves.toBeUndefined();
        });

        it('writes a result that matches the override', async () => {
            const { manager, overrides } = buildManager();
            await overrides.setImdbId('Override Movie', 'tt999');

            await manager.write(
                'Override Movie',
                buildTitle().withDisplayTitle('Override Movie').withImdbId('tt999').withImdbRating(8).build()
            );

            const entry = await manager.read('Override Movie');
            expect(entry?.getTitle().imdbRating).toBe(8);
        });

        it('skips a bare miss when an override exists', async () => {
            const { manager, overrides } = buildManager();
            await overrides.setImdbId('Override Movie', 'tt999');

            await manager.write('Override Movie', Title.notFound('Override Movie'));

            await expect(manager.read('Override Movie')).resolves.toBeUndefined();
        });
    });

    describe('delete', () => {
        it('deletes a single cache entry', async () => {
            await cacheManager.delete('Some Title');
            expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:some_title');
        });
        it('deletes a missing title without error', async () => {
            const { manager } = buildManager();
            await expect(manager.delete('Missing Movie')).resolves.toBeUndefined();
        });
    });

    describe('clear', () => {
        it('deletes a listed key that disappeared before it could be read', async () => {
            adapter.storageGetKeys.mockResolvedValue(['fmc:key1']);
            adapter.storageGet.mockResolvedValue(undefined);

            await cacheManager.clear();

            expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:key1');
            expect(adapter.storageSetMany).not.toHaveBeenCalled();
        });

        async function writeRatedTitle(manager: CacheManager, displayTitle: string, imdbId: string): Promise<void> {
            await manager.write(
                displayTitle,
                buildTitle()
                    .withDisplayTitle(displayTitle)
                    .withApiTitle(displayTitle)
                    .withImdbId(imdbId)
                    .withImdbRating(8)
                    .withSource('agregarr')
                    .build()
            );
        }

        it('keeps the display title and cached IMDb ID but removes rating data', async () => {
            const { adapter: memoryAdapter, store, manager } = buildManager();
            await writeRatedTitle(manager, 'Kept Movie', 'tt123');
            memoryAdapter.storageSet.mockClear();

            await manager.clear();

            expect(memoryAdapter.storageSet).not.toHaveBeenCalled();
            expect(memoryAdapter.storageSetMany).toHaveBeenCalledOnce();
            expect(memoryAdapter.storageSetMany).toHaveBeenCalledWith({ 'fmc:kept_movie': expect.any(String) });
            expect(store.has('fmc:kept_movie')).toBe(true);
            const entry = JSON.parse(store.get('fmc:kept_movie') as string);
            expect(entry).toMatchObject({ displayTitle: 'Kept Movie', imdbId: 'tt123' });
            expect(entry.data).toEqual({});
            expect(entry.expires).toBeUndefined();

            const retained = await manager.read('Kept Movie');
            expect(retained?.getTitle().hasRating).toBe(false);
            expect(retained?.getTitle().source).toBeUndefined();
        });

        it('removes entries that have no cached IMDb ID', async () => {
            const { store, manager } = buildManager();
            await writeRatedTitle(manager, 'Kept Movie', 'tt123');
            store.set(
                'fmc:no_id_movie',
                JSON.stringify(
                    buildCacheEntry()
                        .withDisplayTitle('No ID Movie')
                        .withImdbId(undefined)
                        .withData(
                            buildTitle()
                                .withDisplayTitle('No ID Movie')
                                .withImdbRating(7)
                                .withSource('agregarr')
                                .build()
                                .toCacheJSON()
                        )
                        .withExpiry(Date.now() + 100000)
                        .build()
                )
            );

            await manager.clear();

            expect(store.has('fmc:kept_movie')).toBe(true);
            expect(store.has('fmc:no_id_movie')).toBe(false);
        });

        it('removes every entry, including cached IMDb IDs, when clearIds is true', async () => {
            const { adapter: memoryAdapter, store, manager } = buildManager();
            await writeRatedTitle(manager, 'Kept Movie', 'tt123');
            await writeRatedTitle(manager, 'Another Movie', 'tt456');
            memoryAdapter.storageSet.mockClear();

            await manager.clear(true);

            expect(store.size).toBe(0);
            expect(memoryAdapter.storageSet).not.toHaveBeenCalled();
            expect(memoryAdapter.storageSetMany).not.toHaveBeenCalled();
        });

        it('removes corrupt entries instead of failing', async () => {
            const { store, manager } = buildManager();
            store.set('fmc:corrupt', 'invalid-json{');

            await manager.clear();

            expect(store.has('fmc:corrupt')).toBe(false);
            expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, removing entry', {
                key: 'fmc:corrupt',
                error: expect.any(SyntaxError),
            });
        });

        it('keeps manual IMDb ID overrides', async () => {
            const { adapter: memoryAdapter, store, manager } = buildManager();
            const overrideManager = new IdOverrideManager(memoryAdapter);
            await overrideManager.setImdbId('Corrected Movie', 'tt999');
            await manager.write(
                'Corrected Movie',
                buildTitle()
                    .withDisplayTitle('Corrected Movie')
                    .withImdbId('tt999')
                    .withImdbRating(8)
                    .withSource('agregarr')
                    .build()
            );

            await manager.clear(true);

            await expect(overrideManager.getImdbId('Corrected Movie')).resolves.toBe('tt999');
            expect(store.size).toBe(1);
        });

        it('fetches fresh data with the retained IMDb ID and does not serve the cleared rating', async () => {
            const { adapter: memoryAdapter, manager } = buildManager();
            await writeRatedTitle(manager, 'Kept Movie', 'tt123');

            await manager.clear();

            const client: ApiClient = {
                source: 'agregarr',
                getStatus: vi.fn().mockResolvedValue({ healthy: true }),
                fetch: vi
                    .fn()
                    .mockResolvedValue(
                        buildTitle()
                            .withDisplayTitle('Kept Movie')
                            .withImdbId('tt123')
                            .withImdbRating(7.5)
                            .withSource('agregarr')
                            .build()
                    ),
                disable: vi.fn(),
            };
            const apiManager = new ApiClientManager(
                mockLogger,
                manager,
                new DisabledClientsManager(memoryAdapter),
                client
            );

            const result = await apiManager.getData('Kept Movie');

            expect(client.fetch).toHaveBeenCalledWith('Kept Movie', 'tt123');
            expect(result.imdbRating).toBe(7.5);
        });

        it('replaces the retained IMDb ID with a cached miss when the ID lookup finds nothing', async () => {
            const { adapter: memoryAdapter, store, manager } = buildManager();
            await writeRatedTitle(manager, 'Missing Movie', 'tt404');

            await manager.clear();

            const client: ApiClient = {
                source: 'agregarr',
                getStatus: vi.fn().mockResolvedValue({ healthy: true }),
                fetch: vi.fn().mockResolvedValue(undefined),
                disable: vi.fn(),
            };
            const apiManager = new ApiClientManager(
                mockLogger,
                manager,
                new DisabledClientsManager(memoryAdapter),
                client
            );

            const first = await apiManager.getData('Missing Movie');
            const second = await apiManager.getData('Missing Movie');

            expect(client.fetch).toHaveBeenCalledOnce();
            expect(client.fetch).toHaveBeenCalledWith('Missing Movie', 'tt404');
            expect(first.hasRating).toBe(false);
            expect(second.hasRating).toBe(false);
            const entry = JSON.parse(store.get('fmc:missing_movie') as string);
            expect(entry.imdbId).toBeUndefined();
            expect(entry.data).toMatchObject({ source: 'agregarr' });
        });
    });
});
