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
    #logger;

    /**
     * @param {import('../../platform/adapter.js').PlatformAdapter} adapter
     * @param {import('../cache.js').CacheManager} cacheManager
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledClientsManager
     * @param {import('../logger.js').Logger} logger
     * @param {typeof CONFIG_FIELDS} [fields=CONFIG_FIELDS]
     */
    constructor(adapter, cacheManager, disabledClientsManager, logger, fields = CONFIG_FIELDS) {
        this.#adapter = adapter;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
        this.#logger = logger;
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
        try {
            const values = this.#view.readValues();
            const errors = this.#view.validate(values);
            if (errors.length > 0) {
                this.#view.showStatus(errors.join('\n'), 'error');
                return;
            }

            await this.#adapter.storageSetMany(values);
        } catch (err) {
            this.#logger.error('Settings save error:', err);
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
}
