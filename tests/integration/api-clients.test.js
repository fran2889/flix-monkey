import { initConfig } from '../../src/core/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { hasCredentials } from './setup';
import { XmdbApiClient } from '../../src/core/api-clients';
import { DisabledClientsManager } from '../../src/core/disabled-clients';

const credentials = ['XMDB_API_KEY'];

describe('api-clients integration', () => {
    beforeAll(() => {
        initConfig(key => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        });
    });
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
                storageSet: async () => {},
            };
            const client = new XmdbApiClient(new DisabledClientsManager(adapter), adapter);
            const result = await client.fetch('The Matrix');
            expect(result).toBeDefined();
            expect(result.apiTitle).toContain('Matrix');
        });
    }
});
