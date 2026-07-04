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
import { describe, expect, it, vi } from 'vitest';

import { RequestQueue } from '../../../src/core/request-queue.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('RequestQueue', () => {
    it('should clear queue', async () => {
        // Timing assumption: the first enqueued item enters #process() synchronously
        // before the first `await`, which removes it from the queue. The second item
        // remains queued because the large interval (999999ms) causes #process to wait.
        // clear() therefore finds exactly 1 item to abort.
        // If #process() ever defers its first dequeue past an await, this count changes.
        const queue = new RequestQueue(999999);
        const _p1 = queue.enqueue('url1', 1, () => new Promise(() => {}), 'json').catch(() => {});
        const _p2 = queue.enqueue('url2', 1, () => new Promise(() => {}), 'json').catch(() => {});

        const count = queue.clear();
        expect(count).toBe(1);
    });

    it('should synchronize across instances using storage', async () => {
        let sharedTime = Date.now().toString();
        const mockAdapter = createMockAdapter({
            storageGet: vi.fn(async () => sharedTime),
            storageSet: vi.fn(async (k, v) => {
                sharedTime = v;
            }),
        });

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

    it('should fall back to 0 when stored timestamp is not a valid number', async () => {
        const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('corrupted') });
        const queue = new RequestQueue(100, 'sync-key', mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });
        await queue.enqueue('url', 0, fetchFn, 'json');
        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('should read global storage twice per request when no wait is needed', async () => {
        const mockAdapter = createMockAdapter({
            storageGet: vi.fn().mockResolvedValue('0'),
            storageSet: vi.fn().mockResolvedValue(undefined),
        });
        const queue = new RequestQueue(0, 'sync-key', mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });

        await queue.enqueue('url1', 0, fetchFn, 'json');
        await queue.enqueue('url2', 0, fetchFn, 'json');

        // Two reads per request (loop-start + pre-claim), two requests = four total
        expect(mockAdapter.storageGet).toHaveBeenCalledTimes(4);
    });

    it('should resolve multiple concurrently enqueued requests', async () => {
        const mockAdapter = createMockAdapter({ storageGet: async () => '0', storageSet: async () => {} });
        const queue = new RequestQueue(100, null, mockAdapter);
        const mockFetch = async () => ({ status: 200 });

        const results = await Promise.all([
            queue.enqueue('https://example.com/a', 0, mockFetch, 'json'),
            queue.enqueue('https://example.com/b', 0, mockFetch, 'json'),
        ]);

        expect(results).toHaveLength(2);
        expect(results[0].status).toBe(200);
        expect(results[1].status).toBe(200);
    });

    it('should re-read global storage before claiming timeslot on no-wait path', async () => {
        const mockAdapter = createMockAdapter({
            storageGet: vi.fn().mockResolvedValue('0'),
            storageSet: vi.fn().mockResolvedValue(undefined),
        });
        const queue = new RequestQueue(0, 'sync-key', mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });
        await queue.enqueue('url', 0, fetchFn, 'json');
        // Two reads per request: one at loop start, one pre-claim
        expect(mockAdapter.storageGet).toHaveBeenCalledTimes(2);
        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('should re-loop when pre-claim read shows another tab fired recently', async () => {
        let callCount = 0;
        const recentTime = Date.now();
        const staleTime = (recentTime - 2000).toString();
        const mockAdapter = createMockAdapter({
            storageGet: vi.fn(async () => {
                callCount++;
                // 2nd call is the pre-claim re-read — simulate another tab just fired
                return callCount === 2 ? recentTime.toString() : staleTime;
            }),
            storageSet: vi.fn().mockResolvedValue(undefined),
        });
        const queue = new RequestQueue(100, 'sync-key', mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });
        await queue.enqueue('url', 0, fetchFn, 'json');
        // loop1-start → stale (wait=0), pre-claim → recent (re-loop),
        // loop2-start → stale (wait=0), pre-claim → stale (Date.now()-stale>100 → proceed)
        expect(mockAdapter.storageGet).toHaveBeenCalledTimes(4);
        expect(fetchFn).toHaveBeenCalledOnce();
    });
});
