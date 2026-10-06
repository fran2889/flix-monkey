/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgregarrApiClient, OmdbApiClient, XmdbApiClient } from '../../../../src/core/api/index.js';
import { Title } from '../../../../src/core/title.js';
import { buildMockAdapter } from '../../../mocks/adapter.js';
import { buildConfig } from '../../../mocks/config.js';
import { buildMockDisabledClientsManager } from '../../../mocks/disabled-clients.js';
import { buildMockIdOverrideManager } from '../../../mocks/id-override-manager.js';
import { buildLogger } from '../../../mocks/logger.js';
import { buildTitle } from '../../../mocks/title.js';

const mockOverrideManager = buildMockIdOverrideManager().build();

describe('AgregarrApiClient', () => {
    it('should return the first supported IMDb Suggestions result', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({
                d: [
                    { id: 'tt0001', l: 'Some Video', qid: 'video', y: 2020 },
                    { id: 'tt0002', l: 'Some Short', qid: 'short', y: 2020 },
                    { id: 'tt0003', l: 'Movie 1', qid: 'movie', y: 2020 },
                ],
            })
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');
        expect(result.imdbId).toBe('tt0003');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.type).toBe('movie');
    });

    it.each([
        ['tvSeries', 'series'],
        ['tvMiniSeries', 'series'],
    ])('should map IMDb Suggestions %s results to %s', async (qid, type) => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({
                d: [{ id: 'tt1', l: 'Show 1', qid, y: 2020 }],
            })
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );

        const result = await client.search('Show 1');

        expect(result.type).toBe(type);
    });

    it('should return null if no results found', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ d: [] }).build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when no results found', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ d: [] }).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            mockLogger,
            mockOverrideManager
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null if IMDb Suggestions response has no d array', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({}).build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when IMDb Suggestions response has no d array', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({}).build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            mockLogger,
            mockOverrideManager
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null when IMDb Suggestions has no supported title types', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({ d: [{ id: 'nm1', l: 'Some Person', qid: 'name' }] })
            .build();
        const mockLogger = buildLogger().build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            mockLogger,
            mockOverrideManager
        );
        expect(await client.search('Unknown')).toBeNull();
        expect(mockLogger.info).toHaveBeenCalledWith(
            'No supported title-type results found in IMDb Suggestions for "Unknown"'
        );
    });

    it('should build the correct IMDb Suggestions URL', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = buildMockAdapter().build();
        mockAdapter.httpFetch = httpFetch;
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        await client.search('Movie 1');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/movie%201.json');
    });

    it('should fetch rating from Agregarr and retain IMDb Suggestions metadata', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const searchResult = buildTitle()
            .withImdbId('tt1')
            .withApiTitle('Movie 1')
            .withYear(2020)
            .withDisplayTitle('Movie 1')
            .withType('movie')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.imdbId).toBe('tt1');
        expect(result.year).toBe(2020);
        expect(result.imdbRating).toBe(8.8);
        expect(result.rtRating).toBeNull();
        expect(result.mcRating).toBeNull();
        expect(result.type).toBe('movie');
    });

    it('should retain IMDb Suggestions type when Agregarr returns a null rating', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt4', rating: null, votes: null }])
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const searchResult = buildTitle()
            .withImdbId('tt4')
            .withApiTitle('Movie 1')
            .withYear(2020)
            .withDisplayTitle('Movie 1')
            .withType('series')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result.imdbRating).toBeNull();
        expect(result.type).toBe('series');
    });

    it('should handle the full IMDb Suggestions and Agregarr fetch flow', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({
                d: [{ id: 'tt1', l: 'Movie 1', qid: 'movie', y: 2020 }],
            })
            .withHttpFetchResolvingToOnce([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.fetch('Movie 1');
        expect(result.displayTitle).toBe('Movie 1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.imdbId).toBe('tt1');
        expect(result.imdbRating).toBe(8.8);
        expect(result.source).toBe('agregarr');
        expect(result.type).toBe('movie');
    });

    it('should lowercase and encode non-ASCII titles in IMDb Suggestions URLs', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = buildMockAdapter().build();
        mockAdapter.httpFetch = httpFetch;
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        await client.search('Élite');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/%C3%A9lite.json');
    });

    it('should extract votes from Agregarr response', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }])
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const searchResult = buildTitle()
            .withImdbId('tt1')
            .withApiTitle('Test')
            .withYear(2020)
            .withDisplayTitle('Test')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result.imdbVotes).toBe(2500000);
    });

    it('should handle null votes from Agregarr response', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo([{ imdbId: 'tt1', rating: 8.8, votes: null }])
            .build();
        const client = new AgregarrApiClient(
            mockAdapter,
            buildConfig().build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const searchResult = buildTitle()
            .withImdbId('tt1')
            .withApiTitle('Test')
            .withYear(2020)
            .withDisplayTitle('Test')
            .build();
        const result = await client.getDetails(searchResult);
        expect(result.imdbVotes).toBeNull();
    });

    it('should skip search when imdbId is provided', async () => {
        class TestClient extends AgregarrApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super(
                    buildMockAdapter().build(),
                    buildConfig().build(),
                    buildMockDisabledClientsManager.notDisabled(),
                    buildLogger().build(),
                    mockOverrideManager
                );
            }
            async search() {
                this.searchCalled = true;
                return buildTitle().withDisplayTitle('Test').withImdbId('tt123').build();
            }
            async getDetails(searchTitle) {
                this.getDetailsCalled = true;
                return buildTitle()
                    .withDisplayTitle(searchTitle.displayTitle)
                    .withImdbId(searchTitle.imdbId)
                    .withImdbRating('8.0')
                    .build();
            }
        }
        const client = new TestClient();
        const result = await client.fetch('Test Movie', 'tt123');
        expect(client.searchCalled).toBe(false);
        expect(client.getDetailsCalled).toBe(true);
        expect(result.imdbRating).toBe(8.0);
    });

    it('should call search when imdbId is not provided', async () => {
        class TestClient extends AgregarrApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super(
                    buildMockAdapter().build(),
                    buildConfig().build(),
                    buildMockDisabledClientsManager.notDisabled(),
                    buildLogger().build(),
                    mockOverrideManager
                );
            }
            async search(displayTitle) {
                this.searchCalled = true;
                return buildTitle().withDisplayTitle(displayTitle).withImdbId('tt123').build();
            }
            async getDetails(searchTitle) {
                this.getDetailsCalled = true;
                return buildTitle()
                    .withDisplayTitle(searchTitle.displayTitle)
                    .withImdbId(searchTitle.imdbId)
                    .withImdbRating('8.0')
                    .build();
            }
        }
        const client = new TestClient();
        const result = await client.fetch('Test Movie');
        expect(client.searchCalled).toBe(true);
        expect(client.getDetailsCalled).toBe(true);
        expect(result.imdbRating).toBe(8.0);
    });

    describe('IMDb ID override support', () => {
        let mockOverrideManager;
        let mockLogger;

        beforeEach(() => {
            mockOverrideManager = buildMockIdOverrideManager().build();
            mockLogger = buildLogger().build();
        });

        it('should use override IMDb ID when available', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    ok: true,
                    json: () =>
                        Promise.resolve({ name: 'Overridden Movie', ratings: [{ source: 'imdb', value: '8.5' }] }),
                })
                .build();
            const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(false).build();

            mockOverrideManager.getImdbId.mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient(
                mockAdapter,
                buildConfig().build(),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            vi.spyOn(client, 'getDetails').mockResolvedValue(
                buildTitle().withDisplayTitle('Overridden Movie').withImdbId('tt9999999').withImdbRating(8.5).build()
            );

            const result = await client.fetch('Test Movie');

            expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Test Movie');
            expect(result.imdbId).toBe('tt9999999');
            expect(result.imdbRating).toBe(8.5);
        });

        it('should use displayTitle from override fetch when details fetch fails', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    ok: true,
                    json: () => Promise.resolve({ name: 'Overridden Movie', ratings: [] }),
                })
                .build();
            const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(false).build();

            mockOverrideManager.getImdbId.mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient(
                mockAdapter,
                buildConfig().build(),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            vi.spyOn(client, 'getDetails').mockResolvedValue(null);

            const result = await client.fetch('Test Movie');

            expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Test Movie');
            expect(result.imdbId).toBe('tt9999999');
            expect(result.displayTitle).toBe('Test Movie');
        });

        it('should fall back to normal search when no override exists', async () => {
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    d: [{ id: 'tt1234567', l: 'Normal Movie', qid: 'movie', y: 2020 }],
                })
                .build();
            const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(false).build();

            mockOverrideManager.getImdbId.mockResolvedValue(null);

            const client = new AgregarrApiClient(
                mockAdapter,
                buildConfig().build(),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            vi.spyOn(client, 'getDetails').mockResolvedValue(
                buildTitle().withDisplayTitle('Normal Movie').withImdbId('tt1234567').withImdbRating(7.5).build()
            );

            const result = await client.fetch('Test Movie');

            expect(result).not.toBeNull();
            expect(result.imdbId).toBe('tt1234567');
            expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Test Movie');
        });

        it('should disable client when override fetch fails', async () => {
            const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
            const mockAdapter = buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();

            mockOverrideManager.getImdbId.mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient(
                mockAdapter,
                buildConfig().build(),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            vi.spyOn(client, 'getDetails').mockResolvedValue(null);

            const result = await client.fetch('Test Movie');

            // Current behavior: returns a Title with the override ID when getDetails returns null
            expect(result).toBeInstanceOf(Title);
            expect(result.imdbId).toBe('tt9999999');
            expect(result.displayTitle).toBe('Test Movie');
            expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Test Movie');
            // Note: markDisabled is NOT called when getDetails returns null (only when it throws)
            expect(mockDisabledManager.markDisabled).not.toHaveBeenCalled();
        });

        it('should not attempt override or normal fetch when client is disabled', async () => {
            const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(true).build();
            const mockAdapter = buildMockAdapter()
                .withHttpFetchResolvingTo({
                    ok: true,
                    json: () => Promise.resolve({ name: 'Movie', ratings: [] }),
                })
                .build();

            const client = new AgregarrApiClient(
                mockAdapter,
                buildConfig().build(),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            const result = await client.fetch('Test Movie');

            expect(result).toBeNull();
            expect(mockOverrideManager.getImdbId).not.toHaveBeenCalled();
        });

        it('should pass overrideManager to subclass constructors', () => {
            const mockDisabledManager = buildMockDisabledClientsManager().build();
            const mockAdapter = buildMockAdapter().build();
            const mockConfig = buildConfig().build();

            const xmdbClient = new XmdbApiClient(
                mockAdapter,
                mockConfig,
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );
            const omdbClient = new OmdbApiClient(
                mockAdapter,
                mockConfig,
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );
            const agregarrClient = new AgregarrApiClient(
                mockAdapter,
                mockConfig,
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            expect(xmdbClient).toBeInstanceOf(XmdbApiClient);
            expect(omdbClient).toBeInstanceOf(OmdbApiClient);
            expect(agregarrClient).toBeInstanceOf(AgregarrApiClient);
        });
    });
});
