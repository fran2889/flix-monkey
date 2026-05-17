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
import { describe, it, expect, vi } from 'vitest';
import { ApiClientManager } from '../../../src/core/api-manager.js';
import { Title } from '../../../src/core/title.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { ImdbApiDevClient } from '../../../src/core/api-clients.js';

describe('ApiClientManager', () => {
    const mockConfig = new ConfigManager();

    it('should return cached data if available', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, null);
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalled();
    });

    it('should only initialize the single selected client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const config = { get: _key => 'imdbapi' };
        const manager = new ApiClientManager(mockCache, {}, {}, config, null);
        const client = manager.getClient();
        expect(client instanceof ImdbApiDevClient).toBe(true);
    });

    it('should fetch and return result from client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, mockClient);
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Fetched Movie');
    });

    it('should handle fail if client returns null', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, client);

        const result = await manager.getData('Some Title');
        expect(result).toBeNull();
        expect(client.fetch).toHaveBeenCalled();
    });

    it('should cache "Not Found" result if client fails', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, client);

        const result = await manager.getData('Unknown Movie');
        expect(result).toBeNull();
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            expect.objectContaining({
                apiTitle: null,
                rating: null,
            })
        );
    });

    it('should skip unhealthy client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const unhealthyClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, unhealthyClient);

        const result = await manager.getData('Test Movie');
        expect(result).toBeNull();
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
    });

    it('should reset all disabled clients and return the list of re-enabled ones', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue(['xmdb', 'omdb']) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, mockConfig, {});
        const reenabled = await manager.resetDisabledClients();
        expect(mockDisabledManager.resetAll).toHaveBeenCalled();
        expect(reenabled).toEqual(['xmdb', 'omdb']);
    });

    it('should clear the cache', async () => {
        const mockCache = { clear: vi.fn().mockResolvedValue() };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, {});
        await manager.clearCache();
        expect(mockCache.clear).toHaveBeenCalled();
    });

    it('should log on successful data retrieval', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Logged Movie' })),
            source: 'test-source',
        };
        const title = new Title({ apiTitle: 'Logged Movie' });
        title.source = 'test-source';
        mockClient.fetch.mockResolvedValue(title);

        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, mockClient);

        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        await manager.getData('Logged Movie');

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[FlixMonkey] Successfully retrieved ratings for "Logged Movie" from test-source.')
        );
        consoleSpy.mockRestore();
    });
});
