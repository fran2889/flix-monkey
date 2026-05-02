import { UserscriptAdapter } from '../../platform/userscript.js';
import { initConfig } from '../../core/config.js';
import { CONFIG_FIELDS, CONFIG_DEFAULTS } from '../../core/config-fields.js';
import { startApp } from '../../core/app.js';

('use strict');

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
            initConfig(key => {
                try {
                    return GM_config.get(key);
                } catch {
                    return CONFIG_DEFAULTS[key];
                }
            });
            const { api, cache } = startApp(adapter);

            adapter.registerMenuCommand('FlixMonkey Settings', () => GM_config.open());
            adapter.registerMenuCommand('Clear Cache', () => {
                if (confirm('Are you sure you want to clear the FlixMonkey cache?')) {
                    cache.clear().then(() => alert('Cache cleared.'));
                }
            });
            adapter.registerMenuCommand('Reset Disabled Clients', () => {
                if (confirm('Are you sure you want to re-enable all failing API endpoints?')) {
                    api.resetDisabledClients().then(() => alert('All API endpoints have been re-enabled.'));
                }
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
            if (window.fmApi) window.fmApi.resetDisabledClients();
            GM_config.close();
            window.location.reload();
        },
    },
});
