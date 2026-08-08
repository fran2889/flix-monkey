/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
export class RequestQueue {
    #queue = [];
    #isProcessing = false;
    #lastLocalReqTime = 0;
    #minInterval;
    #globalSyncKey;
    #adapter;

    /**
     * @param {number} [minInterval=1000] - Minimum delay between dispatched requests.
     * @param {string|null} [globalSyncKey=null] - Storage key used to coordinate the delay across tabs.
     * @param {import('../platform/adapter.js').PlatformAdapter|null} [adapter=null] - When supplied with globalSyncKey, enables cross-tab coordination.
     */
    constructor(minInterval = 1000, globalSyncKey = null, adapter = null) {
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
     * @param {(url: string, responseType: 'json'|'text') => Promise<unknown>} fetchFn - Request operation.
     * @param {'json'|'text'} responseType - Response format supplied to fetchFn.
     * @returns {Promise<unknown>} Result returned by fetchFn.
     */
    enqueue(url, priority, fetchFn, responseType) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ url, priority, resolve, reject, fetchFn, responseType });
            if (this.#queue.length > 1) {
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
            this.#process();
        });
    }

    /** Rejects pending requests without interrupting an active request. @returns {number} Rejected count. */
    clear() {
        const count = this.#queue.length;
        while (this.#queue.length > 0) {
            const item = this.#queue.shift();
            item.reject(new Error('Client Disabled'));
        }
        return count;
    }

    async #process() {
        if (this.#isProcessing) return;
        this.#isProcessing = true;

        while (this.#queue.length > 0) {
            const now = Date.now();
            let lastGlobal = 0;
            if (this.#globalSyncKey && this.#adapter) {
                const str = await this.#adapter.storageGet(this.#globalSyncKey);
                const parsed = parseInt(str, 10);
                lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
            }

            const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
            if (wait > 0) {
                await new Promise(r => setTimeout(r, wait));
                // Re-read storage after waiting, then restart loop
                continue;
            }

            // Re-read storage before claiming the timeslot to reduce cross-tab races
            if (this.#globalSyncKey && this.#adapter) {
                const str = await this.#adapter.storageGet(this.#globalSyncKey);
                const parsed = parseInt(str, 10);
                const freshGlobal = Number.isNaN(parsed) ? 0 : parsed;
                if (Date.now() - freshGlobal < this.#minInterval) continue;
            }

            this.#lastLocalReqTime = Date.now();
            if (this.#globalSyncKey && this.#adapter) {
                await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
            }

            const { url, resolve, reject, fetchFn, responseType } = this.#queue.shift();
            try {
                const result = await fetchFn(url, responseType);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        }
        this.#isProcessing = false;
    }
}
