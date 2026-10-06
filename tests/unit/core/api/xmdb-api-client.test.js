/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { XmdbApiClient } from '../../../../src/core/api/index.js';
import { buildMockAdapter } from '../../../mocks/adapter.js';
import { buildConfig } from '../../../mocks/config.js';
import { buildMockDisabledClientsManager } from '../../../mocks/disabled-clients.js';
import { buildMockIdOverrideManager } from '../../../mocks/id-override-manager.js';
import { buildLogger } from '../../../mocks/logger.js';
import { buildTitle } from '../../../mocks/title.js';

const mockOverrideManager = buildMockIdOverrideManager().build();

describe('XmdbApiClient', () => {
    it('should handle search with results', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({
                results: [{ type: 'title', id: 'm1', title: 'Movie 1', year: 2020 }],
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.search('Movie 1');
        expect(result.imdbId).toBe('m1');
        expect(result.apiTitle).toBe('Movie 1');
        expect(result.year).toBe(2020);
        expect(result.imdbRating).toBeNull();
    });

    it('should return null if no search results found', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        expect(await client.search('Movie 1')).toBeNull();
    });

    it('should log info when no search results found', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const mockLogger = buildLogger().build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            mockLogger,
            mockOverrideManager
        );
        await client.search('Movie 1');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
    });

    it('should return null if search results have no titles', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({ results: [{ type: 'person', name: 'Someone' }] })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        expect(await client.search('Movie 1')).toBeNull();
    });

    it('should log info when search results have no titles', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({ results: [{ type: 'person', name: 'Someone' }] })
            .build();
        const mockLogger = buildLogger().build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            mockLogger,
            mockOverrideManager
        );
        await client.search('Movie 1');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Movie 1'));
    });

    it('should handle details with Metacritic rating in ratings array', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'm1' }] })
            .withHttpFetchResolvingToOnce({
                title: 'Movie 1',
                release_year: 2020,
                metascore: 88,
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.fetch('Movie 1');
        expect(result.year).toBe(2020);
        expect(result.mcRating).toBe(88);
    });

    it('should return null if details fetch returns an error', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ error: 'not found' }).build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.getDetails(buildTitle().withImdbId('m1').withDisplayTitle('Movie 1').build());
        expect(result).toBeNull();
    });

    it('should map title_type to TitleType in getDetails', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'tt1' }] })
            .withHttpFetchResolvingToOnce({
                id: 'tt1',
                title: 'Movie 1',
                title_type: 'Movie',
                release_year: 2020,
                rating: 8.0,
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.fetch('Movie 1');
        expect(result.type).toBe('movie');
    });

    it('should map TV Series title_type to series', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'tt2' }] })
            .withHttpFetchResolvingToOnce({
                id: 'tt2',
                title: 'Show 1',
                title_type: 'TV Series',
                release_year: 2020,
                rating: 8.0,
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.fetch('Show 1');
        expect(result.type).toBe('series');
    });

    it('should return null for unknown title_type', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({ results: [{ type: 'title', id: 'tt3' }] })
            .withHttpFetchResolvingToOnce({
                id: 'tt3',
                title: 'Short 1',
                title_type: 'Short Film',
                release_year: 2020,
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.fetch('Short 1');
        expect(result.type).toBeNull();
    });

    it('should log warn when details response has error field', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingToOnce({ error: 'not found' }).build();
        const mockLogger = buildLogger().build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            mockLogger,
            mockOverrideManager
        );
        await client.getDetails(buildTitle().withImdbId('m1').withDisplayTitle('Movie 1').build());
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Movie 1'),
            expect.objectContaining({ response: { error: 'not found' } })
        );
    });

    it('should return null when details response has no title', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingToOnce({
                id: 'tt0000000',
                title: null,
                title_type: null,
                release_year: null,
                rating: null,
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.getDetails(
            buildTitle().withImdbId('tt0000000').withDisplayTitle('nonexistent').build()
        );
        expect(result).toBeNull();
    });

    it('should return unhealthy status when API key is missing', async () => {
        const client = new XmdbApiClient(
            buildMockAdapter().build(),
            buildConfig().withXmdbApiKey('').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
    });

    it('should extract vote_count from XMDB response', async () => {
        const mockAdapter = buildMockAdapter()
            .withHttpFetchResolvingTo({
                id: 'tt1',
                title: 'Test',
                rating: 8.8,
                vote_count: 2500000,
            })
            .build();
        const client = new XmdbApiClient(
            mockAdapter,
            buildConfig().withXmdbApiKey('key').build(),
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());
        expect(result.imdbVotes).toBe(2500000);
    });
});
