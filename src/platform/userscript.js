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

const HTTP_TIMEOUT = 8000;
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

export class UserscriptAdapter extends PlatformAdapter {
    async storageGet(key) {
        return GM_getValue(key) ?? null;
    }

    async storageSet(key, value) {
        GM_setValue(key, value);
    }

    async httpFetch(url, { responseType = 'json', timeout = HTTP_TIMEOUT } = {}) {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                headers: {
                    'User-Agent': ua,
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
                        reject(Object.assign(new Error(`HTTP ${status}`), { status }));
                    }
                },
                onerror: () => reject(new Error('network error')),
                ontimeout: () => reject(new Error('timeout')),
            });
        });
    }

    registerMenuCommand(label, fn) {
        GM_registerMenuCommand(label, fn);
    }
}
