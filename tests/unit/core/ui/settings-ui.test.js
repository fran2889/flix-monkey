/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '../../../../src/core/cache.js';
import { CONFIG_FIELDS } from '../../../../src/core/config-fields.js';
import { ConfigManager } from '../../../../src/core/config-manager.js';
import { DisabledClientsManager } from '../../../../src/core/disabled-clients.js';
import { Logger } from '../../../../src/core/logger.js';
import { SettingsUI } from '../../../../src/core/ui/settings-ui.js';
import { createMockAdapter } from '../../../mocks/adapter.js';

describe('SettingsUI', () => {
    let mockAdapter;
    let settingsUI;
    let container;
    let mockCacheManager;
    let mockDisabledClientsManager;

    beforeEach(() => {
        mockAdapter = createMockAdapter();
        mockCacheManager = new CacheManager(mockAdapter, new ConfigManager(mockAdapter), new Logger(mockAdapter));
        mockDisabledClientsManager = new DisabledClientsManager(mockAdapter);
        vi.spyOn(mockCacheManager, 'clear').mockResolvedValue();
        vi.spyOn(mockDisabledClientsManager, 'resetAll').mockResolvedValue([]);
        settingsUI = new SettingsUI(mockAdapter, mockCacheManager, mockDisabledClientsManager);
        container = document.createElement('div');
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    describe('Rendering', () => {
        it('should render each config field from its definition', async () => {
            await settingsUI.render(container);

            CONFIG_FIELDS.forEach(field => {
                const label = Array.from(container.querySelectorAll('label')).find(
                    el => el.textContent === field.label
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

        it('should inject styles and apply the settings container class', async () => {
            await settingsUI.render(container);

            expect(container.classList.contains('fm-settings-container')).toBe(true);
            const style = document.head.querySelector('style#flixmonkey-settings-styles');
            expect(style).not.toBeNull();
            expect(style.textContent).toContain('.fm-settings-container');
        });

        it('should not add vertical spacing when service controls wrap', async () => {
            await settingsUI.render(container);

            const style = document.head.querySelector('style#flixmonkey-settings-styles');
            expect(style.textContent).toMatch(
                /\.services-field \.services-group \{\s*display: flex;\s*align-items: center;\s*column-gap: 20px;\s*row-gap: 0;/u
            );
        });

        it('should render action buttons and status placeholder', async () => {
            await settingsUI.render(container);

            expect(container.querySelector('#fm-saveBtn')).not.toBeNull();
            expect(container.querySelector('#fm-clearCacheBtn')).not.toBeNull();
            expect(container.querySelector('#fm-resetClientsBtn')).not.toBeNull();
            expect(container.querySelector('#fm-status')).not.toBeNull();
        });

        it('should render the fixed IMDb rating control', async () => {
            await settingsUI.render(container);

            const checkbox = container.querySelector('#fm-showImdbRating');
            expect(checkbox.type).toBe('checkbox');
            expect(checkbox.checked).toBe(true);
            expect(checkbox.disabled).toBe(true);
        });
    });

    describe('Field population', () => {
        it('should populate every field with its default when storage is empty', async () => {
            mockAdapter.storageGetAll.mockResolvedValue(null);
            await settingsUI.render(container);

            CONFIG_FIELDS.forEach(field => {
                const input = container.querySelector(`#fm-${field.key}`);
                const value = field.type === 'checkbox' ? input.checked : input.value;
                expect(value).toBe(field.default);
            });
        });

        it('should populate every field with its stored value', async () => {
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
            mockAdapter.storageGetAll.mockResolvedValue(storedSettings);
            await settingsUI.render(container);

            CONFIG_FIELDS.forEach(field => {
                const input = container.querySelector(`#fm-${field.key}`);
                const value = field.type === 'checkbox' ? input.checked : input.value;
                expect(value).toBe(storedSettings[field.key]);
            });
        });
    });

    describe('Save', () => {
        it('should call storageSetMany with all field values on save', async () => {
            await settingsUI.render(container);
            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
            const saved = mockAdapter.storageSetMany.mock.calls[0][0];
            CONFIG_FIELDS.forEach(field => {
                expect(Object.hasOwn(saved, field.key)).toBe(true);
            });
        });

        it('should capture updated input values on save', async () => {
            await settingsUI.render(container);
            container.querySelector('[id="fm-xmdbApiKey"]').value = 'new-api-key';
            await settingsUI.save();

            expect(mockAdapter.storageSetMany).toHaveBeenCalledWith(
                expect.objectContaining({ xmdbApiKey: 'new-api-key' })
            );
        });

        it('should display "Saved!" status with success class on successful save', async () => {
            await settingsUI.render(container);
            await settingsUI.save();

            const status = container.querySelector('#fm-status');
            expect(status.textContent).toBe('Saved!');
            expect(status.className).toBe('fm-status--success');
        });

        it('should disable the save button while saving and re-enable it after', async () => {
            let resolveStorage;
            mockAdapter.storageSetMany = vi.fn().mockReturnValue(
                new Promise(resolve => {
                    resolveStorage = resolve;
                })
            );

            await settingsUI.render(container);
            const saveBtn = container.querySelector('#fm-saveBtn');

            const savePromise = settingsUI.save();
            expect(saveBtn.disabled).toBe(true);

            resolveStorage();
            await savePromise;

            expect(saveBtn.disabled).toBe(false);
        });
    });

    describe('onSave callback', () => {
        it('should call onSave callback after successful save', async () => {
            await settingsUI.render(container);
            const onSave = vi.fn().mockResolvedValue(undefined);
            settingsUI.onSave = onSave;

            await settingsUI.save();

            expect(onSave).toHaveBeenCalledOnce();
        });

        it('should not call onSave callback when validation fails', async () => {
            await settingsUI.render(container);
            const onSave = vi.fn();
            settingsUI.onSave = onSave;

            container.querySelector('[id="fm-apiClient"]').value = 'xmdb';
            container.querySelector('[id="fm-xmdbApiKey"]').value = '';

            await settingsUI.save();

            expect(onSave).not.toHaveBeenCalled();
        });

        it('should not call onSave callback when storageSetMany throws', async () => {
            mockAdapter.storageSetMany.mockRejectedValue(new Error('storage error'));
            await settingsUI.render(container);
            const onSave = vi.fn();
            settingsUI.onSave = onSave;

            await expect(settingsUI.save()).rejects.toThrow('storage error');

            expect(onSave).not.toHaveBeenCalled();
        });
    });

    describe('Validation', () => {
        it('should not save when validation fails', async () => {
            await settingsUI.render(container);
            container.querySelector('#fm-fadeRatingThreshold').value = 'abc';
            await settingsUI.save();

            const status = container.querySelector('#fm-status');
            expect(status.textContent.length).toBeGreaterThan(0);
            expect(status.className).toBe('fm-status--error');
            expect(container.querySelector('#fm-fadeRatingThreshold').classList.contains('error')).toBe(true);
            expect(container.querySelector('.error-message')).toBeNull();
            expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
        });

        it('should pass input.checked (not input.value) to validate for checkbox fields', async () => {
            const validateFn = vi.fn().mockReturnValue(null);
            const checkboxField = {
                key: 'testCheckbox',
                label: 'Test Checkbox',
                type: 'checkbox',
                default: false,
                validate: validateFn,
            };
            const ui = new SettingsUI(mockAdapter, mockCacheManager, mockDisabledClientsManager, [checkboxField]);
            await ui.render(container);

            const input = container.querySelector('#fm-testCheckbox');
            input.checked = true;

            await ui.save();

            expect(validateFn).toHaveBeenCalledWith(true, expect.any(Object));
        });
    });

    describe('Action buttons', () => {
        it('should clear cache and show "Cache cleared." status in green', async () => {
            await settingsUI.render(container);
            container.querySelector('#fm-clearCacheBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockCacheManager.clear).toHaveBeenCalledOnce();
            const status = container.querySelector('#fm-status');
            expect(status.textContent).toBe('Cache cleared.');
            expect(status.className).toBe('fm-status--success');
        });

        it('should reset clients and show re-enabled names in green', async () => {
            mockDisabledClientsManager.resetAll.mockResolvedValue(['omdb', 'tmdb']);
            await settingsUI.render(container);
            container.querySelector('#fm-resetClientsBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockDisabledClientsManager.resetAll).toHaveBeenCalledOnce();
            const status = container.querySelector('#fm-status');
            expect(status.textContent).toBe('Re-enabled API clients: omdb, tmdb');
            expect(status.className).toBe('fm-status--success');
        });

        it('should show no-clients message in green when there is nothing to reset', async () => {
            await settingsUI.render(container);
            container.querySelector('#fm-resetClientsBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            const status = container.querySelector('#fm-status');
            expect(status.textContent).toBe('No disabled API clients found to re-enable.');
            expect(status.className).toBe('fm-status--success');
        });

        it('should show error in red when clearCache fails', async () => {
            mockCacheManager.clear.mockRejectedValue(new Error('disk full'));
            await settingsUI.render(container);
            container.querySelector('#fm-clearCacheBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            const status = container.querySelector('#fm-status');
            expect(status.textContent).toBe('Error: disk full');
            expect(status.className).toBe('fm-status--error');
        });

        it('should show error in red when resetClients fails', async () => {
            mockDisabledClientsManager.resetAll.mockRejectedValue(new Error('storage unavailable'));
            await settingsUI.render(container);
            container.querySelector('#fm-resetClientsBtn').click();
            await new Promise(resolve => setTimeout(resolve, 0));

            const status = container.querySelector('#fm-status');
            expect(status.textContent).toBe('Error: storage unavailable');
            expect(status.className).toBe('fm-status--error');
        });
    });

    describe('Scoping', () => {
        it('should scope element queries to its own container', async () => {
            const adapter = createMockAdapter({ storageGetAll: vi.fn().mockResolvedValue({}), setConfigData: vi.fn() });
            const container1 = document.createElement('div');
            const container2 = document.createElement('div');
            document.body.append(container1, container2);
            const ui1 = new SettingsUI(adapter, { clear: vi.fn() }, { resetAll: vi.fn() });
            const ui2 = new SettingsUI(adapter, { clear: vi.fn() }, { resetAll: vi.fn() });
            await ui1.render(container1);
            await ui2.render(container2);
            const statusInContainer1 = container1.querySelector('[id="fm-status"]');
            const statusInContainer2 = container2.querySelector('[id="fm-status"]');
            expect(statusInContainer1).not.toBeNull();
            expect(statusInContainer2).not.toBeNull();
            expect(statusInContainer1).not.toBe(statusInContainer2);
        });
    });
});
