/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiSource } from '../../../src/core/constants';
import { PROVIDER_RATE_LIMITS } from '../../../src/core/rate-limits';
import { RequestQueue } from '../../../src/core/request-queue';
import { flushAsyncWork } from '../../helpers/async';
import { buildMockAdapter } from '../../mocks/adapter';
import { buildLogger } from '../../mocks/logger';

const SYNC_KEY = 'sync-key';

// Keeps pacing from releasing a queued request during a test, even if the
// active fetch is changed to settle.
const PACING_DISABLED_MS = 999_999;

function buildQueue(
    interval: number,
    adapter = buildMockAdapter().build(),
    logger = buildLogger().build()
): RequestQueue {
    return new RequestQueue(adapter, logger, interval, SYNC_KEY);
}

describe('RequestQueue', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('clear', () => {
        it('clears the queue and rejects pending requests', async () => {
            const firstFetch = vi.fn(() => new Promise(() => {}));
            const queue = buildQueue(PACING_DISABLED_MS);
            void queue.enqueue('url1', 1, firstFetch).catch(() => {});
            const pending = queue.enqueue('url2', 1, () => new Promise(() => {}));

            // Cross-tab sync reads storage before the first dequeue, so wait for the
            // active request to start before clearing the remaining queued item.
            await flushAsyncWork();
            expect(firstFetch).toHaveBeenCalledOnce();
            const count = queue.clear();
            expect(count).toBe(1);
            await expect(pending).rejects.toThrow('Client Disabled');
        });
        it('rejects cleared requests in queue order', async () => {
            const firstFetch = vi.fn(() => new Promise(() => {}));
            const queue = buildQueue(PACING_DISABLED_MS);
            void queue.enqueue('active', 1, firstFetch).catch(() => {});
            await flushAsyncWork();
            expect(firstFetch).toHaveBeenCalledOnce();

            const rejected: string[] = [];
            const first = queue
                .enqueue('first', 0, () => new Promise(() => {}))
                .catch(() => {
                    rejected.push('first');
                });
            const second = queue
                .enqueue('second', 0, () => new Promise(() => {}))
                .catch(() => {
                    rejected.push('second');
                });

            expect(queue.clear()).toBe(2);
            await Promise.all([first, second]);
            expect(rejected).toEqual(['first', 'second']);
        });
        it('drops a queued request cleared during a processing pass', async () => {
            let reads = 0;
            let releaseRead: () => void = () => undefined;
            const adapter = buildMockAdapter().withStorageSetResolvingTo(undefined).build();
            adapter.storageGet = vi.fn(() => {
                reads += 1;
                if (reads <= 3) return Promise.resolve('0');
                return new Promise<string>(resolve => {
                    releaseRead = () => resolve('0');
                });
            });
            const logger = buildLogger().build();
            const queue = buildQueue(0, adapter, logger);
            const firstFetch = vi.fn().mockResolvedValue('first');
            const secondFetch = vi.fn().mockResolvedValue('second');

            await queue.enqueue('url1', 0, firstFetch);

            const second = queue.enqueue('url2', 0, secondFetch);
            const secondResult = second.catch((error: unknown) => error);
            await flushAsyncWork();
            expect(adapter.storageGet).toHaveBeenCalledTimes(4);
            expect(secondFetch).not.toHaveBeenCalled();

            expect(queue.clear()).toBe(1);
            releaseRead();
            await flushAsyncWork();

            expect(secondFetch).not.toHaveBeenCalled();
            await expect(secondResult).resolves.toEqual(new Error('Client Disabled'));
            expect(logger.warn).not.toHaveBeenCalled();
        });
    });

    it('rejects the caller with the original fetch error', async () => {
        const queue = buildQueue(0);
        const error = new Error('fetch failed');

        await expect(queue.enqueue('url', 1, () => Promise.reject(error))).rejects.toBe(error);
    });

    describe('pacing', () => {
        it('paces requests per provider key', async () => {
            const storage = new Map<string, string>();
            const adapter = buildMockAdapter().build();
            adapter.storageGet = vi.fn(async (key: string) => storage.get(key));
            adapter.storageSet = vi.fn(async (key: string, value: string | boolean) => {
                storage.set(key, String(value));
            });
            const interval = 1000;
            const fetchFn = vi.fn().mockResolvedValue({ ok: true });
            const xmdbKey = PROVIDER_RATE_LIMITS[ApiSource.XMDB].syncKey;
            const omdbKey = PROVIDER_RATE_LIMITS[ApiSource.OMDB].syncKey;
            const queueLogger = buildLogger().build();

            await new RequestQueue(adapter, queueLogger, interval, xmdbKey).enqueue('xmdb-1', 0, fetchFn);
            expect(fetchFn).toHaveBeenCalledTimes(1);

            const otherProvider = new RequestQueue(adapter, queueLogger, interval, omdbKey).enqueue(
                'omdb-1',
                0,
                fetchFn
            );
            await flushAsyncWork();
            expect(fetchFn).toHaveBeenCalledTimes(2);
            await otherProvider;

            const sameProvider = new RequestQueue(adapter, queueLogger, interval, xmdbKey).enqueue(
                'xmdb-2',
                0,
                fetchFn
            );
            await flushAsyncWork();
            expect(fetchFn).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(interval);
            await sameProvider;
            expect(fetchFn).toHaveBeenCalledTimes(3);
        });
        it('resolves multiple concurrently enqueued requests', async () => {
            const mockAdapter = buildMockAdapter()
                .withStorageGetResolvingTo('0')
                .withStorageSetResolvingTo(undefined)
                .build();
            const interval = 100;
            const queue = buildQueue(interval, mockAdapter);
            const mockFetch = async () => ({ status: 200 });

            const first = queue.enqueue('https://example.com/a', 0, mockFetch);
            const second = queue.enqueue('https://example.com/b', 0, mockFetch);
            await vi.advanceTimersByTimeAsync(interval);
            const results = await Promise.all([first, second]);

            expect(results).toHaveLength(2);
            expect(results[0].status).toBe(200);
            expect(results[1].status).toBe(200);
        });
    });

    it('dispatches higher-priority requests first', async () => {
        const interval = 50;
        const queue = buildQueue(interval);
        const dispatchOrder: string[] = [];
        const fetchFn = async (url: string) => {
            dispatchOrder.push(url);
            return { url };
        };

        const p1 = queue.enqueue('first', 0, fetchFn);

        const p2 = queue.enqueue('low', 0, fetchFn);

        const p3 = queue.enqueue('high', 10, fetchFn);

        // Three dispatches at one interval each need two pacing gaps.
        await vi.advanceTimersByTimeAsync(interval * 2);
        await Promise.all([p1, p2, p3]);

        // The storage read keeps the queue from dequeuing until all three requests
        // are enqueued, so priority decides the first dispatch.
        expect(dispatchOrder).toEqual(['high', 'first', 'low']);
    });

    describe('storage synchronization', () => {
        it('recovers when a storage read fails during processing', async () => {
            let storageReads = 0;
            const adapter = buildMockAdapter()
                .withStorageGetResolvingTo(() => {
                    storageReads += 1;
                    return storageReads === 1
                        ? Promise.reject(new Error('storage failed'))
                        : Promise.resolve(undefined);
                })
                .build();
            const logger = buildLogger().build();
            const queue = buildQueue(0, adapter, logger);
            const firstFetch = vi.fn(() => Promise.resolve('first'));
            const secondFetch = vi.fn(() => Promise.resolve('second'));

            void queue.enqueue('url1', 1, firstFetch);
            await flushAsyncWork();
            expect(storageReads).toBe(1);
            expect(logger.warn).toHaveBeenCalledWith('RequestQueue pass aborted after a storage failure', {
                key: SYNC_KEY,
                pending: 1,
                err: expect.any(Error),
            });
            expect(firstFetch).not.toHaveBeenCalled();

            void queue.enqueue('url2', 1, secondFetch);
            await flushAsyncWork();
            expect(firstFetch).toHaveBeenCalledOnce();
            expect(secondFetch).toHaveBeenCalledOnce();
        });
        it('synchronizes across instances using storage', async () => {
            // Seed the shared slot in the past so queue1 dispatches at once and
            // queue2 waits a full interval, independent of the fake clock's
            // default start value.
            let sharedTime = '0';
            const mockAdapter = buildMockAdapter().build();
            mockAdapter.storageGet = vi.fn(async () => sharedTime);
            mockAdapter.storageSet = vi.fn(async (_k: string, v: string | boolean) => {
                sharedTime = v as string;
            });

            const interval = 100;
            const queue1 = buildQueue(interval, mockAdapter);
            const queue2 = buildQueue(interval, mockAdapter);
            const fetchFn = vi.fn().mockResolvedValue({ ok: true });

            await queue1.enqueue('url1', 0, fetchFn);
            const second = queue2.enqueue('url2', 0, fetchFn);

            await vi.advanceTimersByTimeAsync(interval - 1);
            expect(fetchFn).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(1);
            await second;
            expect(fetchFn).toHaveBeenCalledTimes(2);
        });
        it('falls back to 0 when the stored timestamp is not a valid number', async () => {
            const mockAdapter = buildMockAdapter().withStorageGetResolvingTo('corrupted').build();
            const queue = buildQueue(100, mockAdapter);
            const fetchFn = vi.fn().mockResolvedValue({ ok: true });
            await queue.enqueue('url', 0, fetchFn);
            expect(fetchFn).toHaveBeenCalledOnce();
        });
        it('re-reads global storage twice per request on the no-wait path', async () => {
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
            expect(fetchFn).toHaveBeenCalledTimes(2);
        });
        it('re-loops when a pre-claim read shows another tab fired recently', async () => {
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
});
