/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { startApp } from '../../core/app';
import { CacheManager } from '../../core/cache/index';
import { ConfigManager } from '../../core/config/index';
import { DisabledClientsManager } from '../../core/disabled-clients';
import { Logger } from '../../core/logger';
import { runMigrations } from '../../core/migrations';
import { Modal } from '../../core/ui/modal';
import { SettingsUI } from '../../core/ui/settings-ui';
import { UserscriptAdapter } from '../../platform/userscript';

const adapter = new UserscriptAdapter();
const logger = new Logger(adapter);
let app: import('../../core/app.js').FlixMonkeyApp | null = null;

/**
 * Gets the cache and disabled clients managers, either from the existing app or by creating new instances.
 *
 * @returns cacheManager and disabledClientsManager
 */
function getSettingsDependencies(): {
    cacheManager: CacheManager;
    disabledClientsManager: DisabledClientsManager;
} {
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
function openSettings(): void {
    const { cacheManager, disabledClientsManager } = getSettingsDependencies();
    const modal = new Modal('FlixMonkey Settings');
    const container = modal.getContentContainer();
    const ui = new SettingsUI(adapter, logger, cacheManager, disabledClientsManager);
    ui.render(container).then(() => {
        modal.open();
    });
}

void (async (): Promise<void> => {
    await runMigrations(adapter, logger);
    app = startApp(adapter);
    adapter.registerMenuCommand('FlixMonkey Settings', openSettings);
})();
