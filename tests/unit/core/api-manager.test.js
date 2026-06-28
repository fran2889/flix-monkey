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
import { FlixMonkeyError } from '../../../src/core/utils.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('ApiClientManager', () => {
    it('should return cached data if available', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
        const mockClient = { source: 'imdbapi' };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalledWith('Some Title', 'imdbapi');
    });

    it('should fetch and return result from client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            source: 'imdbapi',
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
            source: 'imdbapi',
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

    it('should cache genuine not-found result with source', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            source: 'omdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
        const result = await manager.getData('Unknown Movie');
        expect(result.hasRating).toBe(false);
        expect(result.source).toBe('omdb');
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            expect.objectContaining({ source: 'omdb', rating: null })
        );
    });

    it('should skip unhealthy client and not cache the result', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const unhealthyClient = {
            source: 'imdbapi',
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(mockCache, {}, unhealthyClient, createMockLogger());
        const result = await manager.getData('Test Movie');
        expect(result.hasRating).toBe(false);
        expect(result.source).toBe('imdbapi');
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
        expect(mockCache.write).not.toHaveBeenCalled();
    });

    it('should not cache result when fetch throws an error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            source: 'imdbapi',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(new Error('API error')),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        const result = await manager.getData('Error Movie');
        expect(result.hasRating).toBe(false);
        expect(result.displayTitle).toBe('Error Movie');
        expect(result.source).toBe('imdbapi');
        expect(mockCache.write).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error Movie'), {
            url: null,
            status: null,
            body: null,
        });
    });

    it('should disable client on 4xx HTTP error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 401', 'https://api.example.com', 401, 'Unauthorized');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        const result = await manager.getData('Test Movie');
        expect(mockClient.disable).toHaveBeenCalled();
        expect(result.hasRating).toBe(false);
    });

    it('should NOT disable client on 5xx HTTP error', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 500', 'https://api.example.com', 500, 'Internal Server Error');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Test Movie');
        expect(mockClient.disable).not.toHaveBeenCalled();
    });

    it('should log at error level for HTTP errors with status, url, and body', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new FlixMonkeyError('HTTP 403', 'https://api.example.com/search', 403, 'Forbidden');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Test Movie');
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
            url: 'https://api.example.com/search',
            status: 403,
            body: 'Forbidden',
        });
    });

    it('should log at warn level for non-HTTP errors', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const error = new Error('network error');
        const mockClient = {
            source: 'xmdb',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockRejectedValue(error),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Test Movie');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
            url: null,
            status: null,
            body: null,
        });
        expect(mockLogger.error).not.toHaveBeenCalled();
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
        const title = new Title({ apiTitle: 'Logged Movie', source: 'test-source' });
        const mockClient = {
            source: 'test-source',
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(title),
        };
        const mockLogger = createMockLogger();
        const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
        await manager.getData('Logged Movie');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from test-source')
        );
    });
});
