/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CONFIG_FIELDS } from '../config-fields.js';
import { SettingsView } from './settings-view.js';

export class SettingsUI {
    #adapter;
    #cacheManager;
    #disabledClientsManager;
    #view;
    #onSave = null;

    /**
     * @param {import('../../platform/adapter.js').PlatformAdapter} adapter
     * @param {import('../cache.js').CacheManager} cacheManager
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledClientsManager
     * @param {typeof CONFIG_FIELDS} [fields=CONFIG_FIELDS]
     */
    constructor(adapter, cacheManager, disabledClientsManager, fields = CONFIG_FIELDS) {
        this.#adapter = adapter;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
        this.#view = new SettingsView(fields, {
            onSave: () => this.save(),
            onClearCache: () => this.clearCache(),
            onResetClients: () => this.resetClients(),
        });
    }

    async render(container) {
        const settings = (await this.#adapter.storageGetAll()) || {};
        this.#view.render(container, settings);
    }

    async save() {
        const values = this.#view.readValues();
        const errors = this.#view.validate(values);
        if (errors.length > 0) {
            this.#view.showStatus(errors.join('\n'), 'error');
            return;
        }

        this.#view.setSaveDisabled(true);
        try {
            await this.#adapter.storageSetMany(values);
            this.#view.showStatus('Saved!', 'success');
            await this.#onSave?.();
        } finally {
            this.#view.setSaveDisabled(false);
        }
    }

    async clearCache() {
        try {
            await this.#cacheManager.clear();
            this.#view.showStatus('Cache cleared.', 'success');
        } catch (err) {
            this.#view.showStatus(`Error: ${err.message}`, 'error');
        }
    }

    async resetClients() {
        try {
            const reenabled = await this.#disabledClientsManager.resetAll();
            const message =
                reenabled.length > 0
                    ? `Re-enabled API clients: ${reenabled.join(', ')}`
                    : 'No disabled API clients found to re-enable.';
            this.#view.showStatus(message, 'success');
        } catch (err) {
            this.#view.showStatus(`Error: ${err.message}`, 'error');
        }
    }

    get onSave() {
        return this.#onSave;
    }

    set onSave(fn) {
        this.#onSave = fn;
    }
}
