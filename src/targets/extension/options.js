/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { CacheManager } from '../../core/cache.js';
import { ConfigManager } from '../../core/config-manager.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';
import { Logger } from '../../core/logger.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { WebExtensionAdapter } from '../../platform/webextension.js';

/* NOSONAR: MV3 options bundles are classic IIFE bundles, so top-level await is unavailable. */ (async () => {
    const adapter = new WebExtensionAdapter();
    const migrationResponse = await browser.runtime.sendMessage({ type: 'FM_RUN_MIGRATIONS' });
    if (migrationResponse?.error) throw new Error(migrationResponse.error);

    const logger = new Logger(adapter);
    const config = new ConfigManager(adapter, logger);
    const cacheManager = new CacheManager(adapter, config, logger);
    const disabledClientsManager = new DisabledClientsManager(adapter);

    const ui = new SettingsUI(adapter, cacheManager, disabledClientsManager, logger);
    ui.render(document.body);
})();
