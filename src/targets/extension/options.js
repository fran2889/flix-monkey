/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { CacheManager } from '../../core/cache.js';
import { ConfigManager } from '../../core/config-manager.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';
import { Logger } from '../../core/logger.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { WebExtensionAdapter } from '../../platform/webextension.js';

const adapter = new WebExtensionAdapter();
const logger = new Logger(adapter);
const config = new ConfigManager(adapter, logger);
const cacheManager = new CacheManager(adapter, config, logger);
const disabledClientsManager = new DisabledClientsManager(adapter);

const ui = new SettingsUI(adapter, undefined, cacheManager, disabledClientsManager);
ui.onSave = async () => {
    const tabs = await browser.tabs.query({
        url: ['*://*.netflix.com/*', '*://play.hbomax.com/*', '*://www.disneyplus.com/*'],
    });
    await Promise.all(tabs.map(tab => browser.tabs.reload(tab.id)));
};
ui.render(document.body);
