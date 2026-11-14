/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';
import type { Logger } from './logger';

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
    readonly #logger: Logger;

    /**
     * Creates a queue with the given pacing and cross-tab sync key.
     *
     * @param adapter - Storage adapter used for cross-tab coordination.
     * @param logger - Logger for storage failures that abort a processing pass.
     * @param minInterval - Minimum delay between dispatched requests.
     * @param globalSyncKey - Storage key used to coordinate the delay across tabs.
     */
    constructor(adapter: PlatformAdapter, logger: Logger, minInterval: number, globalSyncKey: string) {
        this.#adapter = adapter;
        this.#logger = logger;
        this.#minInterval = minInterval;
        this.#globalSyncKey = globalSyncKey;
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
    async enqueue<T>(url: string, priority: number, fetchFn: (_urlParam: string) => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.#queue.push({
                url,
                priority,
                reject,
                run: async (urlParam: string): Promise<void> => {
                    try {
                        resolve(await fetchFn(urlParam));
                    } catch (error: unknown) {
                        reject(error);
                    }
                },
            });
            if (this.#queue.length > 1) {
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
            void this.#process();
        });
    }

    async #process(): Promise<void> {
        if (this.#isProcessing) return;
        this.#isProcessing = true;

        try {
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
                await this.#dispatchNextRequest();
            }
        } catch (err) {
            this.#logger.warn('RequestQueue pass aborted after a storage failure', {
                key: this.#globalSyncKey,
                pending: this.#queue.length,
                err,
            });
        } finally {
            this.#isProcessing = false;
        }
    }

    async #getLastGlobalRequestTime(): Promise<number> {
        const storedTime = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsedTime = Number.parseInt(String(storedTime), 10);

        return Number.isNaN(parsedTime) ? 0 : parsedTime;
    }

    async #syncClaimedRequestSlot(): Promise<void> {
        await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
    }

    async #dispatchNextRequest(): Promise<void> {
        const item = this.#queue.shift();
        if (!item) return;
        await item.run(item.url);
    }

    /**
     * Rejects pending requests without interrupting an active request.
     *
     * @returns Rejected count.
     */
    clear(): number {
        const pending = this.#queue.splice(0);
        for (const item of pending) {
            item.reject(new Error('Client Disabled'));
        }
        return pending.length;
    }
}

/** Internal queue item type */
interface QueueItem {
    url: string;
    priority: number;
    reject: (_reason: unknown) => void;
    run: (_url: string) => Promise<void>;
}
