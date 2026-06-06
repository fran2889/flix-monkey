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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsUI } from '../../../../src/core/ui/settings-ui.js';
import { CONFIG_FIELDS } from '../../../../src/core/config-fields.js';
import { createMockAdapter } from '../../../mocks/adapter.js';

describe('SettingsUI', () => {
    let mockAdapter;
    let settingsUI;
    let container;
    let mockCacheManager;
    let mockDisabledClientsManager;

    beforeEach(() => {
        mockAdapter = {
            storageGetAll: vi.fn().mockResolvedValue({
                xmdbApiKey: 'test-xmdb-key',
                omdbApiKey: 'test-omdb-key',
                apiClient: 'omdb',
                showRtRating: false,
            }),
            storageSetMany: vi.fn().mockResolvedValue(),
            setConfigData: vi.fn(),
        };
        mockCacheManager = {
            clear: vi.fn().mockResolvedValue(),
        };
        mockDisabledClientsManager = {
            resetAll: vi.fn().mockResolvedValue([]),
        };
        settingsUI = new SettingsUI(mockAdapter, undefined, mockCacheManager, mockDisabledClientsManager);
        container = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    it('should render all config fields', async () => {
        await settingsUI.render(container);

        CONFIG_FIELDS.forEach(field => {
            const label = Array.from(container.querySelectorAll('label')).find(el => el.textContent === field.label);
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
        });
    });

    it('should populate fields with values from adapter', async () => {
        await settingsUI.render(container);

        expect(container.querySelector('[id="fm-xmdbApiKey"]').value).toBe('test-xmdb-key');
        expect(container.querySelector('[id="fm-omdbApiKey"]').value).toBe('test-omdb-key');
        expect(container.querySelector('[id="fm-apiClient"]').value).toBe('omdb');
        expect(container.querySelector('[id="fm-showRtRating"]').checked).toBe(false);
    });

    it('should populate fields with default values if adapter returns nothing', async () => {
        mockAdapter.storageGetAll.mockResolvedValue(null);
        await settingsUI.render(container);

        const xmdbField = CONFIG_FIELDS.find(f => f.key === 'xmdbApiKey');
        expect(container.querySelector('[id="fm-xmdbApiKey"]').value).toBe(xmdbField.default);
    });

    it('should inject styles into the document', async () => {
        await settingsUI.render(container);
        const style = document.head.querySelector('style#flixmonkey-settings-styles');
        expect(style).toBeDefined();
        expect(style.textContent).toContain('.fm-settings-container');
    });

    it('should render a save button and status placeholder', async () => {
        await settingsUI.render(container);
        expect(container.querySelector('#fm-saveBtn')).toBeDefined();
        expect(container.querySelector('#fm-status')).toBeDefined();
    });

    it('should not save when validation fails', async () => {
        await settingsUI.render(container);
        const apiKeyInput = container.querySelector('[id="fm-xmdbApiKey"]');
        apiKeyInput.value = '';

        const saveBtn = container.querySelector('#fm-saveBtn');
        await saveBtn.click();

        expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
        expect(container.querySelector('#fm-status').textContent).toBe('Please fix errors before saving.');
    });

    it('should save when validation passes', async () => {
        await settingsUI.render(container);
        const apiKeyInput = container.querySelector('[id="fm-xmdbApiKey"]');
        apiKeyInput.value = 'new-api-key';

        const saveBtn = container.querySelector('#fm-saveBtn');
        await saveBtn.click();

        expect(mockAdapter.storageSetMany).toHaveBeenCalledWith(
            expect.objectContaining({
                xmdbApiKey: 'new-api-key',
            })
        );
        expect(container.querySelector('#fm-status').textContent).toBe('Saved!');
    });

    it('should clear cache when clicking Clear Cache and confirmed', async () => {
        window.confirm = vi.fn(() => true);
        await settingsUI.render(container);
        const clearBtn = container.querySelector('#fm-clearCacheBtn');
        clearBtn.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(window.confirm).toHaveBeenCalledWith('Clear all cached ratings?');
        expect(mockCacheManager.clear).toHaveBeenCalled();
        expect(container.querySelector('#fm-status').textContent).toBe('Cache cleared.');
    });

    it('should NOT clear cache if NOT confirmed', async () => {
        window.confirm = vi.fn(() => false);
        await settingsUI.render(container);
        const clearBtn = container.querySelector('#fm-clearCacheBtn');
        clearBtn.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(window.confirm).toHaveBeenCalledWith('Clear all cached ratings?');
        expect(container.querySelector('#fm-status').textContent).toBe('');
    });

    it('should reset clients when clicking Reset Disabled Clients and confirmed', async () => {
        window.confirm = vi.fn(() => true);
        await settingsUI.render(container);
        const resetBtn = container.querySelector('#fm-resetClientsBtn');
        resetBtn.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(window.confirm).toHaveBeenCalledWith('Re-enable all disabled API clients?');
        expect(mockDisabledClientsManager.resetAll).toHaveBeenCalled();
        expect(container.querySelector('#fm-status').textContent).toBe('API clients re-enabled.');
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

    it('should pass input.checked (not input.value) to validate for checkbox fields', async () => {
        const validateFn = vi.fn().mockReturnValue(null);
        const checkboxField = {
            key: 'testCheckbox',
            label: 'Test Checkbox',
            type: 'checkbox',
            default: false,
            validate: validateFn,
        };
        const ui = new SettingsUI(mockAdapter, [checkboxField], mockCacheManager, mockDisabledClientsManager);
        await ui.render(container);

        const input = container.querySelector('#fm-testCheckbox');
        input.checked = true;

        ui._validate();

        expect(validateFn).toHaveBeenCalledWith(true);
    });

    it('should scope element queries to its own container', async () => {
        const adapter = createMockAdapter({ storageGetAll: vi.fn().mockResolvedValue({}), setConfigData: vi.fn() });
        const container1 = document.createElement('div');
        const container2 = document.createElement('div');
        document.body.append(container1, container2);
        const ui1 = new SettingsUI(adapter, undefined, { clear: vi.fn() }, { resetAll: vi.fn() });
        const ui2 = new SettingsUI(adapter, undefined, { clear: vi.fn() }, { resetAll: vi.fn() });
        await ui1.render(container1);
        await ui2.render(container2);
        const statusInContainer1 = container1.querySelector('[id="fm-status"]');
        const statusInContainer2 = container2.querySelector('[id="fm-status"]');
        expect(statusInContainer1).not.toBeNull();
        expect(statusInContainer2).not.toBeNull();
        expect(statusInContainer1).not.toBe(statusInContainer2);
    });
});
