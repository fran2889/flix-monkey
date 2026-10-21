/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { ApiSource } from '../../../src/core/constants';
import { RATE_LIMIT_SYNC_KEYS } from '../../../src/core/rate-limits';
import { RequestQueue } from '../../../src/core/request-queue';
import { buildMockAdapter } from '../../mocks/adapter';

const SYNC_KEY = 'sync-key';

function buildQueue(interval: number, adapter = buildMockAdapter().build()): RequestQueue {
    return new RequestQueue(adapter, interval, SYNC_KEY);
}

describe('RequestQueue', () => {
    it('should clear queue', async () => {
        const firstFetch = vi.fn(() => new Promise(() => {}));
        const queue = buildQueue(999999);
        void queue.enqueue('url1', 1, firstFetch).catch(() => {});
        void queue.enqueue('url2', 1, () => new Promise(() => {})).catch(() => {});

        // Cross-tab sync reads storage before the first dequeue, so wait for the
        // active request to start before clearing the remaining queued item.
        await vi.waitFor(() => expect(firstFetch).toHaveBeenCalledOnce());
        const count = queue.clear();
        expect(count).toBe(1);
    });

    it('should synchronize across instances using storage', async () => {
        let sharedTime = Date.now().toString();
        const mockAdapter = buildMockAdapter().build();
        mockAdapter.storageGet = vi.fn(async () => sharedTime);
        mockAdapter.storageSet = vi.fn(async (_k: string, v: string | boolean) => {
            sharedTime = v as string;
        });

        const interval = 100;
        const queue1 = buildQueue(interval, mockAdapter);
        const queue2 = buildQueue(interval, mockAdapter);

        const start = Date.now();
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });

        // Execute sequentially to see if queue2 waits for queue1's timestamp in storage
        await queue1.enqueue('url1', 0, fetchFn);
        await queue2.enqueue('url2', 0, fetchFn);

        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(interval);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('paces requests per provider key', async () => {
        vi.useFakeTimers({ now: Date.now() });
        try {
            const storage = new Map<string, string>();
            const adapter = buildMockAdapter().build();
            adapter.storageGet = vi.fn(async (key: string) => storage.get(key));
            adapter.storageSet = vi.fn(async (key: string, value: string | boolean) => {
                storage.set(key, String(value));
            });
            const interval = 1000;
            const fetchFn = vi.fn().mockResolvedValue({ ok: true });
            const xmdbKey = RATE_LIMIT_SYNC_KEYS[ApiSource.XMDB];
            const omdbKey = RATE_LIMIT_SYNC_KEYS[ApiSource.OMDB];

            await new RequestQueue(adapter, interval, xmdbKey).enqueue('xmdb-1', 0, fetchFn);
            expect(fetchFn).toHaveBeenCalledTimes(1);

            const otherProvider = new RequestQueue(adapter, interval, omdbKey).enqueue('omdb-1', 0, fetchFn);
            await vi.advanceTimersByTimeAsync(0);
            expect(fetchFn).toHaveBeenCalledTimes(2);
            await otherProvider;

            const sameProvider = new RequestQueue(adapter, interval, xmdbKey).enqueue('xmdb-2', 0, fetchFn);
            await vi.advanceTimersByTimeAsync(0);
            expect(fetchFn).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(interval);
            await sameProvider;
            expect(fetchFn).toHaveBeenCalledTimes(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it('should respect priority and jump the queue', async () => {
        const interval = 50;
        const queue = buildQueue(interval);
        const results: string[] = [];
        const fetchFn = async (url: string) => {
            results.push(url);
            return { url };
        };

        const p1 = queue.enqueue('first', 0, fetchFn);

        const p2 = queue.enqueue('low', 0, fetchFn);

        const p3 = queue.enqueue('high', 10, fetchFn);

        await Promise.all([p1, p2, p3]);

        // The storage read keeps the queue from dequeuing until all three requests
        // are enqueued, so priority decides the first dispatch.
        expect(results).toEqual(['high', 'first', 'low']);
    });

    it('should fall back to 0 when stored timestamp is not a valid number', async () => {
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo('corrupted').build();
        const queue = buildQueue(100, mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });
        await queue.enqueue('url', 0, fetchFn);
        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('should read global storage twice per request when no wait is needed', async () => {
        const mockAdapter = buildMockAdapter()
            .withStorageGetResolvingTo('0')
            .withStorageSetResolvingTo(undefined)
            .build();
        const queue = buildQueue(0, mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });

        await queue.enqueue('url1', 0, fetchFn);
        await queue.enqueue('url2', 0, fetchFn);

        // Two reads per request (loop-start + pre-claim), two requests = four total
        expect(mockAdapter.storageGet).toHaveBeenCalledTimes(4);
    });

    it('should resolve multiple concurrently enqueued requests', async () => {
        const mockAdapter = buildMockAdapter()
            .withStorageGetResolvingTo('0')
            .withStorageSetResolvingTo(undefined)
            .build();
        const queue = buildQueue(100, mockAdapter);
        const mockFetch = async () => ({ status: 200 });

        const results = await Promise.all([
            queue.enqueue('https://example.com/a', 0, mockFetch),
            queue.enqueue('https://example.com/b', 0, mockFetch),
        ]);

        expect(results).toHaveLength(2);
        expect(results[0].status).toBe(200);
        expect(results[1].status).toBe(200);
    });

    it('should re-read global storage before claiming timeslot on no-wait path', async () => {
        const mockAdapter = buildMockAdapter()
            .withStorageGetResolvingTo('0')
            .withStorageSetResolvingTo(undefined)
            .build();
        const queue = buildQueue(0, mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });
        await queue.enqueue('url', 0, fetchFn);
        // Two reads per request: one at loop start, one pre-claim
        expect(mockAdapter.storageGet).toHaveBeenCalledTimes(2);
        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('should re-loop when pre-claim read shows another tab fired recently', async () => {
        let callCount = 0;
        const recentTime = Date.now();
        const staleTime = (recentTime - 2000).toString();
        const mockAdapter = buildMockAdapter().withStorageSetResolvingTo(undefined).build();
        mockAdapter.storageGet = vi.fn(async () => {
            callCount++;
            // 2nd call is the pre-claim re-read - simulate another tab just fired
            return callCount === 2 ? recentTime.toString() : staleTime;
        });
        const queue = buildQueue(100, mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true });
        await queue.enqueue('url', 0, fetchFn);
        // loop1-start -> stale (wait=0), pre-claim -> recent (re-loop),
        // loop2-start -> stale (wait=0), pre-claim -> stale (Date.now()-stale>100 -> proceed)
        expect(mockAdapter.storageGet).toHaveBeenCalledTimes(4);
        expect(fetchFn).toHaveBeenCalledOnce();
    });
});
