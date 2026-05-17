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
    #prefix = 'fmc:';
    #adapter;
    #config;

    constructor(adapter, config) {
        this.#adapter = adapter;
        this.#config = config;
    }

    #getCacheKey(displayTitle, domYear) {
        const slug = `${displayTitle.toLowerCase().replace(/\s+/g, '_')}${domYear ? `_${domYear}` : ''}`;
        return `${this.#prefix}${slug}`;
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
        const key = this.#getCacheKey(displayTitle, domYear);
        const raw = await this.#adapter.storageGet(key);
        if (!raw) return null;
        try {
            const entry = JSON.parse(raw);
            const expired = entry.expires !== null && Date.now() > entry.expires;
            return expired ? null : Title.fromJSON(entry.data);
        } catch {
            return null;
        }
    }

    async write(displayTitle, domYear, titleObj) {
        const key = this.#getCacheKey(displayTitle, domYear);
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
        for (const key of keys) {
            await this.#adapter.storageDelete(key);
        }
        logger.info(`Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
    }
}
