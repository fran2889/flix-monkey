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

export class ConfigManager {
    #getter;

    constructor(getterFn = (key) => CONFIG_DEFAULTS[key]) {
        this.#getter = getterFn;
    }

    get(key, fallback) {
        try {
            return this.#getter(key) ?? fallback ?? CONFIG_DEFAULTS[key];
        } catch {
            return fallback ?? CONFIG_DEFAULTS[key];
        }
    }

    getInt(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? fallback : num;
    }

    getFloat(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? fallback : num;
    }
}
