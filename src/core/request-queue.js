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
        this.#queue.forEach(item => item.reject(new Error('Client Disabled')));
        this.#queue = [];
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
                await new Promise(r => setTimeout(r, wait + Math.random() * 50));
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
