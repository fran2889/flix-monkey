import browser from 'webextension-polyfill';
import { WebExtensionAdapter } from '../../platform/webextension.js';
import { initConfig } from '../../core/config.js';
import { CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { startApp } from '../../core/app.js';

(async () => {
    const adapter = new WebExtensionAdapter();
    const stored = await browser.storage.local.get(null);
    initConfig(key => stored[key] ?? CONFIG_DEFAULTS[key]);
    browser.storage.onChanged.addListener(changes => {
        Object.entries(changes).forEach(([k, v]) => {
            stored[k] = v.newValue;
        });
    });
    startApp(adapter);
})();
