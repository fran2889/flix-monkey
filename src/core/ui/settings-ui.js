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

            // Special handling for ratings group
            if (group.isRatingsGroup) {
                // Create a field with "Show Ratings" label and the ratings checkboxes
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'field ratings-field';

                const label = document.createElement('label');
                label.className = 'field-label';
                label.textContent = 'Show Ratings';
                label.title = 'Choose which ratings to display on thumbnails';
                fieldDiv.appendChild(label);

                const checkboxesContainer = this.#createRatingsCheckboxes(group, settings);
                fieldDiv.appendChild(checkboxesContainer);

                parent.appendChild(fieldDiv);
                continue;
            }

            // Special handling for services group
            if (group.isServicesGroup) {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'field services-field';

                const label = document.createElement('label');
                label.className = 'field-label';
                label.textContent = 'Enabled Streaming Services';
                label.title = 'Choose which streaming services to enable FlixMonkey on';
                fieldDiv.appendChild(label);

                const checkboxesContainer = this.#createServicesCheckboxes(group, settings);
                fieldDiv.appendChild(checkboxesContainer);

                parent.appendChild(fieldDiv);
                continue;
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
        clearBtn.title = 'Delete all cached ratings to force fresh rating lookups';
        clearBtn.onclick = () => this.clearCache();
        actionsDiv.appendChild(clearBtn);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'fm-resetClientsBtn';
        resetBtn.className = 'secondary';
        resetBtn.textContent = 'Reset Disabled Clients';
        resetBtn.title = 'Re-enable rating providers that were automatically disabled due to errors';
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

        // Mark special groups by their row property
        for (const group of groups) {
            if (group.row === 'ratings-display') {
                group.isRatingsGroup = true;
            }
            if (group.row === 'services') {
                group.isServicesGroup = true;
            }
        }

        return groups;
    }

    #createRatingsCheckboxes(group, settings) {
        const container = document.createElement('div');
        container.className = 'ratings-group';

        // IMDb checkbox (always checked, disabled)
        const imdbCheckbox = this.#createRatingCheckbox('showImdbRating', 'IMDb', true, settings);
        container.appendChild(imdbCheckbox);

        // Metacritic checkbox
        const mcField = group.fields.find(f => f.key === 'showMcRating');
        if (mcField) {
            const mcCheckbox = this.#createRatingCheckbox(mcField.key, mcField.label, false, settings);
            container.appendChild(mcCheckbox);
        }

        // Rotten Tomatoes checkbox
        const rtField = group.fields.find(f => f.key === 'showRtRating');
        if (rtField) {
            const rtCheckbox = this.#createRatingCheckbox(rtField.key, rtField.label, false, settings);
            container.appendChild(rtCheckbox);
        }

        return container;
    }

    #createServicesCheckboxes(group, settings) {
        const container = document.createElement('div');
        container.className = 'services-group';

        for (const field of group.fields) {
            if (field.row === 'services') {
                const checkbox = this.#createField(field, settings);
                container.appendChild(checkbox);
            }
        }

        return container;
    }

    #createRatingCheckbox(key, labelText, isDisabled, settings) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'rating-checkbox';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'field-input';
        input.id = `fm-${key}`;
        input.name = key;

        // For the hardcoded IMDb checkbox, always checked
        // For real config fields, use the stored or default value
        if (isDisabled) {
            input.checked = true;
            input.disabled = true;
        } else {
            const field = this.#fields.find(f => f.key === key);
            input.checked = settings[key] !== undefined ? settings[key] : field?.default || false;
            input.disabled = false;
        }

        const label = document.createElement('label');
        label.className = 'field-label';
        label.htmlFor = input.id;
        label.textContent = labelText;

        fieldDiv.appendChild(input);
        fieldDiv.appendChild(label);

        return fieldDiv;
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
        const errors = [];
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
            if (errorMsg) {
                errors.push(errorMsg);
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
        });
        return errors;
    }

    async save() {
        const errors = this.#validate();
        const statusDiv = this.#container.querySelector('#fm-status');

        if (errors.length > 0) {
            statusDiv.textContent = errors.join('\n');
            statusDiv.className = 'fm-status--error';
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
            statusDiv.className = 'fm-status--success';
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
            statusDiv.className = 'fm-status--success';
        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
            statusDiv.className = 'fm-status--error';
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
            statusDiv.className = 'fm-status--success';
        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
            statusDiv.className = 'fm-status--error';
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
