/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';

/** Storage key used to coordinate request timing across browser tabs. */
export const GLOBAL_SYNC_KEY = 'fm_last_req';

/**
 * Rate-limited request queue with priority-based execution and cross-tab synchronization.
 */
export class RequestQueue {
    readonly #queue: Array<QueueItem> = [];
    #isProcessing = false;
    #lastLocalReqTime = 0;
    readonly #minInterval: number;
    readonly #globalSyncKey: string;
    readonly #adapter: PlatformAdapter;

    /**
     * @param adapter - Storage adapter used for cross-tab coordination.
     * @param minInterval - Minimum delay between dispatched requests.
     * @param globalSyncKey - Storage key used to coordinate the delay across tabs.
     */
    constructor(adapter: PlatformAdapter, minInterval: number, globalSyncKey: string) {
        this.#minInterval = minInterval;
        this.#globalSyncKey = globalSyncKey;
        this.#adapter = adapter;
    }

    /**
     * Enqueues a request. Higher priority requests run first among work that has
     * not started; an active request is never preempted.
     *
     * @param url - Request URL supplied to fetchFn.
     * @param priority - Higher values run first.
     * @param fetchFn - Request operation.
     * @returns Result returned by fetchFn.
     */
    async enqueue<T>(_url: string, _priority: number, fetchFn: (_urlParam: string) => Promise<T>): Promise<T> {
        return new Promise((resolve: (_value: T | PromiseLike<T>) => void, reject) => {
            this.#queue.push({
                url: _url,
                priority: _priority,
                resolve: resolve as (_value2: unknown) => void,
                reject,
                fetchFn: fetchFn,
            });
            if (this.#queue.length > 1) {
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
            void this.#process<T>();
        });
    }

    async #process<T>(): Promise<void> {
        if (this.#isProcessing) return;
        this.#isProcessing = true;

        while (this.#queue.length > 0) {
            const now = Date.now();
            const lastGlobal = await this.#getLastGlobalRequestTime();

            const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
            if (wait > 0) {
                await new Promise(r => setTimeout(r, wait));
                // Re-read storage after waiting, then restart the loop: another tab may
                // have claimed the slot while this one slept.
                continue;
            }

            // Re-read storage before claiming the timeslot to reduce cross-tab races
            const freshGlobal = await this.#getLastGlobalRequestTime();
            if (Date.now() - freshGlobal < this.#minInterval) continue;

            this.#lastLocalReqTime = Date.now();
            await this.#syncClaimedRequestSlot();
            await this.#dispatchNextRequest<T>();
        }
        this.#isProcessing = false;
    }

    async #getLastGlobalRequestTime(): Promise<number> {
        const storedTime = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsedTime = Number.parseInt(String(storedTime), 10);

        return Number.isNaN(parsedTime) ? 0 : parsedTime;
    }

    async #syncClaimedRequestSlot(): Promise<void> {
        await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
    }

    async #dispatchNextRequest<T>(): Promise<void> {
        const item = this.#queue.shift();
        if (!item) return;
        try {
            const result = await (item.fetchFn as (_url: string) => Promise<T>)(item.url);
            (item.resolve as (_value: T | PromiseLike<T>) => void)(result);
        } catch (error) {
            item.reject(error);
        }
    }

    /**
     * Rejects pending requests without interrupting an active request.
     *
     * @returns Rejected count.
     */
    clear(): number {
        const count = this.#queue.length;
        while (this.#queue.length > 0) {
            const item = this.#queue.shift();
            if (!item) break;
            item.reject(new Error('Client Disabled'));
        }
        return count;
    }
}

/** Internal queue item type */
interface QueueItem<T = unknown> {
    url: string;
    priority: number;
    resolve: (_value: T | PromiseLike<T>) => void;
    reject: (_reason: unknown) => void;
    fetchFn: (_url: string) => Promise<T>;
}
