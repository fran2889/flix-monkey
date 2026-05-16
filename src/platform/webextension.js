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

export class WebExtensionAdapter extends PlatformAdapter {
    async storageGet(key) {
        const result = await browser.storage.local.get(key);
        return result[key] ?? null;
    }

    async storageSet(key, value) {
        await browser.storage.local.set({ [key]: value });
    }

    async httpFetch(url, options = {}) {
        const response = await browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });
        if (response.error) {
            throw Object.assign(new Error(response.error), { status: response.status });
        }
        return response.data;
    }

    registerMenuCommand(_label, _fn) {
        // No-op for web extensions
    }
}
