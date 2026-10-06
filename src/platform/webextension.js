/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { DEFAULT_FETCH_TIMEOUT } from '../core/constants.js';
import { FlixMonkeyError } from '../core/utils/index.js';
import { PlatformAdapter } from './adapter.js';

/**
 * WebExtension platform adapter using browser.* APIs via polyfill.
 *
 * Uses browser.storage.local for persistence and browser.runtime.sendMessage
 * for CORS-capable HTTP requests via the background service worker.
 */
export class WebExtensionAdapter extends PlatformAdapter {
    #configData = {};
    #configLoaded = false;

    /**
     * Seeds the config snapshot from `browser.storage.local`.
     *
     * Content bootstrap normally calls this before `startApp()`. Until then,
     * `configGet` safely returns `undefined`, so ConfigManager uses defaults.
     * Stores the object reference directly - the same object is mutated in-place
     * by `content.js`'s `storage.onChanged` listener, so `configGet` automatically
     * reflects subsequent storage changes without another `setConfigData` call.
     *
     * @override
     * @param {Record<string, string|boolean>} data - Full contents of `browser.storage.local`.
     */
    setConfigData(data) {
        this.#configData = data;
        this.#configLoaded = true;
    }

    /**
     * Retrieves a single value from browser storage.
     *
     * @override
     * @param {string} key - Storage key.
     * @returns {Promise<string|boolean|null>} The stored value, or `null` if the key does not exist.
     */
    async storageGet(key) {
        const result = await browser.storage.local.get(key);
        return result[key] ?? null;
    }

    /**
     * Retrieves all key/value pairs from browser storage.
     *
     * @override
     * @returns {Promise<Record<string, string|boolean>>} All stored entries.
     */
    async storageGetAll() {
        return await browser.storage.local.get(null);
    }

    /**
     * Stores a single key/value pair in browser storage.
     *
     * @override
     * @param {string} key - Storage key.
     * @param {string|boolean} value - Value to store.
     * @returns {Promise<void>}
     */
    async storageSet(key, value) {
        await browser.storage.local.set({ [key]: value });
    }

    /**
     * Stores multiple key/value pairs atomically in browser storage.
     *
     * @override
     * @param {Record<string, string|boolean>} values - Object of key/value pairs to store.
     * @returns {Promise<void>}
     */
    async storageSetMany(values) {
        await browser.storage.local.set(values);
    }

    /**
     * Removes a single key from browser storage.
     *
     * @override
     * @param {string} key - Storage key to delete.
     * @returns {Promise<void>}
     */
    async storageDelete(key) {
        await browser.storage.local.remove(key);
    }

    /**
     * Returns all storage keys that start with the given prefix.
     *
     * @override
     * @param {string} prefix - Key prefix to match.
     * @returns {Promise<string[]>} Matching keys.
     */
    async storageGetKeys(prefix) {
        const all = await browser.storage.local.get(null);
        return Object.keys(all).filter(key => key.startsWith(prefix));
    }

    /**
     * Makes an HTTP request through the background service worker.
     * Platform HTTP failures reported by implementations reject with a
     * FlixMonkeyError that includes request failure details.
     *
     * @override
     * @param {string} url - Request URL.
     * @param {object} [options] - Fetch options.
     * @param {number} [options.timeout] - Request timeout in milliseconds.
     * @returns {Promise<unknown>} Parsed response body (JSON object or string).
     */
    async httpFetch(url, options = {}) {
        const timeout = options.timeout ?? DEFAULT_FETCH_TIMEOUT;
        const fetchPromise = browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });

        let timerId;
        const timeoutPromise = new Promise((_, reject) => {
            timerId = setTimeout(() => reject(new FlixMonkeyError('background relay timeout', url)), timeout);
        });

        try {
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            if (!response) throw new FlixMonkeyError('empty background response', url);
            if (response.error) {
                throw new FlixMonkeyError(response.error, url, response.status, response.body ?? null);
            }
            return response.data;
        } finally {
            clearTimeout(timerId);
        }
    }

    /**
     * Reads from the snapshot set by `setConfigData`. Before that call,
     * returns `undefined`, which ConfigManager treats as an absent setting.
     *
     * @override
     * @param {string} key - Config key.
     * @returns {string|boolean|undefined} The current config value, or `undefined` if absent.
     */
    configGet(key) {
        if (!this.#configLoaded) return undefined;
        return this.#configData[key];
    }
}
