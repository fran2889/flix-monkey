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
    #adapter;
    #fields;
    #cacheManager;
    #disabledClientsManager;
    #container = null;
    #onSave = null;

    get onSave() {
        return this.#onSave;
    }
    set onSave(fn) {
        this.#onSave = fn;
    }

    constructor(adapter, fields = CONFIG_FIELDS, cacheManager, disabledClientsManager) {
        this.#adapter = adapter;
        this.#fields = fields;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
    }

    async render(container) {
        this.#container = container;
        this.#injectStyles();
        const settings = (await this.#adapter.storageGetAll()) || {};

        container.className = 'fm-settings-container';
        container.replaceChildren();

        const title = document.createElement('h1');
        title.textContent = 'FlixMonkey Settings';
        container.appendChild(title);

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'fm-fields';
        container.appendChild(fieldsContainer);

        const groups = this.#groupFields();
        for (const group of groups) {
            if (group.section) {
                const header = document.createElement('div');
                header.className = 'section-header';
                header.textContent = group.section;
                fieldsContainer.appendChild(header);
            }

            let parent = fieldsContainer;
            if (group.row) {
                const rowDiv = document.createElement('div');
                rowDiv.className = `field-row ${group.row}`;
                fieldsContainer.appendChild(rowDiv);
                parent = rowDiv;
            }

            for (const field of group.fields) {
                parent.appendChild(this.#createField(field, settings));
            }
        }

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
        clearBtn.title = 'Delete all cached ratings so they are fetched again.';
        clearBtn.onclick = () => this.clearCache();
        actionsDiv.appendChild(clearBtn);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'fm-resetClientsBtn';
        resetBtn.className = 'secondary';
        resetBtn.textContent = 'Reset Disabled Clients';
        resetBtn.title = 'Re-enable API providers that were turned off after repeated errors.';
        resetBtn.onclick = () => this.resetClients();
        actionsDiv.appendChild(resetBtn);

        container.appendChild(actionsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'fm-status';
        container.appendChild(statusDiv);
    }

    #groupFields() {
        const groups = [];
        for (const field of this.#fields) {
            const last = groups[groups.length - 1];
            if (field.row && last && last.row === field.row) {
                last.fields.push(field);
            } else {
                groups.push({ row: field.row, section: field.section, fields: [field] });
            }
        }
        return groups;
    }

    #createField(field, settings) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';

        const label = document.createElement('label');
        label.className = 'field-label';
        label.title = field.title || '';
        label.htmlFor = `fm-${field.key}`;

        if (field.labelUrl) {
            const link = document.createElement('a');
            link.href = field.labelUrl;
            link.target = '_blank';
            link.textContent = field.label;
            label.appendChild(link);
        } else {
            label.textContent = field.label;
        }

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

        if (field.labelHidden) {
            label.classList.add('visually-hidden');
        }

        if (field.type === 'checkbox') {
            fieldDiv.appendChild(input);
            fieldDiv.appendChild(label);
        } else {
            fieldDiv.appendChild(label);
            fieldDiv.appendChild(input);
        }

        return fieldDiv;
    }

    #validate() {
        let hasErrors = false;
        const allValues = {};
        this.#fields.forEach(field => {
            const input = this.#container.querySelector(`#fm-${field.key}`);
            if (!input) return;
            allValues[field.key] = input.type === 'checkbox' ? input.checked : input.value;
        });
        this.#fields.forEach(field => {
            const input = this.#container.querySelector(`#fm-${field.key}`);
            if (!input) return;

            const fieldValue = input.type === 'checkbox' ? input.checked : input.value;
            const errorMsg = field.validate ? field.validate(fieldValue, allValues) : null;
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
        const isValid = this.#validate();
        const statusDiv = this.#container.querySelector('#fm-status');

        if (!isValid) {
            statusDiv.textContent = 'Please fix errors before saving.';
            statusDiv.style.color = 'red';
            return;
        }

        const values = {};
        this.#fields.forEach(field => {
            const input = this.#container.querySelector(`#fm-${field.key}`);
            if (field.type === 'checkbox') {
                values[field.key] = input.checked;
            } else {
                values[field.key] = input.value;
            }
        });

        const saveBtn = this.#container.querySelector('#fm-saveBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            await this.#adapter.storageSetMany(values);
            statusDiv.textContent = 'Saved!';
            statusDiv.style.color = 'green';
            await this.#onSave?.();
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async clearCache() {
        const statusDiv = this.#container.querySelector('#fm-status');
        try {
            await this.#cacheManager.clear();
            statusDiv.textContent = 'Cache cleared.';
            statusDiv.style.color = 'green';
        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
            statusDiv.style.color = 'red';
        }
    }

    async resetClients() {
        const statusDiv = this.#container.querySelector('#fm-status');
        try {
            const reenabled = await this.#disabledClientsManager.resetAll();
            statusDiv.textContent =
                reenabled.length > 0
                    ? `Re-enabled API clients: ${reenabled.join(', ')}`
                    : 'No disabled API clients found to re-enable.';
            statusDiv.style.color = 'green';
        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
            statusDiv.style.color = 'red';
        }
    }

    #injectStyles() {
        if (!document.getElementById('flixmonkey-settings-styles')) {
            const style = document.createElement('style');
            style.id = 'flixmonkey-settings-styles';
            style.textContent = SETTINGS_STYLES;
            document.head.appendChild(style);
        }
    }
}
