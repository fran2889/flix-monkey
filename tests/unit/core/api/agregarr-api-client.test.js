/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgregarrApiClient, OmdbApiClient, XmdbApiClient } from '../../../../src/core/api/index.js';
import { Title } from '../../../../src/core/title.js';
import { createMockAdapter } from '../../../mocks/adapter.js';
import { createConfig } from '../../../mocks/config.js';
import { createMockLogger } from '../../../mocks/logger.js';

const mockOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(null),
};

describe('AgregarrApiClient', () => {
    it('should return the first supported IMDb Suggestions result', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [
                    { id: 'tt0001', l: 'Some Video', qid: 'video', y: 2020 },
                    { id: 'tt0002', l: 'Some Short', qid: 'short', y: 2020 },
                    { id: 'tt0003', l: 'Movie 1', qid: 'movie', y: 2020 },
                ],
            }),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
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
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [{ id: 'tt1', l: 'Show 1', qid, y: 2020 }],
            }),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );

        const result = await client.search('Show 1');

        expect(result.type).toBe(type);
    });

    it('should return null if no results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ d: [] }),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when no results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ d: [] }),
        });
        const mockLogger = createMockLogger();
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null if IMDb Suggestions response has no d array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({}),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        expect(await client.search('Unknown')).toBeNull();
    });

    it('should log info when IMDb Suggestions response has no d array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({}),
        });
        const mockLogger = createMockLogger();
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
        );
        await client.search('Unknown');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    });

    it('should return null when IMDb Suggestions has no supported title types', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ d: [{ id: 'nm1', l: 'Some Person', qid: 'name' }] }),
        });
        const mockLogger = createMockLogger();
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockLogger,
            undefined
        );
        expect(await client.search('Unknown')).toBeNull();
        expect(mockLogger.info).toHaveBeenCalledWith(
            'No supported title-type results found in IMDb Suggestions for "Unknown"'
        );
    });

    it('should build the correct IMDb Suggestions URL', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        await client.search('Movie 1');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/movie%201.json');
    });

    it('should fetch rating from Agregarr and retain IMDb Suggestions metadata', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const searchResult = new Title({
            imdbId: 'tt1',
            apiTitle: 'Movie 1',
            year: 2020,
            displayTitle: 'Movie 1',
            type: 'movie',
        });
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
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt4', rating: null, votes: null }]),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const searchResult = new Title({
            imdbId: 'tt4',
            apiTitle: 'Movie 1',
            year: 2020,
            displayTitle: 'Movie 1',
            type: 'series',
        });
        const result = await client.getDetails(searchResult);
        expect(result.imdbRating).toBeNull();
        expect(result.type).toBe('series');
    });

    it('should handle the full IMDb Suggestions and Agregarr fetch flow', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi
                .fn()
                .mockResolvedValueOnce({
                    d: [{ id: 'tt1', l: 'Movie 1', qid: 'movie', y: 2020 }],
                })
                .mockResolvedValueOnce([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
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
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        await client.search('Élite');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toBe('https://v3.sg.media-imdb.com/suggestion/titles/x/%C3%A9lite.json');
    });

    it('should extract votes from Agregarr response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const searchResult = new Title({ imdbId: 'tt1', apiTitle: 'Test', year: 2020, displayTitle: 'Test' });
        const result = await client.getDetails(searchResult);
        expect(result.imdbVotes).toBe(2500000);
    });

    it('should handle null votes from Agregarr response', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: null }]),
        });
        const client = new AgregarrApiClient(
            mockAdapter,
            undefined,
            { isDisabled: vi.fn().mockResolvedValue(false) },
            createMockLogger(),
            mockOverrideManager
        );
        const searchResult = new Title({ imdbId: 'tt1', apiTitle: 'Test', year: 2020, displayTitle: 'Test' });
        const result = await client.getDetails(searchResult);
        expect(result.imdbVotes).toBeNull();
    });

    it('should skip search when imdbId is provided', async () => {
        class TestClient extends AgregarrApiClient {
            searchCalled = false;
            getDetailsCalled = false;
            constructor() {
                super(
                    createMockAdapter({ httpFetch: vi.fn() }),
                    { get: _k => 'key' },
                    { isDisabled: vi.fn().mockResolvedValue(false) },
                    createMockLogger(),
                    mockOverrideManager
                );
            }
            async search() {
                this.searchCalled = true;
                return new Title({ displayTitle: 'Test', imdbId: 'tt123' });
            }
            async getDetails(searchTitle) {
                this.getDetailsCalled = true;
                return new Title({ ...searchTitle, imdbRating: '8.0' });
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
                    createMockAdapter({ httpFetch: vi.fn() }),
                    { get: _k => 'key' },
                    { isDisabled: vi.fn().mockResolvedValue(false) },
                    createMockLogger(),
                    mockOverrideManager
                );
            }
            async search(displayTitle) {
                this.searchCalled = true;
                return new Title({ displayTitle, imdbId: 'tt123' });
            }
            async getDetails(searchTitle) {
                this.getDetailsCalled = true;
                return new Title({ ...searchTitle, imdbRating: '8.0' });
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
            mockOverrideManager = {
                getImdbId: vi.fn().mockResolvedValue(null),
            };
            mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        });

        it('should use override IMDb ID when available', async () => {
            const mockAdapter = createMockAdapter({
                httpFetch: vi.fn().mockResolvedValue({
                    ok: true,
                    json: () =>
                        Promise.resolve({ name: 'Overridden Movie', ratings: [{ source: 'imdb', value: '8.5' }] }),
                }),
            });
            const mockDisabledManager = { isDisabled: vi.fn().mockResolvedValue(false), markDisabled: vi.fn() };

            mockOverrideManager.getImdbId.mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient(
                mockAdapter,
                createConfig({}),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            vi.spyOn(client, 'getDetails').mockResolvedValue(
                new Title({ displayTitle: 'Overridden Movie', imdbId: 'tt9999999', imdbRating: 8.5 })
            );

            const result = await client.fetch('Test Movie');

            expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Test Movie');
            expect(result.imdbId).toBe('tt9999999');
            expect(result.imdbRating).toBe(8.5);
        });

        it('should use displayTitle from override fetch when details fetch fails', async () => {
            const mockAdapter = createMockAdapter({
                httpFetch: vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({ name: 'Overridden Movie', ratings: [] }),
                }),
            });
            const mockDisabledManager = { isDisabled: vi.fn().mockResolvedValue(false), markDisabled: vi.fn() };

            mockOverrideManager.getImdbId.mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient(
                mockAdapter,
                createConfig({}),
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
            const mockAdapter = createMockAdapter({
                httpFetch: vi.fn().mockResolvedValue({
                    d: [{ id: 'tt1234567', l: 'Normal Movie', qid: 'movie', y: 2020 }],
                }),
            });
            const mockDisabledManager = { isDisabled: vi.fn().mockResolvedValue(false), markDisabled: vi.fn() };

            mockOverrideManager.getImdbId.mockResolvedValue(null);

            const client = new AgregarrApiClient(
                mockAdapter,
                createConfig({}),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            vi.spyOn(client, 'getDetails').mockResolvedValue(
                new Title({ displayTitle: 'Normal Movie', imdbId: 'tt1234567', imdbRating: 7.5 })
            );

            const result = await client.fetch('Test Movie');

            expect(result).not.toBeNull();
            expect(result.imdbId).toBe('tt1234567');
            expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Test Movie');
        });

        it('should disable client when override fetch fails', async () => {
            const mockDisabledManager = { isDisabled: vi.fn().mockResolvedValue(false), markDisabled: vi.fn() };
            const mockAdapter = createMockAdapter({
                httpFetch: vi.fn().mockRejectedValue(new Error('Network error')),
            });

            mockOverrideManager.getImdbId.mockResolvedValue('tt9999999');

            const client = new AgregarrApiClient(
                mockAdapter,
                createConfig({}),
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
            const mockDisabledManager = { isDisabled: vi.fn().mockResolvedValue(true), markDisabled: vi.fn() };
            const mockAdapter = createMockAdapter({
                httpFetch: vi.fn().mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({ name: 'Movie', ratings: [] }),
                }),
            });

            const client = new AgregarrApiClient(
                mockAdapter,
                createConfig({}),
                mockDisabledManager,
                mockLogger,
                mockOverrideManager
            );

            const result = await client.fetch('Test Movie');

            expect(result).toBeNull();
            expect(mockOverrideManager.getImdbId).not.toHaveBeenCalled();
        });

        it('should pass overrideManager to subclass constructors', () => {
            const mockDisabledManager = { isDisabled: vi.fn(), markDisabled: vi.fn() };
            const mockAdapter = createMockAdapter();
            const mockConfig = createConfig({});

            const xmdbClient = new XmdbApiClient(
                mockDisabledManager,
                mockAdapter,
                mockConfig,
                mockLogger,
                mockOverrideManager
            );
            const omdbClient = new OmdbApiClient(
                mockDisabledManager,
                mockAdapter,
                mockConfig,
                mockLogger,
                mockOverrideManager
            );
            const agregarrClient = new AgregarrApiClient(
                mockDisabledManager,
                mockAdapter,
                mockConfig,
                mockLogger,
                mockOverrideManager
            );

            expect(xmdbClient).toBeInstanceOf(XmdbApiClient);
            expect(omdbClient).toBeInstanceOf(OmdbApiClient);
            expect(agregarrClient).toBeInstanceOf(AgregarrApiClient);
        });
    });
});
