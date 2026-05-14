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
import { DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { logger } from './logger.js';

export class CacheManager {
    #storageKey = 'fm_cache';
    #adapter;
    #config;

    constructor(adapter, config) {
        this.#adapter = adapter;
        this.#config = config;
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
        if (!titleObj.hasRating) return getTtlMs(this.#config.getInt('cacheTtlNoRating', 1));
        if (!titleObj.year) return getTtlMs(this.#config.getInt('cacheTtlRatedNewYear', 30));
        const currentYear = new Date().getFullYear();
        const isOldRelease = currentYear - titleObj.year > 1;
        const ttlDays = isOldRelease
            ? this.#config.getInt('cacheTtlRatedOldYear', -1)
            : this.#config.getInt('cacheTtlRatedNewYear', 30);
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
        Object.keys(blob).forEach(k => {
            if (now > blob[k].expires) delete blob[k];
        });
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
        logger.info(`Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
    }
}
