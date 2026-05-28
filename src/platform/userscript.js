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
import { PlatformAdapter } from './adapter.js';
import { FlixMonkeyError } from '../core/utils.js';

const HTTP_TIMEOUT = 8000;

export class UserscriptAdapter extends PlatformAdapter {
    async storageGet(key) {
        return GM_getValue(key) ?? null;
    }

    async storageGetAll() {
        const keys = GM_listValues();
        const all = {};
        for (const key of keys) {
            all[key] = GM_getValue(key);
        }
        return all;
    }

    async storageSet(key, value) {
        GM_setValue(key, value);
    }

    async storageSetMany(values) {
        for (const [key, value] of Object.entries(values)) {
            GM_setValue(key, value);
        }
    }

    async storageDelete(key) {
        GM_deleteValue(key);
    }

    async storageGetKeys(prefix) {
        const keys = GM_listValues();
        return keys.filter(key => key.startsWith(prefix));
    }

    async httpFetch(url, { responseType = 'json', timeout = HTTP_TIMEOUT } = {}) {
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
                        reject(new FlixMonkeyError(`HTTP ${status}`, status));
                    }
                },
                onerror: () => reject(new FlixMonkeyError('network error')),
                ontimeout: () => reject(new FlixMonkeyError('timeout')),
            });
        });
    }

    registerMenuCommand(label, fn) {
        GM_registerMenuCommand(label, fn);
    }

    configGet(key) {
        return GM_getValue(key);
    }
}
