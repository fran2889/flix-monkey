/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { Logger } from '../logger';
import { FlixMonkeyError } from '../utils/index';
import { CONFIG_DEFAULTS, CONFIG_SELECT_ALLOWED } from './config-fields';

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

/**
 * Manages application configuration with fallback to defaults and type conversion utilities.
 */
export class ConfigManager {
    #adapter: PlatformAdapter;
    #logger: Logger;

    /**
     * @param adapter
     * @param logger - Required; configuration reads can fail and are logged.
     */
    constructor(adapter: PlatformAdapter, logger: Logger) {
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
     * @param key - The configuration key to retrieve.
     * @returns The configured value as a string, or the default if not set or invalid.
     * @throws {FlixMonkeyError} If the key is not defined in CONFIG_DEFAULTS.
     */
    get(key: ConfigKey): string {
        if (!(key in CONFIG_DEFAULTS)) throw new FlixMonkeyError(`ConfigManager: unknown config key "${key}"`);
        try {
            const val = this.#adapter.configGet(key);
            const defaultValue = String(
                CONFIG_DEFAULTS[key as keyof typeof CONFIG_DEFAULTS] as string | boolean | null
            );
            if (val === undefined || val === null) return defaultValue;
            const normalizedVal = String(val);
            const allowed = CONFIG_SELECT_ALLOWED[key as keyof typeof CONFIG_SELECT_ALLOWED] as string[] | undefined;
            if (allowed && !allowed.includes(normalizedVal)) return defaultValue;
            return normalizedVal;
        } catch (err) {
            this.#logger.warn('ConfigManager.get error, using fallback', { key, err });
            return String(CONFIG_DEFAULTS[key as keyof typeof CONFIG_DEFAULTS] as string | boolean | null);
        }
    }

    /**
     * Returns the configured value as an integer.
     *
     * @param key
     * @returns {number}
     */
    getInt(key: ConfigKey): number {
        const val = this.get(key);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num)
            ? Number.parseInt(
                  String(CONFIG_DEFAULTS[key as keyof typeof CONFIG_DEFAULTS] as string | boolean | null),
                  10
              )
            : num;
    }

    /**
     * Returns the configured value as a float.
     *
     * @param key
     * @returns {number}
     */
    getFloat(key: ConfigKey): number {
        const val = this.get(key);
        const num = Number.parseFloat(val);
        return Number.isNaN(num)
            ? Number.parseFloat(String(CONFIG_DEFAULTS[key as keyof typeof CONFIG_DEFAULTS] as string | boolean | null))
            : num;
    }

    /**
     * Returns the configured value as a boolean.
     *
     * @param key
     * @returns {boolean}
     */
    getBool(key: ConfigKey): boolean {
        return this.get(key) === 'true';
    }
}
