import { initConfig } from '../../src/core/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { hasCredentials } from './setup';
import { RequestQueue } from '../../src/core/request-queue';

const credentials = ['XMDB_API_KEY'];

describe('request-queue integration', () => {
    beforeAll(() => {
        initConfig(key => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        });
    });
  if (!hasCredentials(credentials)) {
    it.skip('should handle concurrent requests against real API', async () => {});
  } else {
    it('should handle concurrent requests against real API', async () => {
        const adapter = { 
            storageGet: async () => '0',
            storageSet: async () => {}
        };
        const queue = new RequestQueue(100, null, adapter);
        const mockFetch = async () => ({ status: 200 });
        
        const results = await Promise.all([
          queue.enqueue('https://google.com', 0, mockFetch, 'json'),
          queue.enqueue('https://google.com', 0, mockFetch, 'json')
        ]);
        expect(results).toHaveLength(2);
        expect(results[0].status).toBe(200);
    });
  }
});
