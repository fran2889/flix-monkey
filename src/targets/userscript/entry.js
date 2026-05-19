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

('use strict');

const adapter = new UserscriptAdapter();
const { api, cache } = startApp(adapter);

adapter.configGet = async key => await adapter.storageGet(key);

adapter.registerMenuCommand('FlixMonkey Settings', () => {
    const modal = new Modal('FlixMonkey Settings');
    const container = modal.getContentContainer();
    const ui = new SettingsUI(adapter);
    ui.render(container).then(() => {
        modal.open();
    });
});

adapter.registerMenuCommand('Clear Cache', async () => {
    if (confirm('Are you sure you want to clear the FlixMonkey cache?')) {
        await cache.clear();
        alert('Cache cleared.');
    }
});

adapter.registerMenuCommand('Reset Disabled Clients', async () => {
    const reenabled = await api.resetDisabledClients();
    if (reenabled.length > 0) {
        alert(`Re-enabled API clients: ${reenabled.join(', ')}`);
    } else {
        alert('No disabled API clients found to re-enable.');
    }
});
