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
            this.#queue.sort((a, b) => b.priority - a.priority);

            const now = Date.now();
            let lastGlobal = 0;
            if (this.#globalSyncKey && this.#adapter) {
                const str = await this.#adapter.storageGet(this.#globalSyncKey);
                lastGlobal = str ? parseInt(str, 10) : 0;
            }

            const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
            if (wait > 0) {
                await new Promise(r => setTimeout(r, wait));
                continue;
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
