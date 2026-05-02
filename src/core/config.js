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
import { CONFIG_DEFAULTS } from './config-fields.js';

let _configGet = key => CONFIG_DEFAULTS[key];

export function initConfig(getterFn) {
    _configGet = getterFn;
}

const configGet = (key, fallback) => {
    try {
        return _configGet(key) ?? fallback;
    } catch {
        return fallback;
    }
};

const createIntConfigGetter = (key, fallback) => () => {
    const num = Number.parseInt(configGet(key, fallback), 10);
    return Number.isNaN(num) ? fallback : num;
};

export const CONFIG = {
    get xmdbApiKey() {
        return configGet('xmdbApiKey', 'YOUR_XMDB_API_KEY');
    },
    get omdbApiKey() {
        return configGet('omdbApiKey', 'YOUR_OMDB_API_KEY');
    },
    get overlayCorner() {
        return configGet('overlayCorner', 'top-left');
    },
    get showRtRating() {
        return configGet('showRtRating', true);
    },
    get showMcRating() {
        return configGet('showMcRating', true);
    },
    get apiClients() {
        return configGet('apiClients', 'imdbapi,xmdb,omdb');
    },
    get cacheTtlRatedOldYear() {
        return createIntConfigGetter('cacheTtlRatedOldYear', -1)();
    },
    get cacheTtlRatedNewYear() {
        return createIntConfigGetter('cacheTtlRatedNewYear', 30)();
    },
    get cacheTtlNoRating() {
        return createIntConfigGetter('cacheTtlNoRating', 1)();
    },
    get enableFadeUnderRating() {
        return configGet('enableFadeUnderRating', false);
    },
    get fadeRatingThreshold() {
        const val = parseFloat(configGet('fadeRatingThreshold', '6.0'));
        return Number.isNaN(val) ? 6.0 : val;
    },
};
