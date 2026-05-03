import { describe, it, expect } from 'vitest';
import { hasCredentials } from './setup';
import { XmdbApiClient } from '../../src/core/api-clients';
import { DisabledClientsManager } from '../../src/core/disabled-clients';

const credentials = ['XMDB_API_KEY'];

describe('api-clients integration', () => {
  if (!hasCredentials(credentials)) {
    it.skip('should fetch real data from APIs', async () => {});
  } else {
    it('should fetch real data from APIs', async () => {
        const adapter = { 
            httpFetch: async (url, options) => {
                const response = await fetch(url, options);
                return await response.json();
            },
            storageGet: async () => '0',
            storageSet: async () => {}
        };
        const client = new XmdbApiClient(new DisabledClientsManager(adapter), adapter);
        const result = await client.fetch('The Matrix');
        expect(result).toBeDefined();
        expect(result.title).toContain('Matrix');
    });
  }
});
