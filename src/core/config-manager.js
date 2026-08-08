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

    /**
     * Returns the configured value for a known key.
     *
     * Throws FlixMonkeyError for an unknown key. Absent values, invalid select
     * values, and adapter read failures fall back to CONFIG_DEFAULTS. Present
     * values are normalized to the configured field type.
     *
     * @param {ConfigKey} key
     * @returns {string|boolean}
     */
    get(key) {
        if (!(key in CONFIG_DEFAULTS)) throw new FlixMonkeyError(`ConfigManager: unknown config key "${key}"`);
        try {
            const val = this.#adapter.configGet(key);
            if (val === undefined || val === null) return CONFIG_DEFAULTS[key];
            const normalizedVal = typeof CONFIG_DEFAULTS[key] === 'boolean' ? String(val) === 'true' : String(val);
            const allowed = CONFIG_SELECT_ALLOWED[key];
            if (allowed && !allowed.includes(normalizedVal)) return CONFIG_DEFAULTS[key];
            return normalizedVal;
        } catch (err) {
            this.#logger?.warn('ConfigManager.get error, using fallback', { key, err });
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
