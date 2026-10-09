/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter.js';

/**
 * Rate-limited request queue with priority-based execution and optional cross-tab synchronization.
 */
export class RequestQueue {
    #queue: Array<QueueItem> = [];
    #isProcessing = false;
    #lastLocalReqTime = 0;
    #minInterval: number;
    #globalSyncKey: string | null;
    #adapter: PlatformAdapter | null;

    /**
     * @param adapter - Storage adapter used for cross-tab coordination when `globalSyncKey` is set.
     * @param minInterval - Minimum delay between dispatched requests.
     * @param globalSyncKey - Storage key used to coordinate the delay across tabs, or null to rate-limit within this context only.
     */
    constructor(adapter: PlatformAdapter | null, minInterval: number, globalSyncKey: string | null) {
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
    enqueue<T>(_url: string, _priority: number, fetchFn: (_urlParam: string) => Promise<T>): Promise<T> {
        return new Promise((resolve: (_value: T | PromiseLike<T>) => void, reject) => {
            this.#queue.push({
                url: _url,
                priority: _priority,
                resolve: resolve as (_value2: unknown) => void,
                reject,
                fetchFn: fetchFn as (_url2: string) => Promise<unknown>,
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
            const lastGlobal = this.#globalSyncKey && this.#adapter ? await this.#getLastGlobalRequestTime() : 0;

            const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
            if (wait > 0) {
                await new Promise(r => setTimeout(r, wait));
                // Re-read storage after waiting, then restart the loop: another tab may
                // have claimed the slot while this one slept.
                continue;
            }

            // Re-read storage before claiming the timeslot to reduce cross-tab races
            if (this.#globalSyncKey && this.#adapter) {
                const freshGlobal = await this.#getLastGlobalRequestTime();
                if (Date.now() - freshGlobal < this.#minInterval) continue;
            }

            const needsGlobalSync = this.#claimNextRequestSlot();
            if (needsGlobalSync) await this.#syncClaimedRequestSlot();
            await this.#dispatchNextRequest<T>();
        }
        this.#isProcessing = false;
    }

    /** Only reached once globalSyncKey and adapter are both set. */
    async #getLastGlobalRequestTime(): Promise<number> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const storedTime = await this.#adapter!.storageGet(this.#globalSyncKey!);
        const parsedTime = Number.parseInt(storedTime as string, 10);

        return Number.isNaN(parsedTime) ? 0 : parsedTime;
    }

    #claimNextRequestSlot(): boolean {
        this.#lastLocalReqTime = Date.now();
        return Boolean(this.#globalSyncKey && this.#adapter);
    }

    async #syncClaimedRequestSlot(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await this.#adapter!.storageSet(this.#globalSyncKey!, this.#lastLocalReqTime.toString());
    }

    async #dispatchNextRequest<T>(): Promise<void> {
        const item = this.#queue.shift() as QueueItem<unknown>;
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const item = this.#queue.shift()!;
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
