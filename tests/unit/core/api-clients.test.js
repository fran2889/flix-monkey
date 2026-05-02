import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XmdbApiClient } from '../../../src/core/api-clients.js';
import * as configModule from '../../../src/core/config.js';

beforeEach(() => {
    vi.spyOn(configModule, 'CONFIG', 'get').mockReturnValue({ xmdbApiKey: 'test-key' });
});

describe('XmdbApiClient', () => {
    it('should fetch title details successfully', async () => {
        const mockAdapter = { 
            httpFetch: vi.fn()
                .mockResolvedValueOnce({ results: [{ id: 'tt123', title: 'Test Movie', type: 'title', year: '2023' }] })
                .mockResolvedValueOnce({
                    title: 'Test Movie',
                    year: '2023',
                    rating: '8.5',
                    ratings: [{ source: 'Rotten Tomatoes', value: '90%' }]
                }),
            storageGet: vi.fn().mockResolvedValue(null),
            storageSet: vi.fn().mockResolvedValue(undefined)
        };
        const mockDisabledManager = { isDisabled: vi.fn().mockResolvedValue(false) };

        const client = new XmdbApiClient(mockDisabledManager, mockAdapter);
        const result = await client.fetch('Test Movie', '2023');

        expect(result).toBeDefined();
        expect(result.apiTitle).toBe('Test Movie');
        expect(result.rating).toBe(8.5);
        expect(result.rtRating).toBe(90);
    });
});
