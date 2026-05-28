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
import { RequestQueue } from '../../../src/core/request-queue.js';

describe('RequestQueue', () => {
    it('should clear queue', async () => {
        // Use a large artificial interval to ensure the second request stays queued.
        // The first request starts processing immediately (leaving the queue),
        // so clearing the queue will abort exactly 1 pending request.
        const queue = new RequestQueue(999999);
        const _p1 = queue.enqueue('url1', 1, () => new Promise(() => {}), 'json').catch(() => {});
        const _p2 = queue.enqueue('url2', 1, () => new Promise(() => {}), 'json').catch(() => {});

        const count = queue.clear();
        expect(count).toBe(1);
    });

    it('should synchronize across instances using storage', async () => {
        let sharedTime = Date.now().toString();
        const mockAdapter = {
            storageGet: vi.fn(async () => sharedTime),
            storageSet: vi.fn(async (k, v) => {
                sharedTime = v;
            }),
        };

        const interval = 100;
        const queue1 = new RequestQueue(interval, 'sync-key', mockAdapter);
        const queue2 = new RequestQueue(interval, 'sync-key', mockAdapter);

        const start = Date.now();
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });

        // Execute sequentially to see if queue2 waits for queue1's timestamp in storage
        await queue1.enqueue('url1', 0, fetchFn, 'json');
        await queue2.enqueue('url2', 0, fetchFn, 'json');

        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(interval);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('should respect priority and jump the queue', async () => {
        const interval = 50;
        const queue = new RequestQueue(interval);
        const results = [];
        const fetchFn = async url => {
            results.push(url);
            return { url };
        };

        // Enqueue first request (starts immediately)
        const p1 = queue.enqueue('first', 0, fetchFn, 'json');

        // Enqueue low priority
        const p2 = queue.enqueue('low', 0, fetchFn, 'json');

        // Enqueue high priority (should jump over 'low')
        const p3 = queue.enqueue('high', 10, fetchFn, 'json');

        await Promise.all([p1, p2, p3]);

        expect(results).toEqual(['first', 'high', 'low']);
    });
});
