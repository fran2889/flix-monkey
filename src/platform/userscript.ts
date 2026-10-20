/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DEFAULT_FETCH_TIMEOUT } from '../core/constants';
import { FlixMonkeyError } from '../core/utils/index';
import type { HttpFetchOptions, StorageValue } from './adapter';
import { PlatformAdapter } from './adapter';

/**
 * Userscript platform adapter using GM_* APIs.
 */
export class UserscriptAdapter extends PlatformAdapter {
    /**
     * Retrieves a value from GM storage.
     *
     * @param key - Storage key.
     * @returns The stored value, or `undefined` if the key does not exist.
     */
    override async storageGet(key: string): Promise<StorageValue | undefined> {
        return GM_getValue(key) ?? undefined;
    }

    /**
     * Retrieves all key-value pairs from GM storage.
     *
     * @returns All stored entries.
     */
    override async storageGetAll(): Promise<Record<string, StorageValue>> {
        const keys = GM_listValues();
        const all: Record<string, StorageValue> = {};
        for (const key of keys) {
            const value = GM_getValue<StorageValue>(key);
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
     * @returns Resolves when the value is stored.
     */
    override async storageSet(key: string, value: StorageValue): Promise<void> {
        GM_setValue(key, value);
    }

    /**
     * Stores multiple key-value pairs in GM storage.
     *
     * @param values - Object of key/value pairs to store.
     * @returns Resolves when all values are stored.
     */
    override async storageSetMany(values: Record<string, StorageValue>): Promise<void> {
        for (const [key, value] of Object.entries(values)) {
            GM_setValue(key, value);
        }
    }

    /**
     * Removes a value from GM storage.
     *
     * @param key - Storage key to delete.
     * @returns Resolves when the value is removed.
     */
    override async storageDelete(key: string): Promise<void> {
        GM_deleteValue(key);
    }

    /**
     * Retrieves all storage keys matching the given prefix.
     *
     * @param prefix - Key prefix to match.
     * @returns Matching keys.
     */
    override async storageGetKeys(prefix: string): Promise<string[]> {
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
     * @returns Parsed response body (JSON object or string).
     */
    override async httpFetch(url: string, options: HttpFetchOptions = {}): Promise<unknown> {
        const { responseType = 'json', timeout = DEFAULT_FETCH_TIMEOUT } = options;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: responseType,
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout,
                onload: resp => {
                    const { status, response, responseText } = resp;
                    if (status >= 200 && status < 300) {
                        if (responseType === 'json') {
                            resolve(response ?? JSON.parse(responseText ?? ''));
                        } else {
                            resolve(responseText);
                        }
                    } else {
                        const body = responseText ? responseText.slice(0, 200) : undefined;
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
     * @returns The current config value, or `undefined` if absent.
     */
    override configGet(key: string): string | boolean | undefined {
        return GM_getValue<string | boolean | undefined>(key);
    }

    /**
     * Registers a menu command in the userscript manager UI.
     *
     * @param label - Menu label.
     * @param fn - Function to call when menu command is clicked.
     */
    override registerMenuCommand(label: string, fn: () => void): void {
        GM_registerMenuCommand(label, fn);
    }
}
