/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
export class RequestQueue {
    #queue = [];
    #isProcessing = false;
    #lastLocalReqTime = 0;
    #minInterval;
    #globalSyncKey;
    #adapter;

    constructor(minInterval = 1000, globalSyncKey = null, adapter = null) {
        this.#minInterval = minInterval;
        this.#globalSyncKey = globalSyncKey;
        this.#adapter = adapter;
    }

    enqueue(url, priority, fetchFn, responseType) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ url, priority, resolve, reject, fetchFn, responseType });
            if (this.#queue.length > 1) {
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
            this.#process();
        });
    }

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
