/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CACHE_TTL_INFINITE, DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { slugify } from './utils.js';

export class CacheManager {
    #prefix = 'fmc:';
    #adapter;
    #config;
    #logger;

    constructor(adapter, config, logger) {
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    #getCacheKey(displayTitle) {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    #calculateTtl(titleObj) {
        const getTtlMs = days => (days === CACHE_TTL_INFINITE ? Infinity : days * DAYS_TO_MS);
        if (!titleObj.hasRating) return getTtlMs(this.#config.getInt('cacheTtlNoRating'));
        if (!titleObj.year) return getTtlMs(this.#config.getInt('cacheTtlRatedNewYear'));
        const currentYear = new Date().getFullYear();
        const isOldRelease = currentYear - titleObj.year > 1;
        const ttlDays = isOldRelease
            ? this.#config.getInt('cacheTtlRatedOldYear')
            : this.#config.getInt('cacheTtlRatedNewYear');
        return getTtlMs(ttlDays);
    }

    async read(displayTitle, activeSource) {
        const key = this.#getCacheKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            const entry = JSON.parse(raw);
            const expired = entry.expires !== null && Date.now() > entry.expires;
            if (expired) return null;
            const titleObj = Title.fromJSON(entry.data);
            if (!titleObj.hasRating && titleObj.source !== activeSource) return null;
            return titleObj;
        } catch {
            this.#logger.warn('Cache entry corrupt, treating as miss', { key });
            return null;
        }
    }

    async write(displayTitle, titleObj) {
        const key = this.#getCacheKey(displayTitle);
        const now = Date.now();
        const ttl = this.#calculateTtl(titleObj);
        const entry = {
            data: titleObj,
            expires: ttl === Infinity ? null : now + ttl,
        };
        await this.#adapter.storageSet(key, JSON.stringify(entry));
    }

    async clear() {
        const keys = await this.#adapter.storageGetKeys(this.#prefix);
        const count = keys.length;
        await Promise.all(keys.map(key => this.#adapter.storageDelete(key)));
        this.#logger.debug(`Cache cleared: removed ${count} entr${count === 1 ? 'y' : 'ies'}`);
    }
}
