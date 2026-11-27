/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    CONFIG_FIELDS,
    type ConfigField,
    GROUPS,
    isSettingField,
    ROW_LABELS,
    type SettingConfigField,
} from '../../../../src/core/config/index';
import { SettingsView } from '../../../../src/core/ui/settings-view';

const configFields: readonly ConfigField[] = CONFIG_FIELDS;

const settingFields = configFields.filter(isSettingField);

function storedValueFor(field: SettingConfigField): boolean | string {
    if (field.type === 'checkbox') return !field.default;
    if (field.type === 'select') {
        const optionValues = field.options.map(option => (Array.isArray(option) ? option[0] : option));
        const storedValue = optionValues.find(option => option !== field.default);
        if (storedValue === undefined) {
            throw new Error(`Select field ${field.key} has no option other than its default`);
        }
        return storedValue;
    }
    return `stored-${field.key}`;
}

describe('SettingsView', () => {
    let actions: {
        onSave: () => void;
        onClearCache: () => void;
        onClearCacheWithIds: () => void;
        onResetClients: () => void;
    };
    let container: HTMLDivElement;
    let view: SettingsView;

    beforeEach(() => {
        actions = {
            onSave: vi.fn(),
            onClearCache: vi.fn(),
            onClearCacheWithIds: vi.fn(),
            onResetClients: vi.fn(),
        };
        container = document.createElement('div');
        view = new SettingsView(configFields, actions);
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    describe('rendering', () => {
        it.each(settingFields)('renders $key from its definition', field => {
            view.render(container, {});

            const label = Array.from(container.querySelectorAll('label')).find(
                element => element.textContent === field.label
            );
            expect(label, `Label for ${field.key} not found`).toBeDefined();

            const input = container.querySelector(`[id="fm-${field.key}"]`);
            expect(input, `Input for ${field.key} not found`).toBeDefined();

            if (field.type === 'select') {
                expect((input as HTMLSelectElement).tagName).toBe('SELECT');
                expect(
                    [...(input as HTMLSelectElement).options].map(option => [option.value, option.textContent])
                ).toEqual(field.options.map(option => (Array.isArray(option) ? option : [option, option])));
            } else {
                expect((input as HTMLInputElement).type).toBe(field.type);
            }

            if (field.labelUrl) {
                const link = label?.querySelector('a');
                expect(link).not.toBeNull();
                expect((link as HTMLAnchorElement)?.href).toBe(field.labelUrl);
                expect((link as HTMLAnchorElement)?.target).toBe('_blank');
                expect(label!.hasAttribute('for')).toBe(false);
            } else {
                expect(label?.querySelector('a')).toBeNull();
            }
        });

        it('renders groups in the order their first field appears', () => {
            const fields: readonly ConfigField[] = [
                { key: 'debug', label: 'Debug', type: 'checkbox', default: false, group: 'debug' },
                { key: 'cacheTtl', label: 'Cache TTL', type: 'text', default: '30', group: 'cache' },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, {});

            const titles = [...container.querySelectorAll('.settings-group-title')].map(element => element.textContent);
            expect(titles).toEqual([GROUPS.debug.label, GROUPS.cache.label]);
        });

        it('associates a lone field label and leaves grouped row labels unassociated', () => {
            view.render(container, {});

            expect(container.querySelector('label[for="fm-debug"]')).not.toBeNull();

            const groupedLabel = Array.from(container.querySelectorAll('label')).find(
                element => element.textContent === ROW_LABELS.services.label
            );
            expect(groupedLabel).toBeDefined();
            expect(groupedLabel?.hasAttribute('for')).toBe(false);
        });

        it('injects styles and applies the settings container class', () => {
            view.render(container, {});

            expect(container.classList.contains('fm-settings-container')).toBe(true);
            const style = document.head.querySelector('style#flixmonkey-settings-styles');
            expect(style).not.toBeNull();
            expect(style?.textContent).toContain('.fm-settings-container');
        });

        it('injects modal styles along with settings styles', () => {
            view.render(container, {});

            const style = document.head.querySelector('style#flixmonkey-settings-styles');
            expect(style).not.toBeNull();
            expect(style?.textContent).toContain('.fm-modal-overlay');
        });

        it('renders suffix text for fields with suffix property', () => {
            const fields: readonly ConfigField[] = [
                { key: 'cacheDays', type: 'text', label: 'Cache Days', default: '30', suffix: 'days', group: 'cache' },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, { cacheDays: '30' });

            const suffixEl = container.querySelector('.field-suffix');
            expect(suffixEl).not.toBeNull();
            expect(suffixEl?.textContent).toBe('days');
        });

        it('adds field--checkbox modifier for single checkbox fields', () => {
            const fields: readonly ConfigField[] = [
                { key: 'singleCheckbox', type: 'checkbox', label: 'Single Checkbox', default: true, group: 'display' },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, { singleCheckbox: true });

            const fieldEl = container.querySelector('.field--checkbox');
            expect(fieldEl).not.toBeNull();
        });

        it('adds field--actions modifier and hides label for action rows through CSS', () => {
            const fields: readonly ConfigField[] = [
                {
                    key: 'clearCache',
                    type: 'action',
                    label: '',
                    group: 'debug',
                    actionLabel: 'Clear',
                },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, {});

            const actionField = container.querySelector('.field--actions');
            expect(actionField).not.toBeNull();

            const label = actionField?.querySelector('.field-label') as HTMLElement;
            expect(label).not.toBeNull();
            expect(label.style.visibility).toBe('');
            expect(getComputedStyle(label).visibility).toBe('hidden');
        });

        it('renders action buttons and status placeholder', () => {
            view.render(container, {});

            expect(container.querySelector('#fm-clearCache')).not.toBeNull();
            expect(container.querySelector('#fm-clearCacheWithIds')).not.toBeNull();
            expect(container.querySelector('#fm-resetClients')).not.toBeNull();
            expect(container.querySelector('#fm-status')).not.toBeNull();
        });

        it('renders an action field that shares a row with a non-action field', () => {
            // An action field is keyed by its own `key`, so it only joins another field's
            // row when the two share an id. The row is then neither all-action nor a
            // checkbox group, so the mixed layout renders the action as a button.
            const fields: readonly ConfigField[] = [
                {
                    key: 'debug',
                    label: 'Debug logging',
                    type: 'checkbox',
                    default: false,
                    group: 'debug',
                    row: 'debug-settings',
                },
                {
                    key: 'debug-settings',
                    type: 'action',
                    label: '',
                    group: 'debug',
                    actionLabel: 'Run It',
                },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, {});

            const row = container.querySelector('.field-value');
            expect(row?.querySelector('#fm-debug')).not.toBeNull();
            expect(row?.querySelectorAll('#fm-debug-settings')).toHaveLength(1);
        });

        it('renders the fixed IMDb rating control', () => {
            view.render(container, {});

            const checkbox = container.querySelector('#fm-showImdbRating') as HTMLInputElement;
            expect(checkbox.type).toBe('checkbox');
            expect(checkbox.checked).toBe(true);
            expect(checkbox.disabled).toBe(true);
        });
    });
    describe('field population', () => {
        it.each(settingFields)('renders $key with its default', field => {
            view.render(container, {});

            const input = container.querySelector(`#fm-${field.key}`) as HTMLInputElement | HTMLSelectElement;
            const value = field.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value;

            expect(value).toBe(field.default);
        });

        it.each(settingFields)('renders $key with its stored value', field => {
            const storedValue = storedValueFor(field);
            view.render(container, { [field.key]: storedValue });

            const input = container.querySelector(`#fm-${field.key}`) as HTMLInputElement | HTMLSelectElement;
            const value = field.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value;

            expect(value).toBe(storedValue);
        });

        it('uses configured defaults for optional rating fields', () => {
            const fields: readonly ConfigField[] = [
                {
                    key: 'showMcRating',
                    label: 'Metacritic',
                    type: 'checkbox',
                    default: true,
                    group: 'display',
                    row: 'ratings-display',
                },
            ];
            view = new SettingsView(fields, actions);

            view.render(container, {});

            expect((container.querySelector('#fm-showMcRating') as HTMLInputElement).checked).toBe(true);
        });
    });
    describe('validation', () => {
        it('returns errors and marks invalid fields', () => {
            view.render(container, {});
            const input = container.querySelector('#fm-fadeRatingThreshold') as HTMLInputElement;
            input.value = 'abc';

            const errors = view.validate(view.readValues());

            expect(errors.length).toBeGreaterThan(0);
            expect(container.querySelector('#fm-fadeRatingThreshold')?.classList.contains('error')).toBe(true);
            expect(container.querySelector('.error-message')).toBeNull();
        });

        it('passes checked values to checkbox validators', () => {
            const validate = vi.fn().mockReturnValue(undefined);
            const fields: readonly ConfigField[] = [
                {
                    key: 'testCheckbox',
                    label: 'Test Checkbox',
                    type: 'checkbox',
                    default: false,
                    group: 'display',
                    validate,
                },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, {});
            const testCheckbox = container.querySelector('#fm-testCheckbox') as HTMLInputElement;
            testCheckbox.checked = true;
            const values = view.readValues();

            view.validate(values);

            expect(validate).toHaveBeenCalledWith(true, { testCheckbox: true });
        });
    });
    it('wires each button to its supplied action', () => {
        view.render(container, {});

        (container.querySelector('#fm-clearCache') as HTMLElement)?.click();
        (container.querySelector('#fm-clearCacheWithIds') as HTMLElement)?.click();
        (container.querySelector('#fm-resetClients') as HTMLElement)?.click();

        expect(actions.onClearCache).toHaveBeenCalledOnce();
        expect(actions.onClearCacheWithIds).toHaveBeenCalledOnce();
        expect(actions.onResetClients).toHaveBeenCalledOnce();
    });
    describe('view state', () => {
        it('returns an empty snapshot before the view renders', () => {
            expect(view.readValues()).toEqual({});
        });
        it('returns one snapshot from its rendered fields', () => {
            const fields: readonly ConfigField[] = [
                { key: 'debug', label: 'Debug', type: 'checkbox', default: false, group: 'debug' },
            ];
            const localView = new SettingsView(fields, {
                onSave: vi.fn(),
                onClearCache: vi.fn(),
                onClearCacheWithIds: vi.fn(),
                onResetClients: vi.fn(),
            });
            const localContainer = document.createElement('div');
            localView.render(localContainer, {});
            const debugInput = localContainer.querySelector('#fm-debug') as HTMLInputElement;
            debugInput.checked = true;

            expect(localView.readValues()).toEqual({ debug: true });
        });
        it('omits disabled fields', () => {
            const fields: readonly ConfigField[] = [
                { key: 'enabledField', type: 'text', label: 'Enabled Field', default: 'value', group: 'display' },
                {
                    key: 'disabledField',
                    type: 'text',
                    label: 'Disabled Field',
                    default: 'value',
                    disabled: true,
                    group: 'display',
                },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, { enabledField: 'test', disabledField: 'ignored' });

            const values = view.readValues();
            expect(values).toHaveProperty('enabledField');
            expect(values).not.toHaveProperty('disabledField');
        });
        it('scopes reads and status updates to its rendered container', () => {
            const fields: readonly ConfigField[] = [
                { key: 'debug', label: 'Debug', type: 'checkbox', default: false, group: 'debug' },
            ];
            const otherContainer = document.createElement('div');
            const otherView = new SettingsView(fields, actions);
            view = new SettingsView(fields, actions);
            document.body.appendChild(otherContainer);
            view.render(container, {});
            otherView.render(otherContainer, {});
            const debugInput = container.querySelector('#fm-debug') as HTMLInputElement;
            debugInput.checked = true;

            view.showStatus('First', 'success');

            expect(view.readValues()).toEqual({ debug: true });
            expect(otherView.readValues()).toEqual({ debug: false });
            expect(container.querySelector('[id="fm-status"]')?.textContent).toBe('First');
            expect((container.querySelector('[id="fm-status"]') as HTMLElement)?.className).toBe(
                'status status--success'
            );
            expect(otherContainer.querySelector('[id="fm-status"]')?.textContent).toBe('');
        });
    });

    describe('auto-save', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it.each([
            {
                fieldType: 'checkbox',
                inputId: 'fm-checkboxField',
                eventName: 'change',
                value: true,
                isSelect: false,
            },
            {
                fieldType: 'text',
                inputId: 'fm-textField',
                eventName: 'input',
                value: 'new-value',
                isSelect: false,
            },
            {
                fieldType: 'select',
                inputId: 'fm-selectField',
                eventName: 'input',
                value: 'option2',
                isSelect: true,
            },
        ])(
            'uses the $eventName event to autosave $fieldType fields',
            ({ fieldType, inputId, eventName, value, isSelect }) => {
                let field: ConfigField;
                if (isSelect) {
                    field = {
                        key: 'selectField',
                        label: 'Select',
                        type: 'select',
                        default: 'option1',
                        options: ['option1', 'option2'],
                        group: 'display',
                    };
                } else if (fieldType === 'checkbox') {
                    field = {
                        key: 'checkboxField',
                        label: 'Checkbox',
                        type: 'checkbox',
                        default: false,
                        group: 'display',
                    };
                } else {
                    field = { key: 'textField', label: 'Text', type: 'text', default: '', group: 'display' };
                }

                view = new SettingsView([field], actions);
                view.render(container, {});

                const input = container.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement;
                if (isSelect) {
                    (input as HTMLSelectElement).value = String(value);
                } else if (fieldType === 'checkbox') {
                    (input as HTMLInputElement).checked = Boolean(value);
                } else {
                    (input as HTMLInputElement).value = String(value);
                }
                input.dispatchEvent(new Event(eventName, { bubbles: true }));

                vi.advanceTimersByTime(1000);

                expect(actions.onSave).toHaveBeenCalledOnce();
            }
        );

        it('debounces save calls on rapid text input changes', () => {
            view.render(container, {});
            const textInput = container.querySelector('#fm-xmdbApiKey') as HTMLInputElement;

            textInput.value = 'a';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            textInput.value = 'ab';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            textInput.value = 'abc';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));

            expect(actions.onSave).not.toHaveBeenCalled();

            vi.advanceTimersByTime(500);
            expect(actions.onSave).not.toHaveBeenCalled();

            vi.advanceTimersByTime(500);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('cancels previous debounce timer when new event occurs', () => {
            view.render(container, {});
            const textInput = container.querySelector('#fm-xmdbApiKey') as HTMLInputElement;

            textInput.value = 'first';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));

            vi.advanceTimersByTime(500);
            expect(actions.onSave).not.toHaveBeenCalled();

            textInput.value = 'second';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));

            vi.advanceTimersByTime(500);
            expect(actions.onSave).not.toHaveBeenCalled();

            vi.advanceTimersByTime(500);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });
    });
});
