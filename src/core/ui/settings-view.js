/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { GROUPS, ROW_LABELS } from '../config-fields.js';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants.js';
import { SETTINGS_STYLES } from './styles.js';

/**
 * @typedef {Object} SettingsActions
 * @property {() => void | Promise<void>} onSave
 * @property {() => void | Promise<void>} onClearCache
 * @property {() => void | Promise<void>} onResetClients
 */

export class SettingsView {
    #fields;
    #actions;
    #container = null;
    #debounceTimer = null;

    /**
     * @param {typeof CONFIG_FIELDS} fields
     * @param {SettingsActions} actions
     */
    constructor(fields, actions) {
        this.#fields = fields;
        this.#actions = actions;
    }

    render(container, settings) {
        this.#container = container;
        this.#injectStyles();
        container.className = 'fm-settings-container';

        const layout = document.createElement('div');
        layout.className = 'settings-layout';

        for (const group of this.#groupFieldsByGroup()) {
            layout.appendChild(this.#createGroupElement(group, settings));
        }

        layout.appendChild(this.#createStatus());
        container.replaceChildren(layout);
        this.#setupAutoSave();
    }

    #injectStyles() {
        if (!document.getElementById('flixmonkey-settings-styles')) {
            const style = document.createElement('style');
            style.id = 'flixmonkey-settings-styles';
            style.textContent = SETTINGS_STYLES;
            document.head.appendChild(style);
        }
    }

    #groupFieldsByGroup() {
        const groups = [];
        const fieldsByGroup = {};
        const ungroupedFields = [];

        for (const field of this.#fields) {
            // Include action fields in grouping
            if (field.type === 'action' && field.group && GROUPS[field.group]) {
                const groupId = field.group;
                if (!fieldsByGroup[groupId]) {
                    fieldsByGroup[groupId] = [];
                }
                fieldsByGroup[groupId].push(field);
                continue;
            }

            if (field.type === 'action') continue;
            if (field.group && GROUPS[field.group]) {
                const groupId = field.group;
                if (!fieldsByGroup[groupId]) {
                    fieldsByGroup[groupId] = [];
                }
                fieldsByGroup[groupId].push(field);
            } else {
                ungroupedFields.push(field);
            }
        }

        for (const [groupId, fields] of Object.entries(fieldsByGroup)) {
            const groupInfo = GROUPS[groupId];
            groups.push({
                id: groupId,
                label: groupInfo.label,
                icon: groupInfo.icon,
                fields: this.#groupFieldsByRow(fields),
            });
        }

        // Handle ungrouped fields (for backward compatibility with tests)
        if (ungroupedFields.length > 0) {
            groups.push({
                id: 'ungrouped',
                label: '',
                icon: '',
                fields: this.#groupFieldsByRow(ungroupedFields),
                isUngrouped: true,
            });
        }

        return groups;
    }

