/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SettingsActions } from '../../types/extension.js';
import { GROUPS, ROW_LABELS } from '../config/index.js';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants.js';
import { SETTINGS_STYLES } from './styles.js';

/** Config field definition type */
export interface ConfigField {
    readonly key: string;
    readonly label: string;
    readonly group?: string;
    readonly type: 'checkbox' | 'select' | 'text' | 'action';
    readonly default: string | boolean | null;
    readonly row?: string;
    readonly options?: ReadonlyArray<string | readonly [string, string]>;
    readonly title?: string;
    readonly labelUrl?: string;
    readonly labelHidden?: boolean;
    readonly disabled?: boolean;
    readonly suffix?: string;
    readonly short?: boolean;
    readonly validate?: ((_value: unknown, _allValues?: Record<string, unknown>) => string | null) | undefined;
    readonly actionLabel?: string;
}

/**
 * UI component that renders and manages the settings panel with grouped configuration fields.
 */
export class SettingsView {
    #fields: readonly ConfigField[];
    #actions: SettingsActions;
    #container: HTMLElement | null = null;
    #debounceTimer: ReturnType<typeof setTimeout> | null = null;

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

    #groupFieldsByGroup(): Array<{
        id: string;
        label: string;
        icon: string;
        fields: Array<{ id: string; fields: readonly ConfigField[] }>;
        isUngrouped?: boolean;
    }> {
        const groups: Array<{
            id: string;
            label: string;
            icon: string;
            fields: Array<{ id: string; fields: readonly ConfigField[] }>;
            isUngrouped?: boolean;
        }> = [];
        const fieldsByGroup: Record<string, ConfigField[]> = {};
        const ungroupedFields: ConfigField[] = [];

        for (const field of this.#fields) {
            const hasValidGroup = field.group && GROUPS[field.group as keyof typeof GROUPS];
            if (hasValidGroup) {
                this.#addFieldToGroup(field, fieldsByGroup);
            } else if (field.type !== 'action') {
                ungroupedFields.push(field);
            }
        }

        this.#buildGroupElements(groups, fieldsByGroup);
        this.#addUngroupedFields(groups, ungroupedFields);

        return groups;
    }

    #addFieldToGroup(field: ConfigField, fieldsByGroup: Record<string, ConfigField[]>): void {
        const groupId = field.group as string;
        if (!fieldsByGroup[groupId]) {
            fieldsByGroup[groupId] = [];
        }
        fieldsByGroup[groupId].push(field);
    }

    #buildGroupElements(
        groups: Array<{
            id: string;
            label: string;
            icon: string;
            fields: Array<{ id: string; fields: readonly ConfigField[] }>;
        }>,
        fieldsByGroup: Record<string, ConfigField[]>
    ): void {
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

    #addUngroupedFields(
        groups: Array<{
            id: string;
            label: string;
            icon: string;
            fields: Array<{ id: string; fields: readonly ConfigField[] }>;
            isUngrouped?: boolean;
        }>,
        ungroupedFields: ConfigField[]
    ): void {
        if (ungroupedFields.length > 0) {
            groups.push({
                id: 'ungrouped',
                label: '',
                icon: '',
                fields: this.#groupFieldsByRow(ungroupedFields),
                isUngrouped: true,
            });
        }
    }

    #groupFieldsByRow(fields: ConfigField[]): Array<{ id: string; fields: ConfigField[] }> {
        const rows: Record<string, { id: string; fields: ConfigField[] }> = {};
        for (const field of fields) {
            const rowId = field.type === 'checkbox' && field.row ? field.row : field.key;
            if (!rows[rowId]) {
                rows[rowId] = { id: rowId, fields: [] };
            }
            rows[rowId].fields.push(field);
        }
        return Object.values(rows);
    }

    #createGroupElement(
        group: {
            id: string;
            label: string;
            icon: string;
            fields: Array<{ id: string; fields: readonly ConfigField[] }>;
            isUngrouped?: boolean;
        },
        settings: Record<string, unknown>
    ): HTMLElement {
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

            const actionFields = this.#fields.filter(
                (f): boolean => f.type === 'action' && f.group === group.id && f.row === row.id
            );
            for (const actionField of actionFields) {
                const actionElement = this.#createActionField(actionField);
                container.appendChild(actionElement);
            }
        }

        return container;
    }

    #getFieldClassName(row: { id: string; fields: readonly ConfigField[] }): string {
        const hasActions = row.fields.every((f): boolean => f.type === 'action');
        const isLoneCheckbox = row.fields.length === 1 && row.fields[0].type === 'checkbox' && !row.fields[0].row;

        if (hasActions) return 'field field--actions';
        if (isLoneCheckbox) return 'field field--checkbox';
        return 'field';
    }

    #createFieldLabel(row: { id: string; fields: readonly ConfigField[] }): HTMLLabelElement {
        const label = document.createElement('label');
        label.className = 'field-label';

        const rowLabelObj = ROW_LABELS[row.id as keyof typeof ROW_LABELS];
        const rowLabel = rowLabelObj?.label ?? row.fields[0].label;
        const onlyField = row.fields[0];
        const hasActions = row.fields.every((f): boolean => f.type === 'action');
        const tooltip = hasActions ? '' : (rowLabelObj?.title ?? row.fields[0].title ?? '');

        if (hasActions) {
            label.textContent = '\u00A0';
            label.style.visibility = 'hidden';
        } else if (row.fields.length === 1 && onlyField.labelUrl) {
            const link = document.createElement('a');
            link.href = onlyField.labelUrl;
            link.target = '_blank';
            link.textContent = rowLabel;
            if (tooltip) {
                link.title = tooltip;
            }
            label.appendChild(link);
        } else {
            label.textContent = rowLabel;
            if (row.fields.length === 1 && !onlyField.labelUrl) {
                label.htmlFor = `fm-${onlyField.key}`;
            }
            if (tooltip) {
                label.title = tooltip;
            }
        }

        return label;
    }

    #createFieldValueContainer(
        row: { id: string; fields: readonly ConfigField[] },
        settings: Record<string, unknown>
    ): HTMLElement {
        const valueContainer = document.createElement('div');
        valueContainer.className = 'field-value';

        const hasActions = row.fields.every((f): boolean => f.type === 'action');
        const isCheckboxGroup = row.fields.length > 1 && row.fields.every((f): boolean => f.type === 'checkbox');

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

    #createFieldRow(
        row: { id: string; fields: readonly ConfigField[] },
        settings: Record<string, unknown>
    ): HTMLElement {
        const fieldElement = document.createElement('div');
        fieldElement.className = this.#getFieldClassName(row);

        const label = this.#createFieldLabel(row);
        fieldElement.appendChild(label);

        const valueContainer = this.#createFieldValueContainer(row, settings);
        fieldElement.appendChild(valueContainer);

        return fieldElement;
    }

    #createActionField(field: ConfigField): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.id = `fm-${field.key}`;
        btn.textContent = field.actionLabel ?? '';
        btn.addEventListener('click', () => {
            if (field.key === 'clearCache') {
                this.#actions.onClearCache();
            } else if (field.key === 'resetClients') {
                this.#actions.onResetClients();
            }
        });
        return btn;
    }

    #createInputWithSuffix(field: ConfigField, settings: Record<string, unknown>): HTMLElement {
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

    #createInput(field: ConfigField, settings: Record<string, unknown>): HTMLElement {
        const input = document.createElement(field.type === 'select' ? 'select' : 'input');
        input.className = 'field-input';
        input.name = field.key;
        input.id = `fm-${field.key}`;

        if (field.type === 'select') {
            const selectInput = input as HTMLSelectElement;
            this.#addOptions(selectInput, field.options ?? []);
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

    #addOptions(select: HTMLSelectElement, options: ReadonlyArray<string | readonly [string, string]>): void {
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
        if (this.#container === null) return;
        const inputs = this.#container.querySelectorAll('.field-input');
        for (const input of inputs) {
            const eventType = (input as HTMLInputElement).type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
                this.#debounceTimer = setTimeout(async () => {
                    await this.#actions.onSave();
                }, AUTOSAVE_DEBOUNCE_MS);
            });
        }
    }

    /**
     * Reads current values from all form inputs in the settings UI.
     *
     * @returns Settings values keyed by field keys.
     */
    readValues(): Record<string, unknown> {
        const values: Record<string, unknown> = {};
        for (const field of this.#fields) {
            if (field.type === 'action') continue;
            if (field.disabled) continue;
            const input = this.#container?.querySelector(`[id="fm-${field.key}"]`);
            if (input) {
                if (field.type === 'checkbox') {
                    values[field.key] = (input as HTMLInputElement).checked;
                } else {
                    values[field.key] = (input as HTMLInputElement).value;
                }
            }
        }
        return values;
    }

    /**
     * Validates settings values using field-specific validators.
     *
     * @param values - Settings values to validate.
     * @returns Array of validation error messages, empty if valid.
     */
    validate(values: Record<string, unknown>): string[] {
        const errors: string[] = [];
        if (this.#container === null) return errors;
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

    /**
     * Displays a status message in the settings UI.
     *
     * @param message - Status message to display.
     * @param type - Status type for styling ('success', 'error', etc.).
     */
    showStatus(message: string, type: string): void {
        if (this.#container === null) return;
        const status = this.#container.querySelector('[id="fm-status"]');
        if (status) {
            status.textContent = message;
            status.className = type ? `status status--${type}` : 'status';
        }
    }
}
