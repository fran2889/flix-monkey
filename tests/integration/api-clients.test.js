/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { hasCredentials } from './setup';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from '../../src/core/api-clients';
import { DisabledClientsManager } from '../../src/core/disabled-clients';
import { ConfigManager } from '../../src/core/config-manager';
import { Title } from '../../src/core/title';
import { createMockAdapter } from '../mocks/adapter.js';
import { ApiSource } from '../../src/core/constants';

const credentials = ['XMDB_API_KEY', 'OMDB_API_KEY'];

const DISPLAY_TITLE = 'The Godfather';

function expectImdbRating(rating, label = 'IMDb rating') {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThan(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(10);
}

function expectPercentageRating(rating, label) {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThanOrEqual(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(100);
}

function expectCommonTitleFields(result, source, displayTitle = DISPLAY_TITLE) {
    expect(result).toBeInstanceOf(Title);
    expect(result.displayTitle).toBe(displayTitle);
    expect(result.apiTitle).toContain('Godfather');
    expect(result.imdbId).toMatch(/^tt\d+$/);
    expect(result.year).toBe(1972);
    expect(result.source).toBe(source);
    expectImdbRating(result.rating);
}

const adapter = {
    httpFetch: async (url, options) => {
        const response = await fetch(url, options);
        return await response.json();
    },
    storageGet: async () => '0',
    storageSet: async () => {},
};
const disabledManager = new DisabledClientsManager(adapter);

describe('api-clients integration', () => {
    let configManager;
    beforeAll(() => {
        const getter = key => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        };
        configManager = new ConfigManager(createMockAdapter({ configGet: getter }));
    });

    it.skipIf(!hasCredentials(credentials))('should fetch real data from XMDB', async () => {
        const client = new XmdbApiClient(disabledManager, adapter, configManager);
        const result = await client.fetch(DISPLAY_TITLE);
        expectCommonTitleFields(result, ApiSource.XMDB);
        expectPercentageRating(result.mcRating, 'XMDB Metacritic');
        expect(result.rtRating).toBeNull();
    });

    it.skipIf(!hasCredentials(credentials))('should fetch real data from OMDB', async () => {
        const client = new OmdbApiClient(disabledManager, adapter, configManager);
        const result = await client.fetch(DISPLAY_TITLE);
        expectCommonTitleFields(result, ApiSource.OMDB);
        expectPercentageRating(result.rtRating, 'OMDB Rotten Tomatoes');
        expectPercentageRating(result.mcRating, 'OMDB Metacritic');
    });

    it.skipIf(!hasCredentials(credentials))('should fetch real data from IMDb API Dev', async () => {
        const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
        const result = await client.fetch(DISPLAY_TITLE);
        expectCommonTitleFields(result, ApiSource.IMDBAPI);
        expectPercentageRating(result.mcRating, 'IMDb API Dev Metacritic');
        expect(result.rtRating).toBeNull();
    });
});
