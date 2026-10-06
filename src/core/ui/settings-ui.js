/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CONFIG_FIELDS } from '../config/index.js';
import { SettingsView } from './settings-view.js';

/**
 * Manages the settings UI, handling rendering, saving, and interactions.
 */
export class SettingsUI {
    #adapter;
    #cacheManager;
    #disabledClientsManager;
    #view;
    #logger;

    /**
     * Creates a new SettingsUI instance.
     *
     * @param {import('../../platform/adapter.js').PlatformAdapter} adapter - Platform storage adapter.
     * @param {import('../logger.js').Logger} logger - Logger for error reporting.
     * @param {import('../cache/').CacheManager} cacheManager - Cache manager for clearing data.
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledClientsManager - Manager for disabled API clients.
     * @param {typeof CONFIG_FIELDS} [fields=CONFIG_FIELDS] - Configuration field definitions.
     */
    constructor(adapter, logger, cacheManager, disabledClientsManager, fields = CONFIG_FIELDS) {
        this.#adapter = adapter;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
        this.#logger = logger;
        this.#view = new SettingsView(fields, {
            onSave: () => this.save(),
            onClearCache: () => this.#clearCache(),
            onResetClients: () => this.#resetClients(),
        });
    }

    /**
     * Renders the settings view into the provided container with current settings.
     *
     * @param {HTMLElement} container - DOM element to render settings into.
     */
    async render(container) {
        const settings = (await this.#adapter.storageGetAll()) || {};
        this.#view.render(container, settings);
    }

    /**
     * Saves the current settings values to storage after validation.
     */
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

    async #clearCache() {
        try {
            await this.#cacheManager.clear();
            this.#view.showStatus('Cache cleared.', 'success');
        } catch (err) {
            this.#view.showStatus(`Error: ${err.message}`, 'error');
        }
    }

    async #resetClients() {
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
