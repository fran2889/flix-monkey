import { describe, it, expect, skip } from 'vitest';
import { hasCredentials } from './setup';
import { RequestQueue } from '../../src/core/request-queue';

const credentials = ['XMDB_API_KEY'];

describe('request-queue integration', () => {
  if (!hasCredentials(credentials)) {
    skip('Missing API credentials, skipping integration tests');
  }

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
});
