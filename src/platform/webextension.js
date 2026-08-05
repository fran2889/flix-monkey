/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { DEFAULT_FETCH_TIMEOUT } from '../core/constants.js';
import { FlixMonkeyError } from '../core/utils.js';
import { PlatformAdapter } from './adapter.js';

export class WebExtensionAdapter extends PlatformAdapter {
    #configData = {};
    #configLoaded = false;

    /**
     * Seeds the config snapshot from `browser.storage.local`.
     *
     * Must be called before `startApp()`. Stores the object reference directly - the
     * same object is mutated in-place by `content.js`'s `storage.onChanged` listener,
     * so `configGet` automatically reflects subsequent storage changes without needing
     * another `setConfigData` call.
     *
     * @override
     * @param {Record<string, string|boolean>} data - Full contents of `browser.storage.local`.
     */
    setConfigData(data) {
        this.#configData = data;
        this.#configLoaded = true;
    }

    async storageGet(key) {
        const result = await browser.storage.local.get(key);
        return result[key] ?? null;
    }

    async storageGetAll() {
        return await browser.storage.local.get(null);
    }

    async storageSet(key, value) {
        await browser.storage.local.set({ [key]: value });
    }

    async storageSetMany(values) {
        await browser.storage.local.set(values);
    }

    async storageDelete(key) {
        await browser.storage.local.remove(key);
    }

    async storageGetKeys(prefix) {
        const all = await browser.storage.local.get(null);
        return Object.keys(all).filter(key => key.startsWith(prefix));
    }

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
     * Reads a config value from the in-memory snapshot.
     *
     * Returns `undefined` until `setConfigData()` has been called; `ConfigManager` treats
     * `undefined` as absent and falls back to `CONFIG_DEFAULTS`, so early reads are safe.
     *
     * @override
     * @param {string} key - Config key.
     * @returns {string|boolean|undefined}
     */
    configGet(key) {
        if (!this.#configLoaded) return undefined;
        return this.#configData[key];
    }
}
