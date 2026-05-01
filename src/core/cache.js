import { DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { CONFIG } from './config.js';

export class CacheManager {
    #storageKey = 'fm_cache';
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    #getCacheKey(displayTitle, domYear) {
        return `${displayTitle.toLowerCase().replace(/\s+/g, '_')}${domYear ? `_${domYear}` : ''}`;
    }

    async #loadCacheData() {
        try {
            return JSON.parse((await this.#adapter.storageGet(this.#storageKey)) ?? '{}');
        } catch {
            return {};
        }
    }

    #calculateTtl(titleObj) {
        const getTtlMs = days => (days === -1 ? Infinity : days * DAYS_TO_MS);
        if (!titleObj.hasRating) return getTtlMs(CONFIG.cacheTtlNoRating);
        if (!titleObj.year) return getTtlMs(CONFIG.cacheTtlRatedNewYear);
        const currentYear = new Date().getFullYear();
        const isOldRelease = currentYear - titleObj.year > 1;
        const ttlDays = isOldRelease ? CONFIG.cacheTtlRatedOldYear : CONFIG.cacheTtlRatedNewYear;
        return getTtlMs(ttlDays);
    }

    async read(displayTitle, domYear) {
        const entry = (await this.#loadCacheData())[this.#getCacheKey(displayTitle, domYear)];
        if (!entry) return null;
        return Date.now() > entry.expires ? null : Title.fromJSON(entry.data);
    }

    async write(displayTitle, domYear, titleObj) {
        const blob = await this.#loadCacheData();
        const now = Date.now();
        Object.keys(blob).forEach(k => { if (now > blob[k].expires) delete blob[k]; });
        const ttl = this.#calculateTtl(titleObj);
        blob[this.#getCacheKey(displayTitle, domYear)] = {
            data: titleObj,
            expires: ttl === Infinity ? Infinity : now + ttl,
        };
        await this.#adapter.storageSet(this.#storageKey, JSON.stringify(blob));
    }

    async clear() {
        const blob = await this.#loadCacheData();
        const count = Object.keys(blob).length;
        await this.#adapter.storageSet(this.#storageKey, '{}');
        console.warn(`[FlixMonkey] Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
    }
}
