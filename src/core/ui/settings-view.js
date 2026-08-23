/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
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
     * @param {typeof import('../config-fields.js').CONFIG_FIELDS} fields
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
        container.replaceChildren(this.#createFields(settings), this.#createActions(), this.#createStatus());
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

    #createFields(settings) {
        const container = document.createElement('div');
        container.id = 'fm-fields';

        for (const group of this.#groupFields()) {
            if (group.section) container.appendChild(this.#createSection(group.section));
            container.appendChild(this.#createGroup(group, settings));
        }

        return container;
    }

    #groupFields() {
        const groups = [];
        for (const field of this.#fields) {
            const last = groups.at(-1);
            if (field.row && last?.row === field.row) {
                last.fields.push(field);
            } else {
                groups.push({ row: field.row, section: field.section, fields: [field] });
            }
        }

        for (const group of groups) {
            group.isRatingsGroup = group.row === 'ratings-display';
            group.isServicesGroup = group.row === 'services';
        }

        return groups;
    }

    #createSection(section) {
        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = section;
        return header;
    }

    #createGroup(group, settings) {
        const container = document.createElement('div');
        const parent = group.row ? container : document.createDocumentFragment();
        if (group.row) container.className = `field-row ${group.row}`;

        if (group.isRatingsGroup) {
            parent.appendChild(this.#createRatingsField(group, settings));
        } else if (group.isServicesGroup) {
            parent.appendChild(this.#createServicesField(group, settings));
        } else {
            for (const field of group.fields) parent.appendChild(this.#createField(field, settings));
        }

        return parent;
    }

    #createRatingsField(group, settings) {
        const field = this.#createSpecialField(
            'ratings-field',
            'Show Ratings',
            'Choose which ratings to display on thumbnails'
        );
        const checkboxes = document.createElement('div');
        checkboxes.className = 'ratings-group';
        checkboxes.appendChild(this.#createRatingCheckbox('showImdbRating', 'IMDb', true, settings));

        for (const key of ['showMcRating', 'showRtRating']) {
            const ratingField = group.fields.find(candidate => candidate.key === key);
            if (ratingField) {
                checkboxes.appendChild(this.#createRatingCheckbox(key, ratingField.label, false, settings));
            }
        }

        field.appendChild(checkboxes);
        return field;
    }

    #createSpecialField(className, labelText, title) {
        const field = document.createElement('div');
        field.className = `field ${className}`;
        field.appendChild(this.#createLabel(labelText, null, title));
        return field;
    }

    #createLabel(text, htmlFor, title = null) {
        const label = document.createElement('label');
        label.className = 'field-label';
        if (title !== null) label.title = title;
        if (htmlFor !== null) label.htmlFor = htmlFor;
        label.textContent = text;
        return label;
    }

    #createRatingCheckbox(key, labelText, isDisabled, settings) {
        const field = document.createElement('div');
        field.className = 'rating-checkbox';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'field-input';
        input.id = `fm-${key}`;
        input.name = key;
        const defaultValue = this.#fields.find(field => field.key === key)?.default || false;
        input.checked = isDisabled ? true : this.#settingValue(key, settings, defaultValue);
        input.disabled = isDisabled;

        field.append(input, this.#createLabel(labelText, input.id));
        return field;
    }

    #settingValue(key, settings, defaultValue) {
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    #createServicesField(group, settings) {
        const field = this.#createSpecialField(
            'services-field',
            'Show on',
            'Choose which streaming services to enable FlixMonkey on'
        );
        const checkboxes = document.createElement('div');
        checkboxes.className = 'services-group';

        for (const serviceField of group.fields) {
            if (serviceField.row === 'services') {
                checkboxes.appendChild(this.#createField(serviceField, settings));
            }
        }

        field.appendChild(checkboxes);
        return field;
    }

    #createField(field, settings) {
        const container = document.createElement('div');
        container.className = 'field';
        const label = this.#createFieldLabel(field);
        const input = this.#createInput(field, settings);

        if (field.type === 'checkbox') {
            container.append(input, label);
        } else {
            container.append(label, input);
        }

        return container;
    }

    #createFieldLabel(field) {
        const label = this.#createLabel(field.label, `fm-${field.key}`, field.title || '');
        if (field.labelUrl) {
            const link = document.createElement('a');
            link.href = field.labelUrl;
            link.target = '_blank';
            link.textContent = field.label;
            label.replaceChildren(link);
        }
        if (field.labelHidden) label.classList.add('visually-hidden');
        return label;
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

    #createActions() {
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.append(
            this.#createAction(
                'fm-clearCacheBtn',
                'Clear Cache',
                'secondary',
                'Delete all cached ratings to force fresh rating lookups',
                this.#actions.onClearCache
            ),
            this.#createAction(
                'fm-resetClientsBtn',
                'Reset Disabled Providers',
                'secondary',
                'Re-enable rating providers that were automatically disabled due to errors',
                this.#actions.onResetClients
            )
        );
        return actions;
    }

    #createAction(id, text, className, title, action) {
        const button = document.createElement('button');
        button.id = id;
        if (className) button.className = className;
        button.textContent = text;
        if (title) button.title = title;
        button.onclick = () => action();
        return button;
    }

    #createStatus() {
        const status = document.createElement('div');
        status.id = 'fm-status';
        return status;
    }

    #setupAutoSave() {
        const inputs = this.#container.querySelectorAll('.field-input');
        for (const input of inputs) {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
                this.#debounceTimer = setTimeout(() => {
                    try {
                        this.#actions.onSave();
                    } catch {
                        // Stop errors in onSave from breaking event handlers
                    }
                }, AUTOSAVE_DEBOUNCE_MS);
            });
        }
    }

    readValues() {
        const values = {};
        for (const field of this.#fields) {
            const input = this.#container.querySelector(`[id="fm-${field.key}"]`);
            if (input) values[field.key] = input.type === 'checkbox' ? input.checked : input.value;
        }
        return values;
    }

    validate(values) {
        const errors = [];
        for (const field of this.#fields) {
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
        status.textContent = message;
        status.className = `fm-status--${type}`;
    }

    setSaveDisabled() {
        // No-op: Save button removed, autosave handles persistence
    }
}
