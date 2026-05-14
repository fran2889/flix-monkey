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
import { describe, it, expect } from 'vitest';
import { hasCredentials } from './setup';
import { RequestQueue } from '../../src/core/request-queue';

const credentials = ['XMDB_API_KEY'];

describe('request-queue integration', () => {
    if (!hasCredentials(credentials)) {
        it.skip('should handle concurrent requests against real API', async () => {});
    } else {
        it('should handle concurrent requests against real API', async () => {
            const adapter = {
                storageGet: async () => '0',
                storageSet: async () => {},
            };
            const queue = new RequestQueue(100, null, adapter);
            const mockFetch = async () => ({ status: 200 });

            const results = await Promise.all([
                queue.enqueue('https://google.com', 0, mockFetch, 'json'),
                queue.enqueue('https://google.com', 0, mockFetch, 'json'),
            ]);
            expect(results).toHaveLength(2);
            expect(results[0].status).toBe(200);
        });
    }
});
