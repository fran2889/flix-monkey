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
import { startApp } from '../../core/app.js';
import { CacheManager } from '../../core/cache.js';
import { ConfigManager } from '../../core/config-manager.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';
import { Logger } from '../../core/logger.js';
import { Modal } from '../../core/ui/modal.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { UserscriptAdapter } from '../../platform/userscript.js';

const adapter = new UserscriptAdapter();
const app = startApp(adapter);

function getSettingsDependencies() {
    if (app) {
        return {
            cacheManager: app.cacheManager,
            disabledClientsManager: app.disabledManager,
        };
    }
    const logger = new Logger(adapter);
    const config = new ConfigManager(adapter, logger);
    return {
        cacheManager: new CacheManager(adapter, config, logger),
        disabledClientsManager: new DisabledClientsManager(adapter),
    };
}

adapter.registerMenuCommand('FlixMonkey Settings', () => {
    const { cacheManager, disabledClientsManager } = getSettingsDependencies();
    const modal = new Modal('FlixMonkey Settings');
    const container = modal.getContentContainer();
    const ui = new SettingsUI(adapter, undefined, cacheManager, disabledClientsManager);
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
});
