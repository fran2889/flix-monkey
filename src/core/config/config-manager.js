/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { FlixMonkeyError } from '../utils/index.js';
import { CONFIG_DEFAULTS, CONFIG_SELECT_ALLOWED } from './config-fields.js';

/** @typedef {import('./config-fields.js').ConfigKey} ConfigKey */

/**
 * Manages application configuration with fallback to defaults and type conversion utilities.
 */
export class ConfigManager {
    #adapter;
    #logger;

    /**
     * Reads never throw for an absent key: they fall back to CONFIG_DEFAULTS.
     *
     * @param {import('../../platform/adapter.js').PlatformAdapter} adapter - Platform adapter supplying config reads.
     * @param {import('../logger.js').Logger} logger - Required; configuration reads can fail and are logged.
     */
    constructor(adapter, logger) {
        this.#adapter = adapter;
        this.#logger = logger;
    }

    /**
     * Returns the configured value for a known key.
     *
     * Throws FlixMonkeyError for an unknown key. Absent values, invalid select
     * values, and adapter read failures fall back to CONFIG_DEFAULTS. Returned
     * values are normalized to strings; use the typed accessors for conversion.
     *
     * @param {ConfigKey} key - The configuration key to retrieve.
     * @returns {string} The configured value as a string, or the default if not set or invalid.
     * @throws {import('../utils/index.js').FlixMonkeyError} If the key is not defined in CONFIG_DEFAULTS.
     */
    get(key) {
        if (!(key in CONFIG_DEFAULTS)) throw new FlixMonkeyError(`ConfigManager: unknown config key "${key}"`);
        try {
            const val = this.#adapter.configGet(key);
            const defaultValue = String(CONFIG_DEFAULTS[key]);
            if (val === undefined || val === null) return defaultValue;
            const normalizedVal = String(val);
            const allowed = CONFIG_SELECT_ALLOWED[key];
            if (allowed && !allowed.includes(normalizedVal)) return defaultValue;
            return normalizedVal;
        } catch (err) {
            this.#logger.warn('ConfigManager.get error, using fallback', { key, err });
            return String(CONFIG_DEFAULTS[key]);
        }
    }

    /**
     * Returns the configured value as an integer.
     *
     * @param {ConfigKey} key - The configuration key to retrieve.
     * @returns {number} Parsed integer, or the default parsed as an integer when unreadable.
     */
    getInt(key) {
        const val = this.get(key);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? Number.parseInt(CONFIG_DEFAULTS[key], 10) : num;
    }

    /**
     * Returns the configured value as a float.
     *
     * @param {ConfigKey} key - The configuration key to retrieve.
     * @returns {number} Parsed float, or the default parsed as a float when unreadable.
     */
    getFloat(key) {
        const val = this.get(key);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? Number.parseFloat(CONFIG_DEFAULTS[key]) : num;
    }

    /**
     * Returns the configured value as a boolean.
     *
     * @param {ConfigKey} key - The configuration key to retrieve.
     * @returns {boolean} True only when the stored value is the string `'true'`.
     */
    getBool(key) {
        return this.get(key) === 'true';
    }
}
