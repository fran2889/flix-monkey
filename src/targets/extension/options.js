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
import { WebExtensionAdapter } from '../../platform/webextension.js';
import { Logger } from '../../core/logger.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { ConfigManager } from '../../core/config-manager.js';
import { CacheManager } from '../../core/cache.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';

const adapter = new WebExtensionAdapter();
const logger = new Logger(adapter);
const config = new ConfigManager(adapter, logger);
const cacheManager = new CacheManager(adapter, config, logger);
const disabledClientsManager = new DisabledClientsManager(adapter);

const ui = new SettingsUI(adapter, undefined, cacheManager, disabledClientsManager);
ui.onSave = async () => {
    const tabs = await browser.tabs.query({ url: '*://*.netflix.com/*' });
    await Promise.all(tabs.map(tab => browser.tabs.reload(tab.id)));
    window.close();
};
ui.render(document.body);
