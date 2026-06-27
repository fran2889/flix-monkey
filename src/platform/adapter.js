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
import { FlixMonkeyError } from '../core/utils.js';

/**
 * @typedef {Object} HttpFetchOptions
 * @property {'json'|'text'} [responseType='json'] - Expected response format.
 */

/**
 * Abstract base class for platform adapters.
 *
 * Subclasses must implement all abstract methods. Optional methods default to
 * no-ops and may be overridden where the platform supports them.
 *
 * @abstract
 */
export class PlatformAdapter {
    /**
     * Retrieves a single value from platform storage.
     *
     * @abstract
     * @param {string} _key - Storage key.
     * @returns {Promise<string|null>} The stored value, or `null` if the key does not exist.
     */
    async storageGet(_key) {
        throw new FlixMonkeyError('PlatformAdapter: storageGet() must be implemented by subclass');
    }

    /**
     * Retrieves all key/value pairs from platform storage.
     *
     * @abstract
     * @returns {Promise<Record<string, string>>} All stored entries.
     */
    async storageGetAll() {
        throw new FlixMonkeyError('PlatformAdapter: storageGetAll() must be implemented by subclass');
    }

    /**
     * Stores a single key/value pair in platform storage.
     *
     * @abstract
     * @param {string} _key - Storage key.
     * @param {string} _value - Value to store.
     * @returns {Promise<void>}
     */
    async storageSet(_key, _value) {
        throw new FlixMonkeyError('PlatformAdapter: storageSet() must be implemented by subclass');
    }

    /**
     * Stores multiple key/value pairs atomically in platform storage.
     *
     * @abstract
     * @param {Record<string, string>} _values - Object of key/value pairs to store.
     * @returns {Promise<void>}
     */
    async storageSetMany(_values) {
        throw new FlixMonkeyError('PlatformAdapter: storageSetMany() must be implemented by subclass');
    }

    /**
     * Removes a single key from platform storage.
     *
     * @abstract
     * @param {string} _key - Storage key to delete.
     * @returns {Promise<void>}
     */
    async storageDelete(_key) {
        throw new FlixMonkeyError('PlatformAdapter: storageDelete() must be implemented by subclass');
    }

    /**
     * Returns all storage keys that start with the given prefix.
     *
     * @abstract
     * @param {string} _prefix - Key prefix to match.
     * @returns {Promise<string[]>} Matching keys.
     */
    async storageGetKeys(_prefix) {
        throw new FlixMonkeyError('PlatformAdapter: storageGetKeys() must be implemented by subclass');
    }

    /**
     * Makes an HTTP request via the platform mechanism (GM_xmlhttpRequest or
     * background-script fetch proxy).
     *
     * @abstract
     * @param {string} _url - Request URL.
     * @param {HttpFetchOptions} [_options] - Fetch options.
     * @returns {Promise<*>} Parsed response body (JSON object or string, depending on `responseType`).
     */
    async httpFetch(_url, _options) {
        throw new FlixMonkeyError('PlatformAdapter: httpFetch() must be implemented by subclass');
    }

    /**
     * Synchronously reads a configuration value.
     *
     * @abstract
     * @param {string} _key - Config key (one of the keys defined in `CONFIG_FIELDS`).
     * @returns {string|boolean} The current config value.
     */
    configGet(_key) {
        throw new FlixMonkeyError('PlatformAdapter: configGet() must be implemented by subclass');
    }

    /**
     * Registers a menu command in the platform UI (e.g. Tampermonkey menu).
     * No-op by default; only `UserscriptAdapter` overrides this.
     *
     * @param {string} _label - Menu item label.
     * @param {Function} _fn - Callback invoked when the menu item is selected.
     */
    registerMenuCommand(_label, _fn) {
        // No-op by default
    }

    /**
     * Pre-loads configuration data into the adapter.
     * No-op by default; `WebExtensionAdapter` overrides this to seed config
     * from `browser.storage` before the app starts.
     *
     * @param {Record<string, string|boolean>} _data - Config key/value pairs.
     */
    setConfigData(_data) {}
}
