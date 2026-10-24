/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SettingsActions } from '../../types/extension';
import type {
    ActionConfigField,
    ConfigField,
    ConfigValueType,
    SelectOption,
    SettingConfigField,
} from '../config/index';
import { GROUPS, isActionField, isSettingField, ROW_LABELS } from '../config/index';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';
import { SETTINGS_STYLES } from './styles';

interface SettingsFieldRow {
    readonly id: string;
    readonly fields: readonly ConfigField[];
}

interface SettingsGroup {
    readonly id: string;
    readonly label: string;
    readonly icon: string;
    readonly fields: readonly SettingsFieldRow[];
}

/**
 * UI component that renders and manages the settings panel with grouped configuration fields.
 */
export class SettingsView {
    readonly #fields: readonly ConfigField[];
    readonly #actions: SettingsActions;
    #container: HTMLElement | undefined;
    #debounceTimer: ReturnType<typeof setTimeout> | undefined;

    /**
     * Creates a SettingsView instance.
     *
     * @param fields - Configuration field definitions.
     * @param actions - Action handlers for settings events.
     */
    constructor(fields: readonly ConfigField[], actions: SettingsActions) {
        this.#fields = fields;
        this.#actions = actions;
    }

    /**
     * Renders the complete settings UI into the specified container with current values.
     *
     * @param container - DOM element to render into.
     * @param settings - Current settings values.
     */
    render(container: HTMLElement, settings: Record<string, unknown>): void {
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

    #injectStyles(): void {
        if (!document.getElementById('flixmonkey-settings-styles')) {
            const style = document.createElement('style');
            style.id = 'flixmonkey-settings-styles';
            style.textContent = SETTINGS_STYLES;
            document.head.appendChild(style);
        }
    }

    #groupFieldsByGroup(): SettingsGroup[] {
        const groups: SettingsGroup[] = [];
        const fieldsByGroup: Record<string, ConfigField[]> = {};

        // ConfigField.group is a required GroupKey, so every field belongs to a group.
        for (const field of this.#fields) {
            this.#addFieldToGroup(field, fieldsByGroup);
        }

        this.#buildGroupElements(groups, fieldsByGroup);

