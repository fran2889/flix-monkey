/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../../platform/adapter';
import type { CacheManager } from '../cache/index';
import { CONFIG_FIELDS } from '../config/index';
import type { DisabledClientsManager } from '../disabled-clients';
import type { Logger } from '../logger';
import { type ConfigField, SettingsView } from './settings-view';

/**
 * Manages the settings UI, handling rendering, saving, and interactions.
 */
export class SettingsUI {
    readonly #adapter: PlatformAdapter;
    readonly #cacheManager: CacheManager;
    readonly #disabledClientsManager: DisabledClientsManager;
    readonly #view: SettingsView;
    readonly #logger: Logger;

    /**
     * Creates a new SettingsUI instance.
     *
     * @param adapter - Platform storage adapter.
     * @param logger - Logger for error reporting.
     * @param cacheManager - Cache manager for clearing data.
     * @param disabledClientsManager - Manager for disabled API clients.
     * @param fields - Configuration field definitions.
     */
    constructor(
        adapter: PlatformAdapter,
        logger: Logger,
        cacheManager: CacheManager,
        disabledClientsManager: DisabledClientsManager,
        fields: readonly ConfigField[] = CONFIG_FIELDS as unknown as readonly ConfigField[]
    ) {
        this.#adapter = adapter;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
        this.#logger = logger;
        this.#view = new SettingsView(fields, {
            onSave: async (): Promise<void> => this.save(),
            onClearCache: async (): Promise<void> => this.#clearCache(),
            onResetClients: async (): Promise<void> => this.#resetClients(),
        });
    }

    /**
     * Renders the settings view into the provided container with current settings.
     *
     * @param container - DOM element to render settings into.
     */
    async render(container: HTMLElement): Promise<void> {
        const settings = (await this.#adapter.storageGetAll()) ?? {};
        this.#view.render(container, settings);
    }

    /**
     * Saves the current settings values to storage after validation.
     */
    async save(): Promise<void> {
        try {
            const values = this.#view.readValues();
            const errors = this.#view.validate(values);
            if (errors.length > 0) {
                this.#view.showStatus(errors.join('\n'), 'error');
                return;
            }

            await this.#adapter.storageSetMany(values as Record<string, string | boolean>);
        } catch (err) {
            this.#logger.error('Settings save error:', err);
        }
    }

    async #clearCache(): Promise<void> {
        try {
            await this.#cacheManager.clear();
            this.#view.showStatus('Cache cleared.', 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.#view.showStatus(`Error: ${errorMessage}`, 'error');
        }
    }

    async #resetClients(): Promise<void> {
        try {
            const reenabled = await this.#disabledClientsManager.resetAll();
            const message =
                reenabled.length > 0
                    ? `Re-enabled API clients: ${reenabled.join(', ')}`
                    : 'No disabled API clients found to re-enable.';
            this.#view.showStatus(message, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.#view.showStatus(`Error: ${errorMessage}`, 'error');
        }
    }
}
