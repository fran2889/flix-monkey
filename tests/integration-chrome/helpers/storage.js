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
import { CONFIG_FIELDS } from '../../../src/core/config-fields.js';
import { slugifyTitle } from './utils.js';

const API_KEY_FIELDS = new Set(['omdbApiKey', 'xmdbApiKey']);
const CONFIG_FIELD_KEYS = new Set(CONFIG_FIELDS.map(field => field.key));
const CACHE_PREFIX = 'fmc:';
const FADE_PREFIX = 'fm-fade:';
const DISABLED_PREFIX = 'fm_disabled_';

export function createStorageHelper(serviceWorker) {
    async function getAll() {
        return await serviceWorker.evaluate(() => chrome.storage.local.get(null));
    }

    async function set(values) {
        await serviceWorker.evaluate(async data => chrome.storage.local.set(data), values);
    }

    async function remove(keys) {
        if (keys.length === 0) return;
        await serviceWorker.evaluate(async keysToRemove => chrome.storage.local.remove(keysToRemove), keys);
    }

    async function resetForCleanRun() {
        const all = await getAll();
        const keysToRemove = Object.keys(all).filter(key => {
            if (API_KEY_FIELDS.has(key)) return false;
            return (
                CONFIG_FIELD_KEYS.has(key) ||
                key.startsWith(CACHE_PREFIX) ||
                key.startsWith(FADE_PREFIX) ||
                key.startsWith(DISABLED_PREFIX)
            );
        });
        await remove(keysToRemove);
    }

    async function seedRatings(titles, ratings) {
        const seeded = titles.map((title, index) => {
            const rating = ratings[index % ratings.length];
            const slug = slugifyTitle(title.title);
            const cacheKey = `${CACHE_PREFIX}${slug}`;
            const titleData = {
                displayTitle: title.title,
                apiTitle: title.title,
                imdbId: rating.imdbId,
                year: 2001 + index,
                rating: rating.rating,
                rtRating: rating.rtRating,
                mcRating: rating.mcRating,
                source: 'agregarr',
                type: 'movie',
            };
            return {
                ...title,
                ...rating,
                slug,
                cacheKey,
                cacheEntry: JSON.stringify({
                    data: titleData,
                    expires: null,
                }),
            };
        });

        await set(Object.fromEntries(seeded.map(title => [title.cacheKey, title.cacheEntry])));
        return seeded.map(({ cacheEntry: _cacheEntry, ...title }) => title);
    }

    async function seedDisabledClients(sources) {
        const disabledUntil = Date.now() + 60 * 60 * 1000;
        await set(Object.fromEntries(sources.map(source => [`${DISABLED_PREFIX}${source}`, String(disabledUntil)])));
    }

    async function getKeysByPrefix(prefix) {
        const all = await getAll();
        return Object.keys(all).filter(key => key.startsWith(prefix));
    }

    async function redactAll() {
        const all = await getAll();
        return Object.fromEntries(
            Object.entries(all).map(([key, value]) => [key, API_KEY_FIELDS.has(key) ? '<redacted>' : value])
        );
    }

    return {
        getAll,
        set,
        remove,
        resetForCleanRun,
        seedRatings,
        seedDisabledClients,
        getKeysByPrefix,
        redactAll,
        prefixes: {
            cache: CACHE_PREFIX,
            fade: FADE_PREFIX,
            disabled: DISABLED_PREFIX,
        },
    };
}
