/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DEFAULT_FETCH_TIMEOUT } from '../core/constants.js';
import { FlixMonkeyError } from '../core/utils/index.js';
import { HttpFetchOptions, PlatformAdapter, StorageValue } from './adapter.js';

/**
 * Type declaration for GM_xmlhttpRequest options.
 */
interface GMXmlHttpRequestOptions {
    method: string;
    url: string;
    responseType: 'json' | 'text';
    headers?: Record<string, string>;
    timeout: number;
    onload: (_response: { status: number; response?: unknown; responseText: string }) => void;
    onerror: () => void;
    ontimeout: () => void;
}

/**
 * Type declaration for GM_xmlhttpRequest function.
 */
declare function GM_xmlhttpRequest(_options: GMXmlHttpRequestOptions): void;

/**
 * Type declaration for GM_getValue function.
 */
declare function GM_getValue(_key: string): StorageValue | undefined;

/**
 * Type declaration for GM_setValue function.
 */
declare function GM_setValue(_key: string, _value: StorageValue): void;

/**
 * Type declaration for GM_deleteValue function.
 */
declare function GM_deleteValue(_key: string): void;

/**
 * Type declaration for GM_listValues function.
 */
declare function GM_listValues(): string[];

/**
 * Type declaration for GM_registerMenuCommand function.
 */
declare function GM_registerMenuCommand(_label: string, _fn: () => void): void;

/**
 * Userscript platform adapter using GM_* APIs.
 */
export class UserscriptAdapter extends PlatformAdapter {
    /**
     * Retrieves a value from GM storage.
     *
     * @param key - Storage key.
     * @returns {Promise<StorageValue | null>} The stored value, or `null` if the key does not exist.
     */
    async storageGet(key: string): Promise<StorageValue | null> {
        return GM_getValue(key) ?? null;
    }

    /**
     * Retrieves all key-value pairs from GM storage.
     *
     * @returns {Promise<Record<string, StorageValue>>} All stored entries.
     */
    async storageGetAll(): Promise<Record<string, StorageValue>> {
        const keys = GM_listValues();
        const all: Record<string, StorageValue> = {};
        for (const key of keys) {
            const value = GM_getValue(key);
            if (value !== undefined) {
                all[key] = value;
            }
        }
        return all;
    }

    /**
     * Stores a value in GM storage.
     *
     * @param key - Storage key.
     * @param value - Value to store.
     * @returns {Promise<void>}
     */
    async storageSet(key: string, value: StorageValue): Promise<void> {
        GM_setValue(key, value);
    }

    /**
     * Stores multiple key-value pairs in GM storage.
     *
     * @param values - Object of key/value pairs to store.
     * @returns {Promise<void>}
     */
    async storageSetMany(values: Record<string, StorageValue>): Promise<void> {
        for (const [key, value] of Object.entries(values)) {
            GM_setValue(key, value);
        }
    }

    /**
     * Removes a value from GM storage.
     *
     * @param key - Storage key to delete.
     * @returns {Promise<void>}
     */
    async storageDelete(key: string): Promise<void> {
        GM_deleteValue(key);
    }

    /**
     * Retrieves all storage keys matching the given prefix.
     *
     * @param prefix - Key prefix to match.
     * @returns {Promise<string[]>} Matching keys.
     */
    async storageGetKeys(prefix: string): Promise<string[]> {
        const keys = GM_listValues();
        return keys.filter((key: string) => key.startsWith(prefix));
    }

    /**
     * Makes HTTP request using GM_xmlhttpRequest.
     * Platform HTTP failures reported by implementations reject with a
     * FlixMonkeyError that includes request failure details.
     *
     * @param url - Request URL.
     * @param options - Fetch options.
     * @returns {Promise<unknown>} Parsed response body (JSON object or string).
     */
    async httpFetch(url: string, options: HttpFetchOptions = {}): Promise<unknown> {
        const { responseType = 'json', timeout = DEFAULT_FETCH_TIMEOUT } = options;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout,
                onload: (r: { status: number; response?: unknown; responseText: string }) => {
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
                        return;
                    }
                },
                onerror: () => {
                    reject(new FlixMonkeyError('network error', url));
                },
                ontimeout: () => {
                    reject(new FlixMonkeyError('timeout', url));
                },
            });
        });
    }

    /**
     * Live-read model: GM_getValue always returns the current persisted value, so no snapshot
     * or setConfigData() call is needed. Config changes take effect on the next page reload
     * (see entry.js) because stateful app objects don't auto-reinitialize mid-session.
     *
     * Retrieves configuration value (live-read from GM storage).
     *
     * @param key - Config key.
     * @returns {string | boolean | undefined} The current config value, or `undefined` if absent.
     */
    configGet(key: string): string | boolean | undefined {
        return GM_getValue(key) as string | boolean | undefined;
    }

    /**
     * Registers a menu command in the userscript manager UI.
     *
     * @param label - Menu label.
     * @param fn - Function to call when menu command is clicked.
     */
    registerMenuCommand(label: string, fn: () => void): void {
        GM_registerMenuCommand(label, fn);
    }
}
