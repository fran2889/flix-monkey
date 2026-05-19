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
    constructor(adapter) {
        this.adapter = adapter;
    }

    async render(container) {
        this._injectStyles();
        const settings = await this.adapter.storageGetAll();

        container.innerHTML = '';

        const title = document.createElement('h1');
        title.textContent = 'FlixMonkey Settings';
        container.appendChild(title);

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'fields';
        container.appendChild(fieldsContainer);

        CONFIG_FIELDS.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'field';

            const label = document.createElement('label');
            label.className = 'field-label';
            label.textContent = field.label;
            label.title = field.title || '';
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
            input.id = field.key;
            fieldDiv.appendChild(input);
            fieldsContainer.appendChild(fieldDiv);
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const saveBtn = document.createElement('button');
        saveBtn.id = 'saveBtn';
        saveBtn.textContent = 'Save';
        actionsDiv.appendChild(saveBtn);

        container.appendChild(actionsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'status';
        container.appendChild(statusDiv);
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
