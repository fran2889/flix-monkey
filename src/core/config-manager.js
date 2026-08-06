/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CONFIG_DEFAULTS, CONFIG_SELECT_ALLOWED } from './config-fields.js';
import { FlixMonkeyError } from './utils.js';

/** @typedef {keyof typeof CONFIG_DEFAULTS} ConfigKey */

export class ConfigManager {
    #adapter;
    #logger;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter
     * @param {import('./logger.js').Logger} [logger]
     */
    constructor(adapter, logger) {
        this.#adapter = adapter;
        this.#logger = logger;
    }

    /** @param {ConfigKey} key @returns {string|boolean} */
    get(key) {
        if (!(key in CONFIG_DEFAULTS)) throw new FlixMonkeyError(`ConfigManager: unknown config key "${key}"`);
        try {
            const val = this.#adapter.configGet(key);
            if (val === undefined || val === null) return CONFIG_DEFAULTS[key];
            const allowed = CONFIG_SELECT_ALLOWED[key];
            if (allowed && !allowed.includes(val)) return CONFIG_DEFAULTS[key];
            return val;
        } catch (err) {
            this.#logger?.warn('ConfigManager.get error, using fallback', { key, err });
            return CONFIG_DEFAULTS[key];
        }
    }

    /** @param {ConfigKey} key @returns {number} */
    getInt(key) {
        const val = this.get(key);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? Number.parseInt(CONFIG_DEFAULTS[key], 10) : num;
    }

    /** @param {ConfigKey} key @returns {number} */
    getFloat(key) {
        const val = this.get(key);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? Number.parseFloat(CONFIG_DEFAULTS[key]) : num;
    }

    /** @param {ConfigKey} key @returns {boolean} */
    getBool(key) {
        return String(this.get(key)) === 'true';
    }
}
