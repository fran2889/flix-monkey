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
            storageGetAll: vi.fn().mockResolvedValue({}),
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
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.body.appendChild(container);
    });

    // --- Rendering ---

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

    it('should inject styles and apply the settings container class', async () => {
        await settingsUI.render(container);

        expect(container.classList.contains('fm-settings-container')).toBe(true);
        const style = document.head.querySelector('style#flixmonkey-settings-styles');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('.fm-settings-container');
    });

    it('should render title, fields, action buttons, and status placeholder', async () => {
        await settingsUI.render(container);

        expect(container.querySelector('h1').textContent).toBe('FlixMonkey Settings');
        expect(container.querySelectorAll('.field').length).toBeGreaterThan(0);
        expect(container.querySelector('#fm-saveBtn')).not.toBeNull();
        expect(container.querySelector('#fm-clearCacheBtn')).not.toBeNull();
        expect(container.querySelector('#fm-resetClientsBtn')).not.toBeNull();
        expect(container.querySelector('#fm-status')).not.toBeNull();
    });

    it('should render overlayCorner as a select with all corner options', async () => {
        await settingsUI.render(container);
        const select = container.querySelector('#fm-overlayCorner');

        expect(select.tagName).toBe('SELECT');
        const values = [...select.options].map(o => o.value);
        expect(values).toEqual(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    });

    it('should render apiClient select with [value, label] tuple options', async () => {
        await settingsUI.render(container);
        const select = container.querySelector('#fm-apiClient');

        expect(select.tagName).toBe('SELECT');
        const opt = [...select.options].find(o => o.value === 'agregarr');
        expect(opt).toBeTruthy();
        expect(opt.textContent).toBe('Agregarr');
    });

    it('should render showMcRating as a checked checkbox by default', async () => {
        await settingsUI.render(container);
        const checkbox = container.querySelector('#fm-showMcRating');

        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
    });

    it('should render a labelUrl field label as an <a> link', async () => {
        await settingsUI.render(container);
        const label = container.querySelector('label[for="fm-omdbApiKey"]');
        const link = label.querySelector('a');

        expect(link).not.toBeNull();
        expect(link.textContent).toBe('OMDB API Key');
    });

    it('should apply visually-hidden class to labelHidden field labels', async () => {
        await settingsUI.render(container);
        const label = container.querySelector('label[for="fm-fadeRatingThreshold"]');

        expect(label.classList.contains('visually-hidden')).toBe(true);
    });

    // --- Field population ---

    it('should populate fields with values from adapter', async () => {
        mockAdapter.storageGetAll.mockResolvedValue({
            xmdbApiKey: 'test-xmdb-key',
            omdbApiKey: 'test-omdb-key',
            apiClient: 'omdb',
            showRtRating: false,
        });
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

    // --- Save ---

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

        expect(mockAdapter.storageSetMany).toHaveBeenCalledWith(expect.objectContaining({ xmdbApiKey: 'new-api-key' }));
    });

    it('should display "Saved!" status in green on successful save', async () => {
        await settingsUI.render(container);
        await settingsUI.save();

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Saved!');
        expect(status.style.color).toBe('green');
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

    // --- onSave callback ---

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

    // --- Validation ---

    it('should not save when validation fails', async () => {
        await settingsUI.render(container);
        container.querySelector('#fm-fadeRatingThreshold').value = 'abc';
        await settingsUI.save();

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Please fix errors before saving.');
        expect(status.style.color).toBe('red');
        const errorEl = container
            .querySelector('#fm-fadeRatingThreshold')
            .parentElement.querySelector('.error-message');
        expect(errorEl).not.toBeNull();
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
        const ui = new SettingsUI(mockAdapter, [checkboxField], mockCacheManager, mockDisabledClientsManager);
        await ui.render(container);

        const input = container.querySelector('#fm-testCheckbox');
        input.checked = true;

        ui._validate();

        expect(validateFn).toHaveBeenCalledWith(true, expect.any(Object));
    });

    // --- Action buttons ---

    it('should clear cache and show "Cache cleared." status in green', async () => {
        await settingsUI.render(container);
        container.querySelector('#fm-clearCacheBtn').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockCacheManager.clear).toHaveBeenCalledOnce();
        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Cache cleared.');
        expect(status.style.color).toBe('green');
    });

    it('should reset clients and show re-enabled names in green', async () => {
        mockDisabledClientsManager.resetAll.mockResolvedValue(['omdb', 'tmdb']);
        await settingsUI.render(container);
        container.querySelector('#fm-resetClientsBtn').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDisabledClientsManager.resetAll).toHaveBeenCalledOnce();
        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Re-enabled API clients: omdb, tmdb');
        expect(status.style.color).toBe('green');
    });

    it('should show no-clients message in green when there is nothing to reset', async () => {
        await settingsUI.render(container);
        container.querySelector('#fm-resetClientsBtn').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('No disabled API clients found to re-enable.');
        expect(status.style.color).toBe('green');
    });

    // --- Scoping ---

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