    #groupFieldsByRow(fields) {
        const rows = {};
        for (const field of fields) {
            const rowId = field.type === 'checkbox' && field.row ? field.row : field.key;
            if (!rows[rowId]) {
                rows[rowId] = { id: rowId, fields: [] };
            }
            rows[rowId].fields.push(field);
        }
        return Object.values(rows);
    }

    #createGroupElement(group, settings) {
        const container = document.createElement('div');

        if (group.isUngrouped) {
            container.className = 'settings-group';
        } else {
            container.className = 'settings-group';

            const header = document.createElement('div');
            header.className = 'settings-group-header';

            const icon = document.createElement('span');
            icon.className = 'settings-group-icon';
            icon.textContent = group.icon;

            const title = document.createElement('span');
            title.className = 'settings-group-title';
            title.textContent = group.label;

            header.append(icon, title);
            container.appendChild(header);
        }

        for (const row of group.fields) {
            const fieldElement = this.#createFieldRow(row, settings);
            container.appendChild(fieldElement);

            // Handle action fields that belong to this group
            const actionFields = this.#fields.filter(
                f => f.type === 'action' && f.group === group.id && f.row === row.id
            );
            for (const actionField of actionFields) {
                const actionElement = this.#createActionField(actionField);
                container.appendChild(actionElement);
            }
        }

        return container;
    }

    #getFieldClassName(row) {
        const hasActions = row.fields.every(f => f.type === 'action');
        const isLoneCheckbox = row.fields.length === 1 && row.fields[0].type === 'checkbox' && !row.fields[0].row;

        if (hasActions) return 'field field--actions';
        if (isLoneCheckbox) return 'field field--checkbox';
        return 'field';
    }

    #createFieldLabel(row) {
        const label = document.createElement('label');
        label.className = 'field-label';

        const rowLabel = ROW_LABELS[row.id] || row.fields[0].label;
        const onlyField = row.fields[0];

        if (row.fields.every(f => f.type === 'action')) {
            label.textContent = '\u00A0';
            label.style.visibility = 'hidden';
        } else if (row.fields.length === 1 && onlyField.labelUrl) {
            const link = document.createElement('a');
            link.href = onlyField.labelUrl;
            link.target = '_blank';
            link.textContent = rowLabel;
            label.appendChild(link);
        } else {
            label.textContent = rowLabel;
            if (row.fields.length === 1 && !onlyField.labelUrl) {
                label.htmlFor = `fm-${onlyField.key}`;
            }
        }

        return label;
    }

    #createFieldValueContainer(row, settings) {
        const valueContainer = document.createElement('div');
        valueContainer.className = 'field-value';

        const hasActions = row.fields.every(f => f.type === 'action');
        const isCheckboxGroup = row.fields.length > 1 && row.fields.every(f => f.type === 'checkbox');

        if (hasActions) {
            for (const field of row.fields) {
                const btn = this.#createActionField(field);
                valueContainer.appendChild(btn);
            }
        } else if (isCheckboxGroup) {
            const checkboxes = document.createElement('div');
            checkboxes.className = 'checkboxes';

            for (const field of row.fields) {
                const item = document.createElement('div');
                item.className = 'service-item';
                const input = this.#createInput(field, settings);
                const cbLabel = document.createElement('label');
                cbLabel.className = 'field-label';
                cbLabel.textContent = field.label;
                cbLabel.htmlFor = `fm-${field.key}`;
                item.append(input, cbLabel);
                checkboxes.appendChild(item);
            }

            valueContainer.appendChild(checkboxes);
        } else {
            for (const field of row.fields) {
                if (field.type === 'action') {
                    const btn = this.#createActionField(field);
                    valueContainer.appendChild(btn);
                } else if (field.suffix) {
                    valueContainer.appendChild(this.#createInputWithSuffix(field, settings));
                } else {
                    valueContainer.appendChild(this.#createInput(field, settings));
                }
            }
        }

        return valueContainer;
    }

    #createFieldRow(row, settings) {
        const fieldElement = document.createElement('div');
        fieldElement.className = this.#getFieldClassName(row);

        const label = this.#createFieldLabel(row);
        fieldElement.appendChild(label);

        const valueContainer = this.#createFieldValueContainer(row, settings);
        fieldElement.appendChild(valueContainer);

        return fieldElement;
    }

    #createActionField(field) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.id = `fm-${field.key}`;
        btn.textContent = field.actionLabel;
        btn.addEventListener('click', () => {
            if (field.key === 'clearCache') {
                this.#actions.onClearCache();
            } else if (field.key === 'resetClients') {
                this.#actions.onResetClients();
            }
        });
        return btn;
    }

    #createInputWithSuffix(field, settings) {
        const container = document.createElement('div');
        container.className = 'input-with-suffix';

        const input = this.#createInput(field, settings);
        container.appendChild(input);

        if (field.suffix) {
            const suffix = document.createElement('span');
            suffix.className = 'field-suffix';
            suffix.textContent = field.suffix;
            container.appendChild(suffix);
        }

        return container;
    }

    #createInput(field, settings) {
        const input = document.createElement(field.type === 'select' ? 'select' : 'input');
        input.className = 'field-input';
        input.name = field.key;
        input.id = `fm-${field.key}`;

        if (field.type === 'select') {
            this.#addOptions(input, field.options);
            input.value = this.#settingValue(field.key, settings, field.default);
        } else if (field.type === 'checkbox') {
            input.type = 'checkbox';
            input.checked = this.#settingValue(field.key, settings, field.default);
        } else {
            input.type = 'text';
            input.value = this.#settingValue(field.key, settings, field.default);
        }

        if (field.disabled) {
            input.disabled = true;
        }

        if (field.labelUrl) {
            input.classList.add('short');
        }

        return input;
    }

    #addOptions(select, options) {
        for (const configuredOption of options) {
            const option = document.createElement('option');
            const [value, text] = Array.isArray(configuredOption)
                ? configuredOption
                : [configuredOption, configuredOption];
            option.value = value;
            option.textContent = text;
            select.appendChild(option);
        }
    }

    #settingValue(key, settings, defaultValue) {
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    #createStatus() {
        const status = document.createElement('div');
        status.id = 'fm-status';
        status.className = 'status';
        return status;
    }

    #setupAutoSave() {
        const inputs = this.#container.querySelectorAll('.field-input');
        for (const input of inputs) {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
                this.#debounceTimer = setTimeout(async () => {
                    await this.#actions.onSave();
                }, AUTOSAVE_DEBOUNCE_MS);
            });
        }
    }

    readValues() {
        const values = {};
        for (const field of this.#fields) {
            if (field.type === 'action') continue;
            if (field.disabled) continue;
            const input = this.#container.querySelector(`[id="fm-${field.key}"]`);
            if (input) {
                if (field.type === 'checkbox') {
                    values[field.key] = input.checked;
                } else {
                    values[field.key] = input.value;
                }
            }
        }
        return values;
    }

    validate(values) {
        const errors = [];
        for (const field of this.#fields) {
            if (field.type === 'action') continue;
            if (field.disabled) continue;
            const input = this.#container.querySelector(`[id="fm-${field.key}"]`);
            if (!input) continue;
            const error = field.validate ? field.validate(values[field.key], values) : null;
            input.classList.toggle('error', Boolean(error));
            if (error) errors.push(error);
        }
        return errors;
    }

    showStatus(message, type) {
        const status = this.#container.querySelector('[id="fm-status"]');
        if (status) {
            status.textContent = message;
            status.className = type ? `status status--${type}` : 'status';
        }
    }
}
