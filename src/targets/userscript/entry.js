/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { startApp } from '../../core/app.js';
import { CacheManager } from '../../core/cache.js';
import { ConfigManager } from '../../core/config-manager.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';
import { Logger } from '../../core/logger.js';
import { runMigrations } from '../../core/migrations.js';
import { Modal } from '../../core/ui/modal.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { UserscriptAdapter } from '../../platform/userscript.js';

const adapter = new UserscriptAdapter();
const logger = new Logger(adapter);
let app = null;

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

function openSettings() {
    const { cacheManager, disabledClientsManager } = getSettingsDependencies();
    const modal = new Modal('FlixMonkey Settings');
    const container = modal.getContentContainer();
    const ui = new SettingsUI(adapter, cacheManager, disabledClientsManager);
    /*
     * Full page reload on save: GM_getValue already returns the freshest value, but
     * stateful app objects (ApiClientManager, CacheManager, logger) don't reinitialize
     * mid-session, so a reload is the simplest way to apply all config changes.
     */
    ui.onSave = () => {
        modal.close();
        window.location.reload();
    };
    ui.render(container).then(() => {
        modal.open();
    });
}

void (async () => {
    await runMigrations(adapter, logger);
    app = startApp(adapter);
    adapter.registerMenuCommand('FlixMonkey Settings', openSettings);
})();
