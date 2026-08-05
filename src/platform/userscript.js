/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DEFAULT_FETCH_TIMEOUT } from '../core/constants.js';
import { FlixMonkeyError } from '../core/utils.js';
import { PlatformAdapter } from './adapter.js';

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
    configGet(key) {
        return GM_getValue(key);
    }

    registerMenuCommand(label, fn) {
        GM_registerMenuCommand(label, fn);
    }
}
