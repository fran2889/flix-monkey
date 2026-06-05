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
import { CONFIG_FIELDS } from '../config-fields.js';
import { SETTINGS_STYLES } from './styles.js';

export class SettingsUI {
    constructor(adapter, fields = CONFIG_FIELDS, cacheManager, disabledClientsManager) {
        this.adapter = adapter;
        this.fields = fields;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
    }

    #cacheManager;
    #disabledClientsManager;

    async render(container) {
        this._injectStyles();
        const settings = (await this.adapter.storageGetAll()) || {};
        this.adapter.setConfigData?.(settings);

        container.className = 'fm-settings-container';
        container.replaceChildren();

        const title = document.createElement('h1');
        title.textContent = 'FlixMonkey Settings';
        container.appendChild(title);

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'fm-fields';
        container.appendChild(fieldsContainer);

        this.fields.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'field';

            const label = document.createElement('label');
            label.className = 'field-label';
            label.textContent = field.label;
            label.title = field.title || '';
            label.htmlFor = `fm-${field.key}`;
            fieldDiv.appendChild(label);

            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.className = 'field-input';
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    if (Array.isArray(opt)) {
                        option.value = opt[0];
                        option.textContent = opt[1];
                    } else {
                        option.value = opt;
                        option.textContent = opt;
                    }
                    input.appendChild(option);
                });
                input.value = settings[field.key] !== undefined ? settings[field.key] : field.default;
            } else if (field.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'field-input';
                input.checked = settings[field.key] !== undefined ? settings[field.key] : field.default;
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'field-input';
                input.value = settings[field.key] !== undefined ? settings[field.key] : field.default;
            }

            input.name = field.key;
            input.id = `fm-${field.key}`;
            fieldDiv.appendChild(input);
            fieldsContainer.appendChild(fieldDiv);
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const saveBtn = document.createElement('button');
        saveBtn.id = 'fm-saveBtn';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => this.save();
        actionsDiv.appendChild(saveBtn);

        const clearBtn = document.createElement('button');
        clearBtn.id = 'fm-clearCacheBtn';
        clearBtn.className = 'secondary';
        clearBtn.textContent = 'Clear Cache';
        clearBtn.onclick = () => this.clearCache();
        actionsDiv.appendChild(clearBtn);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'fm-resetClientsBtn';
        resetBtn.className = 'secondary';
        resetBtn.textContent = 'Reset Disabled Clients';
        resetBtn.onclick = () => this.resetClients();
        actionsDiv.appendChild(resetBtn);

        container.appendChild(actionsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'fm-status';
        container.appendChild(statusDiv);
    }

    _validate() {
        let hasErrors = false;
        this.fields.forEach(field => {
            const input = document.getElementById(`fm-${field.key}`);
            if (!input) return;

            const fieldValue = input.type === 'checkbox' ? input.checked : input.value;
            const errorMsg = field.validate ? field.validate(fieldValue) : null;
            let errorEl = input.parentElement.querySelector('.error-message');

            if (errorMsg) {
                hasErrors = true;
                if (!errorEl) {
                    errorEl = document.createElement('div');
                    errorEl.className = 'error-message';
                    input.parentElement.appendChild(errorEl);
                }
                errorEl.textContent = errorMsg;
                input.classList.add('error');
            } else {
                if (errorEl) {
                    errorEl.remove();
                }
                input.classList.remove('error');
            }
        });
        return !hasErrors;
    }

    async save() {
        const isValid = this._validate();
        const statusDiv = document.getElementById('fm-status');

        if (!isValid) {
            statusDiv.textContent = 'Please fix errors before saving.';
            statusDiv.style.color = 'red';
            return;
        }

        const values = {};
        this.fields.forEach(field => {
            const input = document.getElementById(`fm-${field.key}`);
            if (field.type === 'checkbox') {
                values[field.key] = input.checked;
            } else {
                values[field.key] = input.value;
            }
        });

        const saveBtn = document.getElementById('fm-saveBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            await this.adapter.storageSetMany(values);
            statusDiv.textContent = 'Saved!';
            statusDiv.style.color = 'green';
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async clearCache() {
        if (window.confirm('Clear all cached ratings?')) {
            await this.#cacheManager.clear();
            const statusDiv = document.getElementById('fm-status');
            statusDiv.textContent = 'Cache cleared.';
            statusDiv.style.color = 'green';
        }
    }

    async resetClients() {
        if (window.confirm('Re-enable all disabled API clients?')) {
            await this.#disabledClientsManager.resetAll();
            const statusDiv = document.getElementById('fm-status');
            statusDiv.textContent = 'API clients re-enabled.';
            statusDiv.style.color = 'green';
        }
    }

    _injectStyles() {
        if (!document.getElementById('flixmonkey-settings-styles')) {
            const style = document.createElement('style');
            style.id = 'flixmonkey-settings-styles';
            style.textContent = SETTINGS_STYLES;
            document.head.appendChild(style);
        }
    }
}
