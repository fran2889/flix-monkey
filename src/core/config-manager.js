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
import { CONFIG_DEFAULTS, CONFIG_SELECT_ALLOWED } from './config-fields.js';
import { FlixMonkeyError } from './utils.js';

export class ConfigManager {
    #adapter;
    #logger;

    constructor(adapter, logger) {
        this.#adapter = adapter;
        this.#logger = logger;
    }

    get(key) {
        if (!(key in CONFIG_DEFAULTS)) throw new FlixMonkeyError(`ConfigManager: unknown config key "${key}"`);
        try {
            const val = this.#adapter.configGet(key);
            if (val === undefined || val === null) return CONFIG_DEFAULTS[key];
            const allowed = CONFIG_SELECT_ALLOWED[key];
            if (allowed && !allowed.includes(val)) return CONFIG_DEFAULTS[key];
            return val;
        } catch (err) {
            this.#logger.warn('ConfigManager.get error, using fallback', { key, err });
            return CONFIG_DEFAULTS[key];
        }
    }

    getInt(key) {
        const val = this.get(key);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? Number.parseInt(CONFIG_DEFAULTS[key], 10) : num;
    }

    getFloat(key) {
        const val = this.get(key);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? Number.parseFloat(CONFIG_DEFAULTS[key]) : num;
    }

    getBool(key) {
        return String(this.get(key)) === 'true';
    }
}
