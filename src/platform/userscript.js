import { PlatformAdapter } from './adapter.js';
import { USER_AGENTS, HTTP_TIMEOUT } from '../core/constants.js';

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
