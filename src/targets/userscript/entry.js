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
import { UserscriptAdapter } from '../../platform/userscript.js';
import { startApp } from '../../core/app.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { Modal } from '../../core/ui/modal.js';

const adapter = new UserscriptAdapter();
const app = startApp(adapter);

const { cacheManager, disabledManager: disabledClientsManager } = app;

adapter.registerMenuCommand('FlixMonkey Settings', () => {
    const modal = new Modal('FlixMonkey Settings');
    const container = modal.getContentContainer();
    const ui = new SettingsUI(adapter, undefined, cacheManager, disabledClientsManager);
    ui.onSave = () => {
        modal.close();
        window.location.reload();
    };
    ui.render(container).then(() => {
        modal.open();
    });
});

adapter.registerMenuCommand('Clear Cache', async () => {
    if (confirm('Are you sure you want to clear the FlixMonkey cache?')) {
        await app.clearCache();
        alert('Cache cleared.');
    }
});

adapter.registerMenuCommand('Reset Disabled Clients', async () => {
    const reenabled = await app.resetDisabledClients();
    if (reenabled.length > 0) {
        alert(`Re-enabled API clients: ${reenabled.join(', ')}`);
    } else {
        alert('No disabled API clients found to re-enable.');
    }
});
