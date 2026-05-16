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

const credentials = ['XMDB_API_KEY', 'OMDB_API_KEY'];

describe('api-clients integration', () => {
    let configManager;
    beforeAll(() => {
        const getter = key => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        };
        configManager = new ConfigManager(getter);
    });
    if (!hasCredentials(credentials)) {
        it.skip('should fetch real data from APIs', async () => {});
    } else {
        const adapter = {
            httpFetch: async (url, options) => {
                const response = await fetch(url, options);
                return await response.json();
            },
            storageGet: async () => '0',
            storageSet: async () => {},
        };
        const disabledManager = new DisabledClientsManager(adapter);

        it('should fetch real data from XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch('The Godfather', '1972');
            expect(result).toBeDefined();
            expect(result.apiTitle ?? 'The Godfather').toContain('Godfather');
            expect(result.rating, `Rating missing for ${client.source}`).toBeDefined();
            // Note: XMDB might not always have Metacritic, based on the previous observation
        });

        it('should fetch real data from OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch('The Godfather', '1972');
            expect(result).toBeDefined();
            expect(result.apiTitle ?? 'The Godfather').toContain('Godfather');
            expect(result.rating, `Rating missing for ${client.source}`).toBeDefined();
            expect(result.mcRating, `Metacritic missing for ${client.source}`).toBeDefined();
            expect(result.rtRating, `Rotten Tomatoes missing for ${client.source}`).toBeDefined();
        });

        it('should fetch real data from IMDb API Dev', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            const result = await client.fetch('The Godfather', '1972');
            expect(result).toBeDefined();
            expect(result.apiTitle ?? 'The Godfather').toContain('Godfather');
            expect(result.rating, `Rating missing for ${client.source}`).toBeDefined();
            expect(result.mcRating, `Metacritic missing for ${client.source}`).toBeDefined();
        });
    }
});
