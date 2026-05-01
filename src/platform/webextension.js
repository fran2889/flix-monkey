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
}
