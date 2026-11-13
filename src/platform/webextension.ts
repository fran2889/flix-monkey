/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { DEFAULT_FETCH_TIMEOUT } from '../core/constants';
import { isRecord } from '../core/parse-utils';
import { FlixMonkeyError } from '../core/utils/index';
import type { HttpFetchOptions, StorageValue } from './adapter';
import { isStorageValue, PlatformAdapter } from './adapter';

/**
 * Type for the fetch response from the background service worker.
 */
interface FetchResponse {
    error?: string;
    status?: number;
    body?: string | undefined;
    data?: unknown;
}

/**
 * WebExtension platform adapter using browser.* APIs via polyfill.
 *
 * Uses browser.storage.local for persistence and browser.runtime.sendMessage
 * for CORS-capable HTTP requests via the background service worker.
 */
export class WebExtensionAdapter extends PlatformAdapter {
    #configData?: Record<string, StorageValue>;

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
     * @param data - Full contents of `browser.storage.local`.
     */
    override setConfigData(data: Record<string, StorageValue>): void {
        this.#configData = data;
    }

    /**
     * Retrieves a single value from browser storage.
     *
     * @override
     * @param key - Storage key.
     * @returns The stored value, or `undefined` if the key does not exist.
     */
    override async storageGet(key: string): Promise<StorageValue | undefined> {
        const result: unknown = await browser.storage.local.get(key);
        if (!isRecord(result)) return undefined;
        const value: unknown = result[key];
        return isStorageValue(value) ? value : undefined;
    }

    /**
     * Retrieves all key/value pairs from browser storage.
     *
     * @override
     * @returns All stored entries.
     */
    override async storageGetAll(): Promise<Record<string, StorageValue>> {
        const stored: unknown = await browser.storage.local.get(null);
        if (!isRecord(stored)) return {};
        const values: Record<string, StorageValue> = {};
        for (const [key, value] of Object.entries(stored)) {
            if (isStorageValue(value)) values[key] = value;
        }
        return values;
    }

    /**
     * Stores a single key/value pair in browser storage.
     *
     * @override
     * @param key - Storage key.
     * @param value - Value to store.
     * @returns Resolves when the value is stored.
     */
    override async storageSet(key: string, value: StorageValue): Promise<void> {
        await browser.storage.local.set({ [key]: value });
    }

    /**
     * Stores multiple key/value pairs atomically in browser storage.
     *
     * @override
     * @param values - Object of key/value pairs to store.
     * @returns Resolves when all values are stored.
     */
    override async storageSetMany(values: Record<string, StorageValue>): Promise<void> {
        await browser.storage.local.set(values);
    }

    /**
     * Removes a single key from browser storage.
     *
     * @override
     * @param key - Storage key to delete.
     * @returns Resolves when the value is removed.
     */
    override async storageDelete(key: string): Promise<void> {
        await browser.storage.local.remove(key);
    }

    /**
     * Returns all storage keys that start with the given prefix.
     *
     * @override
     * @param prefix - Key prefix to match.
     * @returns Matching keys.
     */
    override async storageGetKeys(prefix: string): Promise<string[]> {
        const all = await browser.storage.local.get(null);
        return Object.keys(all).filter(key => key.startsWith(prefix));
    }

    /**
     * Makes an HTTP request through the background service worker.
     * Platform HTTP failures reported by implementations reject with a
     * FlixMonkeyError that includes request failure details.
     *
     * @override
     * @param url - Request URL.
     * @param options - Fetch options.
     * @returns Parsed response body (JSON object or string).
     */
    override async httpFetch(url: string, options: HttpFetchOptions = {}): Promise<unknown> {
        const timeout = options.timeout ?? DEFAULT_FETCH_TIMEOUT;
        const fetchPromise = browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });

        let timerId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timerId = setTimeout(() => reject(new FlixMonkeyError('background relay timeout', url)), timeout);
        });

        try {
            const response: unknown = await Promise.race([fetchPromise, timeoutPromise]);
            if (!isFetchResponse(response)) {
                throw new FlixMonkeyError('empty background response', url);
            }
            if (response.error) {
                throw new FlixMonkeyError(response.error, url, response.status, response.body);
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
     * @param key - Config key.
     * @returns The current config value, or `undefined` if absent.
     */
    override configGet(key: string): StorageValue | undefined {
        return this.#configData?.[key];
    }
}

function isFetchResponse(value: unknown): value is FetchResponse {
    if (!isRecord(value)) return false;
    const error = value['error'];
    const status = value['status'];
    const body = value['body'];
    return (
        (error === undefined || typeof error === 'string') &&
        (status === undefined || typeof status === 'number') &&
        (body === undefined || typeof body === 'string')
    );
}
