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
import browser from 'webextension-polyfill';
import { PlatformAdapter } from './adapter.js';
import { FlixMonkeyError } from '../core/utils.js';

export class WebExtensionAdapter extends PlatformAdapter {
    #configData = {};

    setConfigData(data) {
        this.#configData = data;
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
        const timeout = options.timeout ?? 10000;
        const fetchPromise = browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new FlixMonkeyError('background relay timeout')), timeout)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (response.error) {
            throw new FlixMonkeyError(response.error, response.status);
        }
        return response.data;
    }

    configGet(key) {
        return this.#configData[key];
    }
}
