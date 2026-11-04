/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { type ApiClientDeps, XmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import type { PlatformAdapter } from '../../../../src/platform/adapter';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

const mockOverrideManager: IdOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(undefined),
    setImdbId: vi.fn().mockResolvedValue(undefined),
} as unknown as IdOverrideManager;

const mockAdapter: PlatformAdapter = buildMockAdapter().build();
const mockConfig: ConfigManager = {
    get: (_k: string) => 'key',
} as unknown as ConfigManager;
const mockDisabledManager: DisabledClientsManager = {
    isDisabled: vi.fn().mockResolvedValue(false),
    disable: vi.fn().mockResolvedValue(undefined),
    resetAll: vi.fn().mockResolvedValue([]),
} as unknown as DisabledClientsManager;
const mockLogger: Logger = buildLogger().build();

const deps: ApiClientDeps = {
    adapter: mockAdapter,
    config: mockConfig,
    disabledManager: mockDisabledManager,
    logger: mockLogger,
    overrideManager: mockOverrideManager,
};

describe('XmdbApiClient', () => {
    it('should handle search with results', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                results: [{ type: 'title', id: 'm1', name: 'Movie 1', year: 2020 }],
            })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.search('Movie 1');
        expect(result!.imdbId).toBe('m1');
        expect(result!.apiTitle).toBe('Movie 1');
        expect(result!.year).toBe(2020);
        expect(result!.imdbRating).toBeUndefined();
    });

    it('should return undefined if no search results found', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        expect(await client.search('Movie 1')).toBeUndefined();
    });

    it('should log info when no search results found', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const mockLoggerForTest = buildLogger().build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest, logger: mockLoggerForTest });
        await client.search('Movie 1');
        expect(mockLoggerForTest.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
        expect(mockLoggerForTest.warn).not.toHaveBeenCalled();
    });

    it('should return undefined if search results have no titles', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ results: [{ type: 'person', id: 'nm1', name: 'Someone' }] })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        expect(await client.search('Movie 1')).toBeUndefined();
    });

    it('should log info when search results have no titles', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({ results: [{ type: 'person', id: 'nm1', name: 'Someone' }] })
            .build();
        const mockLoggerForTest = buildLogger().build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest, logger: mockLoggerForTest });
        await client.search('Movie 1');
        expect(mockLoggerForTest.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
        expect(mockLoggerForTest.warn).not.toHaveBeenCalled();
    });

    it('should handle details with Metacritic rating in ratings array', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'm1', name: 'Movie 1' }] })
            .withHttpFetchResolvingToOnce({
                id: 'm1',
                title: 'Movie 1',
                release_year: 2020,
                metascore: 88,
            })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.fetch('Movie 1');
        expect(result!.year).toBe(2020);
        expect(result!.mcRating).toBe(88);
    });

    it('should map title_type to TitleType in getDetails', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'tt1', name: 'Movie 1' }] })
            .withHttpFetchResolvingToOnce({
                id: 'tt1',
                title: 'Movie 1',
                title_type: 'Movie',
                release_year: 2020,
                rating: 8.0,
            })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.fetch('Movie 1');
        expect(result!.type).toBe('movie');
    });

    it('should map TV Series title_type to series', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'tt2', name: 'Show 1' }] })
            .withHttpFetchResolvingToOnce({
                id: 'tt2',
                title: 'Show 1',
                title_type: 'TV Series',
                release_year: 2020,
                rating: 8.0,
            })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.fetch('Show 1');
        expect(result!.type).toBe('series');
    });

    it('should return undefined for unknown title_type', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'tt3', name: 'Short 1' }] })
            .withHttpFetchResolvingToOnce({
                id: 'tt3',
                title: 'Short 1',
                title_type: 'Short Film',
                release_year: 2020,
            })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.fetch('Short 1');
        expect(result!.type).toBeUndefined();
    });

    it('should return undefined without a warning when the details response has a null title', async () => {
        const adapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({
                id: 'tt0000000',
                title: null,
                title_type: null,
                release_year: null,
                rating: null,
            })
            .build();
        const logger = buildLogger().build();
        const client = new XmdbApiClient({ ...deps, adapter, logger });
        const result = await client.getDetails(
            buildTitle().withImdbId('tt0000000').withDisplayTitle('nonexistent').build()
        );
        expect(result).toBeUndefined();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return undefined without fetching when the title has no IMDb ID', async () => {
        const adapter = buildMockAdapter().build();
        const client = new XmdbApiClient({ ...deps, adapter });
        const searchTitle = buildTitle().withDisplayTitle('Test').build();

        expect(await client.getDetails(searchTitle)).toBeUndefined();
        expect(adapter.httpFetch).not.toHaveBeenCalled();
    });

    it('should return unhealthy status when API key is missing', async () => {
        const mockConfigForTest: ConfigManager = {
            get: () => '',
        } as unknown as ConfigManager;
        const client = new XmdbApiClient({ ...deps, config: mockConfigForTest });
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
    });

    it('should extract vote_count from XMDB response', async () => {
        const mockAdapterForTest = buildMockAdapter()
            .withHttpFetchResolvingTo({
                id: 'tt1',
                title: 'Test',
                rating: 8.8,
                vote_count: 2500000,
            })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());
        expect(result!.imdbVotes).toBe(2500000);
    });

    it('should use the id from the XMDb details response', async () => {
        const adapter = buildMockAdapter()
            .withHttpFetchResolvingTo({ id: 'tt2', title: 'Movie 1', release_year: 2020 })
            .build();
        const client = new XmdbApiClient({ ...deps, adapter });

        const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

        expect(result!.imdbId).toBe('tt2');
    });

    it('should return undefined without a warning for an error payload', async () => {
        const adapter = buildMockAdapter().withHttpFetchResolvingTo({ error: 'Movie not found' }).build();
        const logger = buildLogger().build();
        const client = new XmdbApiClient({ ...deps, adapter, logger });

        const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

        expect(result).toBeUndefined();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([
        ['a missing title', { id: 'tt1', rating: 8.8 }],
        ['a wrong-typed title', { id: 'tt1', title: 42 }],
        ['an empty title', { id: 'tt1', title: '' }],
        ['a null response', null],
        ['an undefined response', undefined],
    ])('should log a malformed warning when the details response has %s', async (_label, response) => {
        const adapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
        const logger = buildLogger().build();
        const client = new XmdbApiClient({ ...deps, adapter, logger });

        const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

        expect(result).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Malformed XMDb details for "Test"'),
            expect.anything()
        );
    });

    describe('response parsing', () => {
        it.each([
            ['a null body', null],
            ['an empty body', ''],
            ['an array body', []],
        ])('should return undefined when search receives %s', async (_label, response) => {
            const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it.each([
            ['a string results field', { results: 'nope' }],
            ['a result without a type', { results: [{ id: 'm1', name: 'Movie 1' }] }],
            ['a result without an id', { results: [{ type: 'title', name: 'Movie 1' }] }],
            ['a result without a name', { results: [{ type: 'title', id: 'm1' }] }],
            ['a result with an empty type', { results: [{ type: '', id: 'm1', name: 'Movie 1' }] }],
            ['a result with an empty id', { results: [{ type: 'title', id: '', name: 'Movie 1' }] }],
            ['a result with an empty name', { results: [{ type: 'title', id: 'm1', name: '' }] }],
            ['a result with a numeric id', { results: [{ type: 'title', id: 42, name: 'Movie 1' }] }],
            ['a result with a numeric name', { results: [{ type: 'title', id: 'm1', name: 42 }] }],
            ['a result with a string year', { results: [{ type: 'title', id: 'm1', name: 'Movie 1', year: '2020' }] }],
        ])('should return undefined when the search response has %s', async (_label, response) => {
            const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it('should drop invalid search results and keep valid ones', async () => {
            const mockAdapterForTest = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    results: [
                        { type: 'title', id: '', name: 'Empty ID' },
                        { type: 'title', id: 'm2', name: 'Movie 2', year: 2021 },
                    ],
                })
                .build();
            const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            const result = await client.search('Movie 2');

            expect(result!.imdbId).toBe('m2');
            expect(result!.apiTitle).toBe('Movie 2');
            expect(result!.year).toBe(2021);
        });

        it('should keep a valid search result that has no year', async () => {
            const mockAdapterForTest = buildMockAdapter()
                .withHttpFetchResolvingTo({ results: [{ type: 'title', id: 'm1', name: 'Movie 1' }] })
                .build();
            const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            const result = await client.search('Movie 1');

            expect(result!.apiTitle).toBe('Movie 1');
            expect(result!.year).toBeUndefined();
        });

        it('should warn once when every search result is invalid', async () => {
            const response = { results: [{ type: 'title', id: '', name: '' }] };
            const adapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const logger = buildLogger().build();
            const client = new XmdbApiClient({ ...deps, adapter, logger });

            expect(await client.search('Movie 1')).toBeUndefined();
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Malformed XMDb search for "Movie 1"'), {
                response,
                error: 'no valid items in the "results" array',
            });
        });

        it.each([
            ['a null body', null],
            ['an empty body', ''],
            ['a non-string title', { id: 'tt1', title: 42 }],
            ['a non-string id', { id: 42, title: 'Movie 1' }],
            ['a missing id', { title: 'Movie 1' }],
            ['an empty id', { id: '', title: 'Movie 1' }],
            ['an empty title', { id: 'tt1', title: '' }],
            ['a string rating', { id: 'tt1', title: 'Movie 1', rating: '8.8' }],
            ['a string metascore', { id: 'tt1', title: 'Movie 1', metascore: '88' }],
        ])('should fail the details lookup when it receives %s', async (_label, response) => {
            const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

            expect(result).toBeUndefined();
        });

        it('should keep a valid details response that has no rating', async () => {
            const mockAdapterForTest = buildMockAdapter()
                .withHttpFetchResolvingTo({ id: 'tt1', title: 'Movie 1', release_year: 2020 })
                .build();
            const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

            expect(result!.apiTitle).toBe('Movie 1');
            expect(result!.imdbRating).toBeUndefined();
        });
    });
});
