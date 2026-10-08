/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { startApp } from '../../core/app.js';
import { CacheManager } from '../../core/cache/index.js';
import { ConfigManager } from '../../core/config/index.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';
import { Logger } from '../../core/logger.js';
import { runMigrations } from '../../core/migrations.js';
import { Modal } from '../../core/ui/modal.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { UserscriptAdapter } from '../../platform/userscript.js';

const adapter = new UserscriptAdapter();
const logger = new Logger(adapter);
let app = null;

/**
 * Gets the cache and disabled clients managers, either from the existing app or by creating new instances.
 *
 * @returns {{cacheManager: import('../../core/cache/index.js').CacheManager, disabledClientsManager: import('../../core/disabled-clients.js').DisabledClientsManager}} Managers shared with the settings UI.
 */
function getSettingsDependencies() {
    if (app) {
        return {
            cacheManager: app.cacheManager,
            disabledClientsManager: app.disabledManager,
        };
    }
    const config = new ConfigManager(adapter, logger);
    return {
        cacheManager: new CacheManager(adapter, config, logger),
        disabledClientsManager: new DisabledClientsManager(adapter),
    };
}

/**
 * Opens the FlixMonkey settings modal with all configuration options.
 */
function openSettings() {
    const { cacheManager, disabledClientsManager } = getSettingsDependencies();
    const modal = new Modal('FlixMonkey Settings');
    const container = modal.getContentContainer();
    const ui = new SettingsUI(adapter, logger, cacheManager, disabledClientsManager);
    ui.render(container).then(() => {
        modal.open();
    });
}

void (async () => {
    await runMigrations(adapter, logger);
    app = startApp(adapter);
    adapter.registerMenuCommand('FlixMonkey Settings', openSettings);
})();
