import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XmdbApiClient } from '../../../src/core/api-clients.js';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import * as configModule from '../../../src/core/config.js';

const server = setupServer();

beforeEach(() => {
    vi.spyOn(configModule, 'CONFIG', 'get').mockReturnValue({ xmdbApiKey: 'test-key' });
    server.resetHandlers();
});

describe('XmdbApiClient', () => {
    it('should fetch title details successfully', async () => {
        server.use(
            http.get('https://xmdbapi.com/api/v1/search', ({ request }) => {
                const url = new URL(request.url);
                return HttpResponse.json({ results: [{ id: 'tt123', title: 'Test Movie', type: 'title', year: '2023' }] });
            }),
            http.get('https://xmdbapi.com/api/v1/movies/tt123', () => {
                return HttpResponse.json({
                    title: 'Test Movie',
                    year: '2023',
                    rating: '8.5',
                    ratings: [{ source: 'Rotten Tomatoes', value: '90%' }]
                });
            })
        );

        const mockAdapter = { 
            httpFetch: vi.fn(async (url) => {
                const response = await fetch(url);
                return response.json();
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
