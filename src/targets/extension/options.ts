/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import browser from 'webextension-polyfill';

import { CacheManager } from '../../core/cache/index';
import { ConfigManager } from '../../core/config/index';
import { DisabledClientsManager } from '../../core/disabled-clients';
import { Logger } from '../../core/logger';
import { SettingsUI } from '../../core/ui/settings-ui';
import { WebExtensionAdapter } from '../../platform/webextension';

/**
 * Type for migration response from background script.
 */
interface MigrationResponse {
    error?: string;
}

const adapter = new WebExtensionAdapter();
const logger = new Logger(adapter);

/* NOSONAR: MV3 options bundles are classic IIFE bundles, so top-level await is unavailable. */
void (async (): Promise<void> => {
    const migrationResponse: MigrationResponse = await browser.runtime.sendMessage({ type: 'FM_RUN_MIGRATIONS' });
    if (migrationResponse?.error) {
        throw new Error(migrationResponse.error);
    }

    const config = new ConfigManager(adapter, logger);
    const cacheManager = new CacheManager(adapter, config, logger);
    const disabledClientsManager = new DisabledClientsManager(adapter);

    const ui = new SettingsUI(adapter, logger, cacheManager, disabledClientsManager);
    await ui.render(document.body);
})().catch((error: unknown) => {
    logger.error('FlixMonkey options page failed to start', error);
});
