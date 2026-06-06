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
import { createMockLogger } from '../../mocks/logger.js';

describe('ApiClientManager', () => {
    it('should return cached data if available', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
        const manager = new ApiClientManager(mockCache, {}, {}, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalled();
    });

    it('should fetch and return result from client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Fetched Movie');
    });

    it('should handle fail if client returns null', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result).not.toBeNull();
        expect(result.hasRating).toBe(false);
        expect(result.displayTitle).toBe('Some Title');
        expect(client.fetch).toHaveBeenCalled();
    });

    it('should cache "Not Found" result if client fails', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
        const result = await manager.getData('Unknown Movie');
        expect(result.hasRating).toBe(false);
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            expect.objectContaining({ apiTitle: null, rating: null })
        );
    });

    it('should skip unhealthy client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const unhealthyClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(mockCache, {}, unhealthyClient, createMockLogger());
        const result = await manager.getData('Test Movie');
        expect(result.hasRating).toBe(false);
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
    });

    it('should reset all disabled clients and return the list of re-enabled ones', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue(['xmdb', 'omdb']) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, createMockLogger());
        const reenabled = await manager.resetDisabledClients();
        expect(mockDisabledManager.resetAll).toHaveBeenCalled();
        expect(reenabled).toEqual(['xmdb', 'omdb']);
    });

    it('should handle resetDisabledClients when no clients are re-enabled', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue([]) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, createMockLogger());
        const reenabled = await manager.resetDisabledClients();
        expect(reenabled).toEqual([]);
    });

    it('should log on successful data retrieval', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const title = new Title({ apiTitle: 'Logged Movie' });
        title.source = 'test-source';
        const mockClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(title),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Logged Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from test-source.')
        );
    });
});
