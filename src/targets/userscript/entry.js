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
import { CONFIG_FIELDS, CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { startApp } from '../../core/app.js';

('use strict');

let apiInstance = null;

const adapter = new UserscriptAdapter();

function buildGmConfigFields(fields) {
    const result = {};
    fields.forEach(f => {
        const def = { label: f.label, type: f.type, default: f.default };
        if (f.title) def.title = f.title;
        if (f.options) def.options = f.options;
        result[f.key] = def;
    });
    return result;
}

if (typeof GM_config === 'undefined') {
    window.GM_config = {
        init: () => {},
        get: () => {},
        open: () => {},
        close: () => {},
        save: () => {},
    };
}

GM_config.init({
    id: 'FlixMonkey',
    title: 'FlixMonkey Settings',
    css: `
        body { background-color: #141414 !important; margin: 0 !important; }
        #FlixMonkey_wrapper { display: inline-flex !important; flex-direction: column !important; align-items: stretch !important; background: #141414 !important; color: #fff !important; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; padding: 25px !important; box-sizing: border-box !important; }
        #FlixMonkey_header { color: #e50914 !important; font-size: 24px !important; margin-bottom: 25px !important; font-weight: bold !important; text-align: center !important; width: 100% !important; }
        .config_var { display: flex !important; justify-content: flex-start !important; align-items: center !important; margin-bottom: 12px !important; }
        .field_label { flex: 0 0 200px !important; padding-right: 15px !important; text-align: right !important; color: #ccc !important; font-size: 14px !important; font-weight: normal !important; box-sizing: border-box !important; }
        #FlixMonkey_wrapper input[type="text"], #FlixMonkey_wrapper select { flex: 0 0 220px !important; background: #333 !important; color: #fff !important; border: 1px solid #555 !important; border-radius: 4px !important; padding: 6px 12px !important; outline: none !important; font-size: 14px !important; box-sizing: border-box !important; margin: 0 !important; }
        #FlixMonkey_wrapper input[type="text"]:focus, #FlixMonkey_wrapper select:focus { border-color: #e50914 !important; }
        #FlixMonkey_wrapper input[type="checkbox"] { flex: 0 0 auto !important; width: 16px !important; height: 16px !important; margin: 0 !important; cursor: pointer !important; }
        .reset_holder { position: absolute !important; right: 0 !important; top: 50% !important; transform: translateY(-50%) !important; margin: 0 !important; padding: 0 !important; width: auto !important; }
        #FlixMonkey_resetLink { color: #aaa !important; font-size: 13px !important; text-decoration: none !important; cursor: pointer !important; transition: color 0.2s !important; background: none !important; border: none !important; padding: 0 !important; }
        #FlixMonkey_resetLink:hover { background: none !important; color: #fff !important; text-decoration: underline !important; border: none !important; }
        #FlixMonkey_buttons_holder { position: relative !important; display: flex !important; justify-content: center !important; align-items: center !important; gap: 15px !important; margin-top: 15px !important; width: 100% !important; }
        #FlixMonkey_saveBtn, #FlixMonkey_closeBtn { padding: 8px 20px !important; border: none !important; border-radius: 4px !important; font-size: 14px !important; font-weight: bold !important; cursor: pointer !important; transition: background 0.2s !important; }
        #FlixMonkey_saveBtn { background: #e50914 !important; color: #fff !important; }
        #FlixMonkey_saveBtn:hover { background: #f40612 !important; }
        #FlixMonkey_closeBtn { background: transparent !important; color: #ccc !important; border: 1px solid #555 !important; }
        #FlixMonkey_closeBtn:hover { background: #333 !important; color: #fff !important; }
    `,
    fields: buildGmConfigFields(CONFIG_FIELDS),
    events: {
        init: () => {
            adapter.configGet = key => {
                try {
                    return GM_config.get(key);
                } catch {
                    return CONFIG_DEFAULTS[key];
                }
            };
            const { api, cache } = startApp(adapter);
            apiInstance = api;

            adapter.registerMenuCommand('FlixMonkey Settings', () => GM_config.open());
            adapter.registerMenuCommand('Clear Cache', () => {
                if (confirm('Are you sure you want to clear the FlixMonkey cache?')) {
                    cache.clear().then(() => alert('Cache cleared.'));
                }
            });
            adapter.registerMenuCommand('Reset Disabled Clients', () => {
                api.resetDisabledClients().then(reenabled => {
                    if (reenabled.length > 0) {
                        alert(`Re-enabled API clients: ${reenabled.join(', ')}`);
                    } else {
                        alert('No disabled API clients found to re-enable.');
                    }
                });
            });
        },
        open: function (doc, win, frame) {
            if (frame && doc) {
                const wrapper = doc.getElementById('FlixMonkey_wrapper');
                if (wrapper) {
                    frame.style.width = wrapper.offsetWidth + 'px';
                    frame.style.height = wrapper.offsetHeight + 'px';
                    frame.style.border = '1px solid #333';
                    frame.style.borderRadius = '5px';
                    this.center();
                }
            }
        },
        save: () => {
            if (apiInstance) {
                apiInstance.resetDisabledClients().then(reenabled => {
                    if (reenabled.length > 0) {
                        console.info(`Re-enabled API clients on save: ${reenabled.join(', ')}`);
                    }
                });
            }
            GM_config.close();
            window.location.reload();
        },
    },
});
