/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DEFAULT_FETCH_TIMEOUT } from '../core/constants.js';
import { FlixMonkeyError } from '../core/utils/index.js';
import { PlatformAdapter } from './adapter.js';

/** Userscript platform adapter using GM_* APIs. */
export class UserscriptAdapter extends PlatformAdapter {
    /**
     * Retrieves a value from GM storage.
     *
     * @param {string} key - Storage key to read.
     * @returns {Promise<unknown>} Stored value, or null when the key is absent.
     */
    async storageGet(key) {
        return GM_getValue(key) ?? null;
    }

    /**
     * Retrieves all key-value pairs from GM storage.
     *
     * @returns {Promise<object>} Every stored key mapped to its value.
     */
    async storageGetAll() {
        const keys = GM_listValues();
        const all = {};
        for (const key of keys) {
            all[key] = GM_getValue(key);
        }
        return all;
    }

    /**
     * Stores a value in GM storage.
     *
     * @param {string} key - Storage key to write.
     * @param {unknown} value - Value to persist.
     */
    async storageSet(key, value) {
        GM_setValue(key, value);
    }

    /**
     * Stores multiple key-value pairs in GM storage.
     *
     * @param {object} values - Keys mapped to the values to persist.
     */
    async storageSetMany(values) {
        for (const [key, value] of Object.entries(values)) {
            GM_setValue(key, value);
        }
    }

    /**
     * Removes a value from GM storage.
     *
     * @param {string} key - Storage key to delete.
     */
    async storageDelete(key) {
        GM_deleteValue(key);
    }

    /**
     * Retrieves all storage keys matching the given prefix.
     *
     * @param {string} prefix - Leading string the key must start with.
     * @returns {Promise<string[]>} Matching keys, in storage order.
     */
    async storageGetKeys(prefix) {
        const keys = GM_listValues();
        return keys.filter(key => key.startsWith(prefix));
    }

    /**
     * Makes HTTP request using GM_xmlhttpRequest.
     *
     * @param {string} url - Absolute URL to request.
     * @param {object} options - Request options.
     * @param {'json'|'text'} [options.responseType='json'] - How the response body is parsed.
     * @param {number} [options.timeout=DEFAULT_FETCH_TIMEOUT] - Milliseconds before the request is aborted.
     * @returns {Promise<unknown>} Parsed response body, or the raw text for `responseType: 'text'`.
     */
    async httpFetch(url, { responseType = 'json', timeout = DEFAULT_FETCH_TIMEOUT } = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout,
                onload: r => {
                    const { status, response, responseText } = r;
                    if (status >= 200 && status < 300) {
                        if (responseType === 'json') {
                            resolve(response ?? JSON.parse(responseText));
                        } else {
                            resolve(responseText);
                        }
                    } else {
                        const body = responseText ? responseText.slice(0, 200) : null;
                        reject(new FlixMonkeyError(`HTTP ${status}`, url, status, body));
                    }
                },
                onerror: () => reject(new FlixMonkeyError('network error', url)),
                ontimeout: () => reject(new FlixMonkeyError('timeout', url)),
            });
        });
    }

    /*
     * Live-read model: GM_getValue always returns the current persisted value, so no snapshot
     * or setConfigData() call is needed. Config changes take effect on the next page reload
     * (see entry.js) because stateful app objects don't auto-reinitialize mid-session.
     */
    /**
     * Retrieves configuration value (live-read from GM storage).
     *
     * @param {string} key - Config key defined in `CONFIG_FIELDS`.
     * @returns {unknown} Stored value, or undefined when the key is absent.
     */
    configGet(key) {
        return GM_getValue(key);
    }

    /**
     * Registers a menu command in the userscript manager UI.
     *
     * @param {string} label - Menu entry text shown to the user.
     * @param {() => void} fn - Callback invoked when the entry is selected.
     */
    registerMenuCommand(label, fn) {
        GM_registerMenuCommand(label, fn);
    }
}
