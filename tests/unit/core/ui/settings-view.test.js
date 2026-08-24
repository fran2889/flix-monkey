/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONFIG_FIELDS } from '../../../../src/core/config-fields.js';
import { SettingsView } from '../../../../src/core/ui/settings-view.js';

describe('SettingsView', () => {
    it('reads one value snapshot from its rendered fields', () => {
        const fields = [{ key: 'debug', label: 'Debug', type: 'checkbox', default: false }];
        const view = new SettingsView(fields, {
            onSave: vi.fn(),
            onClearCache: vi.fn(),
            onResetClients: vi.fn(),
        });
        const container = document.createElement('div');
        view.render(container, {});
        container.querySelector('#fm-debug').checked = true;

        expect(view.readValues()).toEqual({ debug: true });
    });

    let actions;
    let container;
    let view;

    beforeEach(() => {
        actions = {
            onSave: vi.fn(),
            onClearCache: vi.fn(),
            onResetClients: vi.fn(),
        };
        container = document.createElement('div');
        view = new SettingsView(CONFIG_FIELDS, actions);
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    describe('Rendering', () => {
        it('renders each config field from its definition', () => {
            view.render(container, {});

            CONFIG_FIELDS.forEach(field => {
                const label = Array.from(container.querySelectorAll('label')).find(
                    element => element.textContent === field.label
                );
                expect(label, `Label for ${field.key} not found`).toBeDefined();
                expect(label.htmlFor).toBe(`fm-${field.key}`);

                const input = container.querySelector(`[id="fm-${field.key}"]`);
                expect(input, `Input for ${field.key} not found`).toBeDefined();

                if (field.type === 'select') {
                    expect(input.tagName).toBe('SELECT');
                } else if (field.type === 'checkbox') {
                    expect(input.type).toBe('checkbox');
                } else {
                    expect(input.type).toBe('text');
                }

                if (field.type === 'select') {
                    expect([...input.options].map(option => [option.value, option.textContent])).toEqual(
                        field.options.map(option => (Array.isArray(option) ? option : [option, option]))
                    );
                }

                if (field.labelUrl) {
                    const link = label.querySelector('a');
                    expect(link).not.toBeNull();
                    expect(link.href).toBe(field.labelUrl);
                    expect(link.target).toBe('_blank');
                } else {
                    expect(label.querySelector('a')).toBeNull();
                }

                expect(label.classList.contains('visually-hidden')).toBe(Boolean(field.labelHidden));
            });
        });

        it('injects styles and applies the settings container class', () => {
            view.render(container, {});

            expect(container.classList.contains('fm-settings-container')).toBe(true);
            const style = document.head.querySelector('style#flixmonkey-settings-styles');
            expect(style).not.toBeNull();
            expect(style.textContent).toContain('.fm-settings-container');
        });

        it('does not add vertical spacing when service controls wrap', () => {
            view.render(container, {});

            const style = document.head.querySelector('style#flixmonkey-settings-styles');
            expect(style.textContent).toMatch(
                /\.services-field \.services-group \{\s*display: flex;\s*align-items: center;\s*column-gap: 20px;\s*row-gap: 0;/u
            );
        });

        it('renders action buttons and status placeholder', () => {
            view.render(container, {});

            expect(container.querySelector('#fm-clearCacheBtn')).not.toBeNull();
            expect(container.querySelector('#fm-resetClientsBtn')).not.toBeNull();
            expect(container.querySelector('#fm-status')).not.toBeNull();
        });

        it('renders the fixed IMDb rating control', () => {
            view.render(container, {});

            const checkbox = container.querySelector('#fm-showImdbRating');
            expect(checkbox.type).toBe('checkbox');
            expect(checkbox.checked).toBe(true);
            expect(checkbox.disabled).toBe(true);
        });
    });

    describe('Field population', () => {
        it('populates every field with its default when settings are empty', () => {
            view.render(container, {});

            CONFIG_FIELDS.forEach(field => {
                const input = container.querySelector(`#fm-${field.key}`);
                const value = field.type === 'checkbox' ? input.checked : input.value;
                expect(value).toBe(field.default);
            });
        });

        it('populates every field with its stored value', () => {
            const storedSettings = Object.fromEntries(
                CONFIG_FIELDS.map(field => {
                    if (field.type === 'checkbox') return [field.key, !field.default];
                    if (field.type === 'select') {
                        const optionValues = field.options.map(option => (Array.isArray(option) ? option[0] : option));
                        return [field.key, optionValues.find(option => option !== field.default)];
                    }
                    return [field.key, `stored-${field.key}`];
                })
            );

            view.render(container, storedSettings);

            CONFIG_FIELDS.forEach(field => {
                const input = container.querySelector(`#fm-${field.key}`);
                const value = field.type === 'checkbox' ? input.checked : input.value;
                expect(value).toBe(storedSettings[field.key]);
            });
        });

        it('uses configured defaults for optional rating fields', () => {
            const fields = [
                {
                    key: 'showMcRating',
                    label: 'Metacritic',
                    type: 'checkbox',
                    default: true,
                    row: 'ratings-display',
                },
            ];
            view = new SettingsView(fields, actions);

            view.render(container, {});

            expect(container.querySelector('#fm-showMcRating').checked).toBe(true);
        });
    });

    describe('Validation', () => {
        it('returns errors and marks invalid fields', () => {
            view.render(container, {});
            container.querySelector('#fm-fadeRatingThreshold').value = 'abc';

            const errors = view.validate(view.readValues());

            expect(errors.length).toBeGreaterThan(0);
            expect(container.querySelector('#fm-fadeRatingThreshold').classList.contains('error')).toBe(true);
            expect(container.querySelector('.error-message')).toBeNull();
        });

        it('passes checked values to checkbox validators', () => {
            const validate = vi.fn().mockReturnValue(null);
            const fields = [
                {
                    key: 'testCheckbox',
                    label: 'Test Checkbox',
                    type: 'checkbox',
                    default: false,
                    validate,
                },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, {});
            container.querySelector('#fm-testCheckbox').checked = true;
            const values = view.readValues();

            view.validate(values);

            expect(validate).toHaveBeenCalledWith(true, { testCheckbox: true });
        });
    });

    describe('Actions', () => {
        it('wires each button to its supplied action', () => {
            view.render(container, {});

            container.querySelector('#fm-clearCacheBtn').click();
            container.querySelector('#fm-resetClientsBtn').click();

            expect(actions.onClearCache).toHaveBeenCalledOnce();
            expect(actions.onResetClients).toHaveBeenCalledOnce();
        });
    });

    describe('Scoping', () => {
        it('scopes reads and status updates to its rendered container', () => {
            const fields = [{ key: 'debug', label: 'Debug', type: 'checkbox', default: false }];
            const otherContainer = document.createElement('div');
            const otherView = new SettingsView(fields, actions);
            view = new SettingsView(fields, actions);
            document.body.appendChild(otherContainer);
            view.render(container, {});
            otherView.render(otherContainer, {});
            container.querySelector('#fm-debug').checked = true;

            view.showStatus('First', 'success');

            expect(view.readValues()).toEqual({ debug: true });
            expect(otherView.readValues()).toEqual({ debug: false });
            expect(container.querySelector('[id="fm-status"]').textContent).toBe('First');
            expect(container.querySelector('[id="fm-status"]').className).toBe('fm-status--success');
            expect(otherContainer.querySelector('[id="fm-status"]').textContent).toBe('');
        });
    });

    describe('Auto-save', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('uses change event for checkboxes', () => {
            const fields = [{ key: 'checkboxField', label: 'Checkbox', type: 'checkbox', default: false }];
            view = new SettingsView(fields, actions);
            view.render(container, {});

            const checkbox = container.querySelector('#fm-checkboxField');

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));

            vi.advanceTimersByTime(1000);

            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('uses input event for text fields', () => {
            const fields = [{ key: 'textField', label: 'Text', type: 'text', default: '' }];
            view = new SettingsView(fields, actions);
            view.render(container, {});

            const textInput = container.querySelector('#fm-textField');

            textInput.value = 'new-value';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));

            vi.advanceTimersByTime(1000);

            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('uses input event for select fields', () => {
            const fields = [
                {
                    key: 'selectField',
                    label: 'Select',
                    type: 'select',
                    default: 'option1',
                    options: ['option1', 'option2'],
                },
            ];
            view = new SettingsView(fields, actions);
            view.render(container, {});

            const select = container.querySelector('#fm-selectField');

            select.value = 'option2';
            select.dispatchEvent(new Event('input', { bubbles: true }));

            vi.advanceTimersByTime(1000);

            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('debounces save calls on rapid text input changes', () => {
            view.render(container, {});
            const textInput = container.querySelector('#fm-xmdbApiKey');

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

        it('triggers save after debounce period on text input', () => {
            view.render(container, {});
            const textInput = container.querySelector('#fm-xmdbApiKey');

            textInput.value = 'new-api-key';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));

            expect(actions.onSave).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('triggers save immediately on checkbox change', () => {
            view.render(container, {});
            const checkbox = container.querySelector('#fm-debug');

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));

            vi.advanceTimersByTime(1000);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('triggers save on select change', () => {
            view.render(container, {});
            const select = container.querySelector('#fm-apiClient');

            select.value = 'omdb';
            select.dispatchEvent(new Event('input', { bubbles: true }));

            vi.advanceTimersByTime(1000);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('debounces multiple rapid changes into a single save', () => {
            view.render(container, {});
            const textInput = container.querySelector('#fm-xmdbApiKey');

            for (let i = 0; i < 10; i++) {
                textInput.value = `value${i}`;
                textInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            expect(actions.onSave).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('uses change event for rating checkboxes', () => {
            view.render(container, {});
            const checkbox = container.querySelector('#fm-showRtRating');

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));

            vi.advanceTimersByTime(1000);
            expect(actions.onSave).toHaveBeenCalledOnce();
        });

        it('cancels previous debounce timer when new event occurs', () => {
            view.render(container, {});
            const textInput = container.querySelector('#fm-xmdbApiKey');

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
