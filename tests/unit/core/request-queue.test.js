import { describe, it, expect, vi } from 'vitest';
import { RequestQueue } from '../../../src/core/request-queue.js';

describe('RequestQueue', () => {
    it('should clear queue', async () => {
        const queue = new RequestQueue(999999);
        const p1 = queue.enqueue('url1', 1, () => new Promise(() => {}), 'json').catch(() => {});
        const p2 = queue.enqueue('url2', 1, () => new Promise(() => {}), 'json').catch(() => {});

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
