import { describe, it, expect, vi } from 'vitest';
import { ApiClientManager } from '../../../src/core/api-manager.js';
import { Title } from '../../../src/core/title.js';

describe('ApiClientManager', () => {
    it('should return cached data if available', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
        const manager = new ApiClientManager(mockCache, {}, {}, []);
        const result = await manager.getData('Some Title', '2023');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalled();
    });

    it('should iterate through clients and return the first result', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = { isDisabled: vi.fn().mockResolvedValue(false), fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })) };
        const manager = new ApiClientManager(mockCache, {}, {}, [mockClient]);
        const result = await manager.getData('Some Title', '2023');
        expect(result.apiTitle).toBe('Fetched Movie');
    });
});
