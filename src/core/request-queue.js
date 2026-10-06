/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * Rate-limited request queue with priority-based execution and optional cross-tab synchronization.
 */
export class RequestQueue {
    #queue = [];
    #isProcessing = false;
    #lastLocalReqTime = 0;
    #minInterval;
    #globalSyncKey;
    #adapter;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter|null} adapter - Storage adapter used for cross-tab coordination when `globalSyncKey` is set.
     * @param {number} minInterval - Minimum delay between dispatched requests.
     * @param {string|null} globalSyncKey - Storage key used to coordinate the delay across tabs, or null to rate-limit within this context only.
     */
    constructor(adapter, minInterval, globalSyncKey) {
        this.#minInterval = minInterval;
        this.#globalSyncKey = globalSyncKey;
        this.#adapter = adapter;
    }

    /**
     * Enqueues a request. Higher priority requests run first among work that has
     * not started; an active request is never preempted.
     *
     * @param {string} url - Request URL supplied to fetchFn.
     * @param {number} priority - Higher values run first.
     * @param {(url: string) => Promise<unknown>} fetchFn - Request operation.
     * @returns {Promise<unknown>} Result returned by fetchFn.
     */
    enqueue(url, priority, fetchFn) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ url, priority, resolve, reject, fetchFn });
            if (this.#queue.length > 1) {
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
            void this.#process();
        });
    }

    async #process() {
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
            await this.#dispatchNextRequest();
        }
        this.#isProcessing = false;
    }

    /** Only reached once {@link #globalSyncKey} and {@link #adapter} are both set. */
    async #getLastGlobalRequestTime() {
        const storedTime = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsedTime = Number.parseInt(storedTime, 10);
        return Number.isNaN(parsedTime) ? 0 : parsedTime;
    }

    #claimNextRequestSlot() {
        this.#lastLocalReqTime = Date.now();
        return Boolean(this.#globalSyncKey && this.#adapter);
    }

    async #syncClaimedRequestSlot() {
        await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
    }

    async #dispatchNextRequest() {
        const { url, resolve, reject, fetchFn } = this.#queue.shift();
        try {
            resolve(await fetchFn(url));
        } catch (error) {
            reject(error);
        }
    }

    /**
     * Rejects pending requests without interrupting an active request.
     *
     * @returns {number} Rejected count.
     */
    clear() {
        const count = this.#queue.length;
        while (this.#queue.length > 0) {
            const item = this.#queue.shift();
            item.reject(new Error('Client Disabled'));
        }
        return count;
    }
}