        return groups;
    }

    #addFieldToGroup(field: ConfigField, fieldsByGroup: Record<string, ConfigField[]>): void {
        const groupId = field.group;
        if (!fieldsByGroup[groupId]) {
            fieldsByGroup[groupId] = [];
        }
        fieldsByGroup[groupId].push(field);
    }

    #buildGroupElements(groups: SettingsGroup[], fieldsByGroup: Record<string, ConfigField[]>): void {
        for (const [groupId, fields] of Object.entries(fieldsByGroup)) {
            const groupInfo = GROUPS[groupId as keyof typeof GROUPS];
            groups.push({
                id: groupId,
                label: groupInfo.label,
                icon: groupInfo.icon,
                fields: this.#groupFieldsByRow(fields),
            });
        }
    }

    #groupFieldsByRow(fields: readonly ConfigField[]): SettingsFieldRow[] {
        const rows = new Map<string, ConfigField[]>();
        for (const field of fields) {
            const rowId = field.type === 'checkbox' && field.row ? field.row : field.key;
            const rowFields = rows.get(rowId);
            if (rowFields) {
                rowFields.push(field);
            } else {
                rows.set(rowId, [field]);
            }
        }
        return [...rows].map(([id, rowFields]) => ({ id, fields: rowFields }));
    }

    #createGroupElement(group: SettingsGroup, settings: Record<string, unknown>): HTMLElement {
        const container = document.createElement('div');
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

        for (const row of group.fields) {
            const fieldElement = this.#createFieldRow(row, settings);
            container.appendChild(fieldElement);
        }

        return container;
    }

    #getFieldClassName(row: SettingsFieldRow): string {
        const hasActions = row.fields.every((f): boolean => isActionField(f));
        const isLoneCheckbox = row.fields.length === 1 && row.fields[0].type === 'checkbox' && !row.fields[0].row;

        if (hasActions) return 'field field--actions';
        if (isLoneCheckbox) return 'field field--checkbox';
        return 'field';
    }

    #createFieldLabel(row: SettingsFieldRow): HTMLLabelElement {
        const rowLabelObj = ROW_LABELS[row.id as keyof typeof ROW_LABELS];
        const rowLabel = rowLabelObj?.label ?? row.fields[0].label;

        if (row.fields.every(isActionField)) {
            return this.#createSpacerLabel();
        }

        const tooltip = rowLabelObj?.title ?? row.fields[0].title ?? '';
        const onlyField = this.#singleSettingField(row);

        if (onlyField?.labelUrl) {
            return this.#createLinkedLabel(rowLabel, onlyField.labelUrl, tooltip);
        }
        return this.#createPlainLabel(rowLabel, onlyField, tooltip);
    }

    #singleSettingField(row: SettingsFieldRow): SettingConfigField | undefined {
        if (row.fields.length !== 1) return undefined;
        const [field] = row.fields;
        return isSettingField(field) ? field : undefined;
    }

    #createSpacerLabel(): HTMLLabelElement {
        const label = this.#createLabelElement();
        label.textContent = '\u00A0';
        label.style.visibility = 'hidden';
        return label;
    }

    #createLinkedLabel(text: string, labelUrl: string, tooltip: string): HTMLLabelElement {
        const label = this.#createLabelElement();
        const link = document.createElement('a');
        link.href = labelUrl;
        link.target = '_blank';
        link.textContent = text;
        if (tooltip) {
            link.title = tooltip;
        }
        label.appendChild(link);
        return label;
    }

    #createPlainLabel(text: string, field: SettingConfigField | undefined, tooltip: string): HTMLLabelElement {
        const label = this.#createLabelElement();
        label.textContent = text;
        if (field) {
            label.htmlFor = `fm-${field.key}`;
        }
        if (tooltip) {
            label.title = tooltip;
        }
        return label;
    }

    #createLabelElement(): HTMLLabelElement {
        const label = document.createElement('label');
        label.className = 'field-label';
        return label;
    }

    #createFieldValueContainer(row: SettingsFieldRow, settings: Record<string, unknown>): HTMLElement {
        const valueContainer = document.createElement('div');
        valueContainer.className = 'field-value';

        if (row.fields.every(isActionField)) {
            valueContainer.append(...this.#createActionFields(row.fields));
        } else if (row.fields.length > 1 && row.fields.every((f): boolean => f.type === 'checkbox')) {
            valueContainer.appendChild(this.#createCheckboxGroup(row.fields, settings));
        } else {
            valueContainer.append(...this.#createSettingFields(row.fields, settings));
        }

        return valueContainer;
    }

    #createActionFields(fields: readonly ConfigField[]): HTMLElement[] {
        return fields.filter(isActionField).map(field => this.#createActionField(field));
    }

    #createCheckboxGroup(fields: readonly ConfigField[], settings: Record<string, unknown>): HTMLElement {
        const checkboxes = document.createElement('div');
        checkboxes.className = 'checkboxes';

        for (const field of fields) {
            if (!isSettingField(field)) continue;
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

        return checkboxes;
    }

    #createSettingFields(fields: readonly ConfigField[], settings: Record<string, unknown>): HTMLElement[] {
        return fields.map(field => {
            if (isActionField(field)) return this.#createActionField(field);
            if (field.suffix) return this.#createInputWithSuffix(field, settings);
            return this.#createInput(field, settings);
        });
    }

    #createFieldRow(row: SettingsFieldRow, settings: Record<string, unknown>): HTMLElement {
        const fieldElement = document.createElement('div');
        fieldElement.className = this.#getFieldClassName(row);

        const label = this.#createFieldLabel(row);
        fieldElement.appendChild(label);

        const valueContainer = this.#createFieldValueContainer(row, settings);
        fieldElement.appendChild(valueContainer);

        return fieldElement;
    }

    #createActionField(field: ActionConfigField): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.id = `fm-${field.key}`;
        btn.textContent = field.actionLabel;
        btn.addEventListener('click', () => {
            if (field.key === 'clearCache') {
                void this.#actions.onClearCache();
            } else if (field.key === 'resetClients') {
                void this.#actions.onResetClients();
            }
        });
        return btn;
    }

    #createInputWithSuffix(field: SettingConfigField, settings: Record<string, unknown>): HTMLElement {
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

    #createInput(field: SettingConfigField, settings: Record<string, unknown>): HTMLElement {
        const input = document.createElement(field.type === 'select' ? 'select' : 'input');
        input.className = 'field-input';
        input.name = field.key;
        input.id = `fm-${field.key}`;

        if (field.type === 'select') {
            const selectInput = input as HTMLSelectElement;
            this.#addOptions(selectInput, field.options);
            selectInput.value = String(this.#settingValue(field.key, settings, field.default));
        } else if (field.type === 'checkbox') {
            const checkboxInput = input as HTMLInputElement;
            checkboxInput.type = 'checkbox';
            checkboxInput.checked = Boolean(this.#settingValue(field.key, settings, field.default));
        } else {
            const textInput = input as HTMLInputElement;
            textInput.type = 'text';
            textInput.value = String(this.#settingValue(field.key, settings, field.default));
        }

        if (field.disabled) {
            (input as HTMLInputElement).disabled = true;
        }

        if (field.short) {
            input.classList.add('short');
        }

        return input;
    }

    #addOptions(select: HTMLSelectElement, options: readonly (string | SelectOption)[]): void {
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

    #settingValue(key: string, settings: Record<string, unknown>, defaultValue: unknown): unknown {
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    #createStatus(): HTMLElement {
        const status = document.createElement('div');
        status.id = 'fm-status';
        status.className = 'status';
        return status;
    }

    #setupAutoSave(): void {
        if (this.#container === undefined) return;
        const inputs = this.#container.querySelectorAll('.field-input');
        for (const input of inputs) {
            const eventType = (input as HTMLInputElement).type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
                this.#debounceTimer = setTimeout(() => {
                    void this.#actions.onSave();
                }, AUTOSAVE_DEBOUNCE_MS);
            });
        }
    }

    /**
     * Reads current values from all form inputs in the settings UI.
     *
     * @returns Settings values keyed by field keys.
     */
    readValues(): Record<string, ConfigValueType> {
        const values: Record<string, ConfigValueType> = {};
        for (const field of this.#fields) {
            if (!isSettingField(field)) continue;
            const input = this.#fieldInput(field);
            if (input) {
                values[field.key] = this.#readInputValue(field, input);
            }
        }
        return values;
    }

    #fieldInput(field: SettingConfigField): HTMLInputElement | undefined {
        if (field.disabled) return undefined;
        return this.#container?.querySelector<HTMLInputElement>(`[id="fm-${field.key}"]`) ?? undefined;
    }

    #readInputValue(field: SettingConfigField, input: HTMLInputElement): ConfigValueType {
        return field.type === 'checkbox' ? input.checked : input.value;
    }

    /**
     * Validates settings values using field-specific validators.
     *
     * @param values - Settings values to validate.
     * @returns Array of validation error messages, empty if valid.
     */
    validate(values: Record<string, ConfigValueType>): string[] {
        const errors: string[] = [];
        if (this.#container === undefined) return errors;
        for (const field of this.#fields) {
            if (!isSettingField(field)) continue;
            const error = this.#validateField(field, values);
            if (error) errors.push(error);
        }
        return errors;
    }

    #validateField(field: SettingConfigField, values: Record<string, ConfigValueType>): string | undefined {
        const input = this.#fieldInput(field);
        if (!input) return undefined;
        const error = field.validate ? field.validate(values[field.key], values) : undefined;
        input.classList.toggle('error', Boolean(error));
        return error;
    }

    /**
     * Displays a status message in the settings UI.
     *
     * @param message - Status message to display.
     * @param type - Status type for styling ('success', 'error', etc.).
     */
    showStatus(message: string, type: string): void {
        if (this.#container === undefined) return;
        const status = this.#container.querySelector('[id="fm-status"]');
        if (status) {
            status.textContent = message;
            status.className = type ? `status status--${type}` : 'status';
        }
    }
}
