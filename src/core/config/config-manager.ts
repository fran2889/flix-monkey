/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { Logger } from '../logger';
import { FlixMonkeyError } from '../utils/index';
import { CONFIG_DEFAULTS, CONFIG_SELECT_ALLOWED, type SettingKey } from './config-fields';

/** Key of a user-configurable setting. Action-only fields are not settings and are excluded. */
export type ConfigKey = SettingKey;

/**
 * Manages application configuration with fallback to defaults and type conversion utilities.
 */
export class ConfigManager {
    readonly #adapter: PlatformAdapter;
    readonly #logger: Logger;

    /**
     * @param adapter - Platform adapter used for configuration reads.
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
            const defaultValue = String(CONFIG_DEFAULTS[key]);
            if (val === undefined || val === null) return defaultValue;
            const normalizedVal = String(val);
            const allowed = CONFIG_SELECT_ALLOWED[key] as string[] | undefined;
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
     * @param key - Configuration key to read as an integer.
     * @returns Parsed integer value, or the default when the value is invalid.
     */
    getInt(key: ConfigKey): number {
        const val = this.get(key);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? Number.parseInt(String(CONFIG_DEFAULTS[key]), 10) : num;
    }

    /**
     * Returns the configured value as a float.
     *
     * @param key - Configuration key to read as a float.
     * @returns Parsed float value, or the default when the value is invalid.
     */
    getFloat(key: ConfigKey): number {
        const val = this.get(key);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? Number.parseFloat(String(CONFIG_DEFAULTS[key])) : num;
    }

    /**
     * Returns the configured value as a boolean.
     *
     * @param key - Configuration key to read as a boolean.
     * @returns True when the configured value is the string "true".
     */
    getBool(key: ConfigKey): boolean {
        return this.get(key) === 'true';
    }
}
