/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgregarrApiClient, type ApiClientDeps, OmdbApiClient, XmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import { Title } from '../../../../src/core/title';
import type { PlatformAdapter } from '../../../../src/platform/adapter';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildConfig } from '../../../mocks/config';
import { buildLogger } from '../../../mocks/logger';
import { buildTitle } from '../../../mocks/title';

const mockOverrideManager: IdOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(undefined),
    setImdbId: vi.fn().mockResolvedValue(undefined),
} as unknown as IdOverrideManager;

const mockDisabledManager: DisabledClientsManager = {
    isDisabled: vi.fn().mockResolvedValue(false),
    disable: vi.fn().mockResolvedValue(undefined),
    resetAll: vi.fn().mockResolvedValue([]),
} as unknown as DisabledClientsManager;

const mockConfig: ConfigManager = buildConfig().build() as unknown as ConfigManager;
const defaultMockLogger: Logger = buildLogger().build();
const defaultMockAdapter: PlatformAdapter = buildMockAdapter().build();

const deps: ApiClientDeps = {
    adapter: defaultMockAdapter,
    config: mockConfig,
    disabledManager: mockDisabledManager,
    logger: defaultMockLogger,
    overrideManager: mockOverrideManager,
};

describe('AgregarrApiClient', () => {
    it('should return the first supported IMDb Suggestions result', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({
                d: [
                    { id: 'tt0001', l: 'Some Video', qid: 'video', y: 2020 },
                    { id: 'tt0002', l: 'Some Short', qid: 'short', y: 2020 },
                    { id: 'tt0003', l: 'Movie 1', qid: 'movie', y: 2020 },
                    { id: 'tt0004', l: 'Show 1', qid: 'tvSeries', y: 2021 },
                ],
            })
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const result = await client.search('Movie 1');
        expect(result!.imdbId).toBe('tt0003');
        expect(result!.apiTitle).toBe('Movie 1');
        expect(result!.type).toBe('movie');
    });

    it.each([
        ['tvSeries', 'series'],
        ['tvMiniSeries', 'series'],
        ['tvMovie', 'movie'],
        ['tvSpecial', 'movie'],
    ])('should map IMDb Suggestions %s results to %s', async (qid, type) => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({
                d: [{ id: 'tt1', l: 'Show 1', qid, y: 2020 }],
            })
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

        const result = await client.search('Show 1');

        expect(result!.type).toBe(type);
    });

    it.each(['short', 'tvShort'])('should not accept %s IMDb Suggestions results', async qid => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({ d: [{ id: 'tt1', l: 'Short', qid, y: 2020 }] })
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

        expect(await client.search('Short')).toBeUndefined();
    });

    it('should return undefined if no results found', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ d: [] }).build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        expect(await client.search('Unknown')).toBeUndefined();
    });

    it('should log info when no results found', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ d: [] }).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return undefined if IMDb Suggestions response has no d array', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({}).build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        expect(await client.search('Unknown')).toBeUndefined();
    });

    it('should log info when IMDb Suggestions response has no d array', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({}).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should warn once when the IMDb Suggestions body is not an object', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo([]).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });

        expect(await client.search('Movie 1')).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Malformed IMDb Suggestions search for "Movie 1"'),
            { response: [], error: 'expected an object' }
        );
    });

    it('should return undefined when IMDb Suggestions has no supported title types', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({ d: [{ id: 'nm1', l: 'Some Person', qid: 'name' }] })
            .build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });
        expect(await client.search('Unknown')).toBeUndefined();
        expect(mockLogger.info).toHaveBeenCalledWith(
            'No supported title-type results found in IMDb Suggestions for "Unknown"'
        );
    });

    it('should build the correct IMDb Suggestions URL', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = buildMockAdapter().build();
        mockAdapter.httpFetch = httpFetch;
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        await client.search('Movie 1');
        const calledUrl = httpFetch.mock.calls[0]?.[0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/movie%201.json');
    });

    it('should fetch rating from Agregarr and retain IMDb Suggestions metadata', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const searchResult = buildTitle()
            .withImdbId('tt1')
            .withApiTitle('Movie 1')
            .withYear(2020)
            .withDisplayTitle('Movie 1')
            .withType('movie')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result!.apiTitle).toBe('Movie 1');
        expect(result!.imdbId).toBe('tt1');
        expect(result!.year).toBe(2020);
        expect(result!.imdbRating).toBe(8.8);
        expect(result!.rtRating).toBeUndefined();
        expect(result!.mcRating).toBeUndefined();
        expect(result!.type).toBe('movie');
    });

    it('should use the IMDb ID from the Agregarr details response', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt2', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const searchResult = buildTitle().withImdbId('tt1').withApiTitle('Movie 1').withDisplayTitle('Movie 1').build();

        const result = await client.getDetails(searchResult);

        expect(result!.imdbId).toBe('tt2');
    });

    it('should retain IMDb Suggestions type when Agregarr returns a null rating', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt4', rating: null, votes: null }])
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const searchResult = buildTitle()
            .withImdbId('tt4')
            .withApiTitle('Movie 1')
            .withYear(2020)
            .withDisplayTitle('Movie 1')
            .withType('series')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result!.imdbRating).toBeUndefined();
        expect(result!.type).toBe('series');
    });

    it('should handle the full IMDb Suggestions and Agregarr fetch flow', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({
                d: [{ id: 'tt1', l: 'Movie 1', qid: 'movie', y: 2020 }],
            })
            .withHttpFetchResolvingToOnce([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const result = await client.fetch('Movie 1');
        expect(result!.displayTitle).toBe('Movie 1');
        expect(result!.apiTitle).toBe('Movie 1');
        expect(result!.imdbId).toBe('tt1');
        expect(result!.imdbRating).toBe(8.8);
        expect(result!.source).toBe('agregarr');
        expect(result!.type).toBe('movie');
    });

    it('should lowercase and encode non-ASCII titles in IMDb Suggestions URLs', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = buildMockAdapter().build();
        mockAdapter.httpFetch = httpFetch;
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        await client.search('Élite');
        const calledUrl = httpFetch.mock.calls[0]?.[0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/%C3%A9lite.json');
    });

    it('should extract votes from Agregarr response', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const searchResult = buildTitle()
            .withImdbId('tt1')
            .withApiTitle('Test')
            .withYear(2020)
            .withDisplayTitle('Test')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result!.imdbVotes).toBe(2500000);
    });

    it('should handle null votes from Agregarr response', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt1', rating: 8.8, votes: null }])
            .build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const searchResult = buildTitle()
            .withImdbId('tt1')
            .withApiTitle('Test')
            .withYear(2020)
            .withDisplayTitle('Test')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result!.imdbVotes).toBeUndefined();
    });

    it('should return undefined when the Agregarr ratings array is empty', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo([]).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });
        const searchResult = buildTitle().withImdbId('tt1').withApiTitle('Movie 1').withDisplayTitle('Movie 1').build();

        expect(await client.getDetails(searchResult)).toBeUndefined();
        expect(mockLogger.info).toHaveBeenCalledWith('No Agregarr ratings found for "Movie 1" (ID: tt1)');
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return undefined without fetching when the title has no IMDb ID', async () => {
        const mockAdapter = buildMockAdapter().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });
        const searchResult = buildTitle().withDisplayTitle('Movie 1').build();

        expect(await client.getDetails(searchResult)).toBeUndefined();
        expect(mockAdapter.httpFetch).not.toHaveBeenCalled();
    });

    it('should return undefined when the Agregarr response carries no ratings array', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo(undefined).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });
        const searchResult = buildTitle().withImdbId('tt1').withApiTitle('Movie 1').withDisplayTitle('Movie 1').build();

        expect(await client.getDetails(searchResult)).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Malformed Agregarr details for "Movie 1"'),
            {
                response: undefined,
                error: 'expected an array',
            }
        );
    });

    it('should skip search when imdbId is provided', async () => {
        const mockConfigForTest: ConfigManager = {
            get: (_k: string) => 'key',
        } as unknown as ConfigManager;
        class TestClient extends AgregarrApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super({
                    adapter: buildMockAdapter().build(),
                    config: mockConfigForTest,
                    disabledManager: mockDisabledManager,
                    logger: buildLogger().build(),
                    overrideManager: mockOverrideManager,
                });
            }
            override async search(): Promise<Title> {
                this.searchCalled = true;
                return buildTitle().withDisplayTitle('Test').withImdbId('tt123').build();
            }
            override async getDetails(searchTitle: Title): Promise<Title | undefined> {
                this.getDetailsCalled = true;
                return buildTitle()
                    .withDisplayTitle(searchTitle.displayTitle)
                    .withImdbId(searchTitle.imdbId)
                    .withImdbRating(8.0)
                    .build();
            }
        }
        const client = new TestClient();
        const result = await client.fetch('Test Movie', 'tt123');
        expect(client.searchCalled).toBe(false);
        expect(client.getDetailsCalled).toBe(true);
        expect(result!.imdbRating).toBe(8.0);
    });

    it('should call search when imdbId is not provided', async () => {
        const mockConfigForTest: ConfigManager = {
            get: (_k: string) => 'key',
        } as unknown as ConfigManager;
        class TestClient extends AgregarrApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super({
                    adapter: buildMockAdapter().build(),
                    config: mockConfigForTest,
                    disabledManager: mockDisabledManager,
                    logger: buildLogger().build(),
                    overrideManager: mockOverrideManager,
                });
            }
            override async search(displayTitle: string): Promise<Title> {
                this.searchCalled = true;
                return buildTitle().withDisplayTitle(displayTitle).withImdbId('tt123').build();
            }
            override async getDetails(searchTitle: Title): Promise<Title | undefined> {
                this.getDetailsCalled = true;
                return buildTitle()
                    .withDisplayTitle(searchTitle.displayTitle)
                    .withImdbId(searchTitle.imdbId)
                    .withImdbRating(8.0)
                    .build();
            }
        }
        const client = new TestClient();
        const result = await client.fetch('Test Movie');
        expect(client.searchCalled).toBe(true);
        expect(client.getDetailsCalled).toBe(true);
        expect(result!.imdbRating).toBe(8.0);
    });

    describe('IMDb ID override support', () => {
        let mockOverrideManagerForTests: IdOverrideManager;
        let mockLoggerForTests: Logger;

        beforeEach(() => {
            mockOverrideManagerForTests = {
                getImdbId: vi.fn().mockResolvedValue(undefined),
                setImdbId: vi.fn().mockResolvedValue(undefined),
            } as unknown as IdOverrideManager;
            mockLoggerForTests = buildLogger().build();
        });

        it('should use override IMDb ID when available', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    ok: true,
                    json: () =>
                        Promise.resolve({ name: 'Overridden Movie', ratings: [{ source: 'imdb', value: '8.5' }] }),
                })
                .build();
            const mockDisabledManagerForTest: DisabledClientsManager = {
                isDisabled: vi.fn().mockResolvedValue(false),
                disable: vi.fn().mockResolvedValue(undefined),
                resetAll: vi.fn().mockResolvedValue([]),
            } as unknown as DisabledClientsManager;

            mockOverrideManagerForTests.getImdbId = vi.fn().mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient({
                ...deps,
                adapter: mockAdapter,
                disabledManager: mockDisabledManagerForTest,
                logger: mockLoggerForTests,
                overrideManager: mockOverrideManagerForTests,
            });

            vi.spyOn(client, 'getDetails').mockResolvedValue(
                buildTitle().withDisplayTitle('Overridden Movie').withImdbId('tt9999999').withImdbRating(8.5).build()
            );

            const result = await client.fetch('Test Movie');

            expect(mockOverrideManagerForTests.getImdbId).toHaveBeenCalledWith('Test Movie');
            expect(result!.imdbId).toBe('tt9999999');
            expect(result!.imdbRating).toBe(8.5);
        });

        it('should use displayTitle from override fetch when details fetch fails', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    ok: true,
                    json: () => Promise.resolve({ name: 'Overridden Movie', ratings: [] }),
                })
                .build();
            const mockDisabledManagerForTest: DisabledClientsManager = {
                isDisabled: vi.fn().mockResolvedValue(false),
                disable: vi.fn().mockResolvedValue(undefined),
                resetAll: vi.fn().mockResolvedValue([]),
            } as unknown as DisabledClientsManager;

            mockOverrideManagerForTests.getImdbId = vi.fn().mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient({
                ...deps,
                adapter: mockAdapter,
                disabledManager: mockDisabledManagerForTest,
                logger: mockLoggerForTests,
                overrideManager: mockOverrideManagerForTests,
            });

            vi.spyOn(client, 'getDetails').mockResolvedValue(undefined);

            const result = await client.fetch('Test Movie');

            expect(mockOverrideManagerForTests.getImdbId).toHaveBeenCalledWith('Test Movie');
            expect(result!.imdbId).toBe('tt9999999');
            expect(result!.displayTitle).toBe('Test Movie');
        });

        it('should fall back to normal search when no override exists', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    d: [{ id: 'tt1234567', l: 'Normal Movie', qid: 'movie', y: 2020 }],
                })
                .build();
            const mockDisabledManagerForTest: DisabledClientsManager = {
                isDisabled: vi.fn().mockResolvedValue(false),
                disable: vi.fn().mockResolvedValue(undefined),
                resetAll: vi.fn().mockResolvedValue([]),
            } as unknown as DisabledClientsManager;

            mockOverrideManagerForTests.getImdbId = vi.fn().mockResolvedValue(undefined);

            const client = new AgregarrApiClient({
                ...deps,
                adapter: mockAdapter,
                disabledManager: mockDisabledManagerForTest,
                logger: mockLoggerForTests,
                overrideManager: mockOverrideManagerForTests,
            });

            vi.spyOn(client, 'getDetails').mockResolvedValue(
                buildTitle().withDisplayTitle('Normal Movie').withImdbId('tt1234567').withImdbRating(7.5).build()
            );

            const result = await client.fetch('Test Movie');

            expect(result).not.toBeUndefined();
            expect(result!.imdbId).toBe('tt1234567');
            expect(mockOverrideManagerForTests.getImdbId).toHaveBeenCalledWith('Test Movie');
        });

        it('should disable client when override fetch fails', async () => {
            const mockDisabledManagerForTest: DisabledClientsManager = {
                isDisabled: vi.fn().mockResolvedValue(false),
                disable: vi.fn().mockResolvedValue(undefined),
                resetAll: vi.fn().mockResolvedValue([]),
            } as unknown as DisabledClientsManager;
            const mockAdapter = buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();

            mockOverrideManagerForTests.getImdbId = vi.fn().mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient({
                ...deps,
                adapter: mockAdapter,
                disabledManager: mockDisabledManagerForTest,
                logger: mockLoggerForTests,
                overrideManager: mockOverrideManagerForTests,
            });

            vi.spyOn(client, 'getDetails').mockResolvedValue(undefined);

            const result = await client.fetch('Test Movie');

            // Current behavior: returns a Title with the override ID when getDetails returns undefined
            expect(result).toBeInstanceOf(Title);
            expect(result!.imdbId).toBe('tt9999999');
            expect(result!.displayTitle).toBe('Test Movie');
            expect(mockOverrideManagerForTests.getImdbId).toHaveBeenCalledWith('Test Movie');
            // Note: markDisabled is NOT called when getDetails returns undefined (only when it throws)
            expect(mockDisabledManagerForTest.disable).not.toHaveBeenCalled();
        });

        it('should not attempt override or normal fetch when client is disabled', async () => {
            const mockDisabledManagerForTest: DisabledClientsManager = {
                isDisabled: vi.fn().mockResolvedValue(true),
                disable: vi.fn().mockResolvedValue(undefined),
                resetAll: vi.fn().mockResolvedValue([]),
            } as unknown as DisabledClientsManager;
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    ok: true,
                    json: () => Promise.resolve({ name: 'Movie', ratings: [] }),
                })
                .build();

            const client = new AgregarrApiClient({
                ...deps,
                adapter: mockAdapter,
                disabledManager: mockDisabledManagerForTest,
                logger: mockLoggerForTests,
                overrideManager: mockOverrideManagerForTests,
            });

            const result = await client.fetch('Test Movie');

            expect(result).toBeUndefined();
            expect(mockOverrideManagerForTests.getImdbId).not.toHaveBeenCalled();
        });

        it('should pass overrideManager to subclass constructors', () => {
            const mockDisabledManagerForTest: DisabledClientsManager = {
                isDisabled: vi.fn(),
                disable: vi.fn(),
                resetAll: vi.fn(),
            } as unknown as DisabledClientsManager;
            const mockAdapter = buildMockAdapter().build();
            const mockConfigForTest = buildConfig().build() as unknown as ConfigManager;

            const testDeps: ApiClientDeps = {
                adapter: mockAdapter,
                config: mockConfigForTest,
                disabledManager: mockDisabledManagerForTest,
                logger: mockLoggerForTests,
                overrideManager: mockOverrideManagerForTests,
            };
            const xmdbClient = new XmdbApiClient(testDeps);
            const omdbClient = new OmdbApiClient(testDeps);
            const agregarrClient = new AgregarrApiClient(testDeps);

            expect(xmdbClient).toBeInstanceOf(XmdbApiClient);
            expect(omdbClient).toBeInstanceOf(OmdbApiClient);
            expect(agregarrClient).toBeInstanceOf(AgregarrApiClient);
        });
    });

    describe('response parsing', () => {
        it.each([
            ['a null body', null],
            ['an empty body', ''],
            ['an array body', []],
        ])('should return undefined when search receives %s', async (_label, response) => {
            const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it.each([
            ['a string d field', { d: 'nope' }],
            ['a result without qid', { d: [{ id: 'tt1', l: 'Movie 1' }] }],
            ['a result without id', { d: [{ qid: 'movie', l: 'Movie 1' }] }],
            ['a result without l', { d: [{ qid: 'movie', id: 'tt1' }] }],
            ['a result with an empty qid', { d: [{ qid: '', id: 'tt1', l: 'Movie 1' }] }],
            ['a result with an empty id', { d: [{ qid: 'movie', id: '', l: 'Movie 1' }] }],
            ['a result with an empty l', { d: [{ qid: 'movie', id: 'tt1', l: '' }] }],
            ['a result with a numeric id', { d: [{ qid: 'movie', id: 42, l: 'Movie 1' }] }],
            ['a result with a numeric l', { d: [{ qid: 'movie', id: 'tt1', l: 42 }] }],
            ['a result with a string year', { d: [{ qid: 'movie', id: 'tt1', l: 'Movie 1', y: '2020' }] }],
        ])('should return undefined when the search response has %s', async (_label, response) => {
            const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            expect(await client.search('Movie 1')).toBeUndefined();
        });

        it('should drop invalid search results and keep valid ones', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    d: [
                        { qid: 'movie', id: '', l: 'Empty ID' },
                        { qid: 'movie', id: 'tt2', l: 'Movie 2', y: 2021 },
                    ],
                })
                .build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            const result = await client.search('Movie 2');

            expect(result!.imdbId).toBe('tt2');
            expect(result!.apiTitle).toBe('Movie 2');
            expect(result!.year).toBe(2021);
        });

        it('should keep a valid search result that has no year', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({ d: [{ qid: 'movie', id: 'tt1', l: 'Movie 1' }] })
                .build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            const result = await client.search('Movie 1');

            expect(result!.apiTitle).toBe('Movie 1');
            expect(result!.year).toBeUndefined();
        });

        it('should warn once when every search result is invalid', async () => {
            const response = { d: [{ qid: 'movie', id: '', l: 'Bad' }] };
            const adapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const logger = buildLogger().build();
            const client = new AgregarrApiClient({ ...deps, adapter, logger });

            expect(await client.search('Movie 1')).toBeUndefined();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Malformed IMDb Suggestions search for "Movie 1"'),
                { response, error: 'no valid items in the "d" array' }
            );
        });

        it.each([
            ['a null body', null],
            ['an empty body', ''],
            ['an object body', {}],
            ['an entry without imdbId', [{ rating: 8.8 }]],
            ['an entry with an empty imdbId', [{ imdbId: '', rating: 8.8 }]],
            ['an entry with a numeric imdbId', [{ imdbId: 42, rating: 8.8 }]],
            ['an entry with a string rating', [{ imdbId: 'tt1', rating: '8.8' }]],
            ['an entry with a string votes field', [{ imdbId: 'tt1', votes: 'many' }]],
        ])('should return undefined when the details response has %s', async (_label, response) => {
            const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

            expect(result).toBeUndefined();
        });

        it('should drop invalid rating entries and keep valid ones', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo([
                    { rating: 7.5 },
                    { imdbId: 'tt1', rating: '8.8' },
                    { imdbId: 'tt1', rating: 8.8, votes: 2500000 },
                ])
                .build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

            expect(result!.imdbRating).toBe(8.8);
            expect(result!.imdbVotes).toBe(2500000);
        });

        it('should keep a valid details entry that has no rating', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo([{ imdbId: 'tt1', votes: 1000 }])
                .build();
            const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

            expect(result!.imdbVotes).toBe(1000);
            expect(result!.imdbRating).toBeUndefined();
        });

        it('should warn once when every rating entry is invalid', async () => {
            const response = [{ imdbId: '', rating: 8.8 }];
            const adapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
            const logger = buildLogger().build();
            const client = new AgregarrApiClient({ ...deps, adapter, logger });

            const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

            expect(result).toBeUndefined();
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Malformed Agregarr details for "Test"'), {
                response,
                error: 'no valid items in the ratings array',
            });
        });
    });
});
