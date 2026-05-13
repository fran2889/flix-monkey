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

describe('ApiClientManager', () => {
    const mockConfig = new ConfigManager();

    it('should return cached data if available', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, []);
        const result = await manager.getData('Some Title', '2023');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalled();
    });

    it('should iterate through clients and return the first result', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, [mockClient]);
        const result = await manager.getData('Some Title', '2023');
        expect(result.apiTitle).toBe('Fetched Movie');
    });

    it('should fail over to next client if first returns null', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client1 = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const client2 = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Backup Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, [client1, client2]);

        const result = await manager.getData('Some Title', '2023');
        expect(result.apiTitle).toBe('Backup Movie');
        expect(client1.fetch).toHaveBeenCalled();
        expect(client2.fetch).toHaveBeenCalled();
    });

    it('should cache "Not Found" result if all clients fail', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client1 = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, [client1]);

        const result = await manager.getData('Unknown Movie', '2023');
        expect(result).toBeNull();
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            '2023',
            expect.objectContaining({
                apiTitle: null,
                rating: null,
            })
        );
    });

    it('should skip unhealthy clients', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const unhealthyClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
        };
        const healthyClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Healthy Result' })),
        };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, [unhealthyClient, healthyClient]);

        const result = await manager.getData('Test Movie', '2023');
        expect(result.apiTitle).toBe('Healthy Result');
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
        expect(healthyClient.fetch).toHaveBeenCalled();
    });

    it('should reset all disabled clients', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue() };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, mockConfig, []);
        await manager.resetDisabledClients();
        expect(mockDisabledManager.resetAll).toHaveBeenCalled();
    });

    it('should clear the cache', async () => {
        const mockCache = { clear: vi.fn().mockResolvedValue() };
        const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, []);
        await manager.clearCache();
        expect(mockCache.clear).toHaveBeenCalled();
    });
});
