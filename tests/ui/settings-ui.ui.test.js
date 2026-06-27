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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsUI } from '../../src/core/ui/settings-ui.js';
import { CONFIG_FIELDS } from '../../src/core/config-fields.js';

describe('Settings UI', () => {
    const mockAdapter = {
        storageGetAll: vi.fn().mockResolvedValue({}),
        storageSetMany: vi.fn().mockResolvedValue({}),
        setConfigData: vi.fn(),
    };
    const mockManagers = {
        cacheManager: {
            clear: vi.fn().mockResolvedValue(undefined),
        },
        disabledClientsManager: {
            resetAll: vi.fn().mockResolvedValue([]),
        },
    };

    const renderUI = async () => {
        const container = document.getElementById('container');
        const ui = new SettingsUI(
            mockAdapter,
            undefined,
            mockManagers.cacheManager,
            mockManagers.disabledClientsManager
        );
        await ui.render(container);
        return { ui, container };
    };

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '<div id="container"></div>';
        vi.clearAllMocks();
        mockAdapter.storageGetAll.mockResolvedValue({});
        mockManagers.disabledClientsManager.resetAll.mockResolvedValue([]);
    });

    it('should render the settings container and inject styles', async () => {
        const { container } = await renderUI();

        expect(container.classList.contains('fm-settings-container')).toBe(true);
        expect(document.getElementById('flixmonkey-settings-styles')).not.toBeNull();
    });

    it('should render title, fields, and action buttons', async () => {
        const { container } = await renderUI();

        expect(container.querySelector('h1').textContent).toBe('FlixMonkey Settings');
        expect(container.querySelectorAll('.field').length).toBeGreaterThan(0);
        expect(document.getElementById('fm-saveBtn')).not.toBeNull();
        expect(document.getElementById('fm-clearCacheBtn')).not.toBeNull();
        expect(document.getElementById('fm-resetClientsBtn')).not.toBeNull();
    });

    it('should render overlayCorner as a select with all corner options', async () => {
        const { container } = await renderUI();
        const select = container.querySelector('#fm-overlayCorner');

        expect(select.tagName).toBe('SELECT');
        const values = [...select.options].map(o => o.value);
        expect(values).toEqual(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    });

    it('should render apiClient select with [value, label] tuple options', async () => {
        const { container } = await renderUI();
        const select = container.querySelector('#fm-apiClient');

        expect(select.tagName).toBe('SELECT');
        const opt = [...select.options].find(o => o.value === 'agregarr');
        expect(opt).toBeTruthy();
        expect(opt.textContent).toBe('Agregarr');
    });

    it('should render showMcRating as a checked checkbox by default', async () => {
        const { container } = await renderUI();
        const checkbox = container.querySelector('#fm-showMcRating');

        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
    });

    it('should render a labelUrl field label as an <a> link', async () => {
        const { container } = await renderUI();
        const label = container.querySelector('label[for="fm-omdbApiKey"]');
        const link = label.querySelector('a');

        expect(link).not.toBeNull();
        expect(link.textContent).toBe('OMDB API Key');
    });

    it('should apply visually-hidden class to labelHidden field labels', async () => {
        const { container } = await renderUI();
        const label = container.querySelector('label[for="fm-fadeRatingThreshold"]');

        expect(label.classList.contains('visually-hidden')).toBe(true);
    });

    it('should apply stored select value over the field default', async () => {
        mockAdapter.storageGetAll.mockResolvedValue({ overlayCorner: 'bottom-right' });
        const { container } = await renderUI();

        expect(container.querySelector('#fm-overlayCorner').value).toBe('bottom-right');
    });

    it('should apply stored checkbox value over the field default', async () => {
        mockAdapter.storageGetAll.mockResolvedValue({ showMcRating: false });
        const { container } = await renderUI();

        expect(container.querySelector('#fm-showMcRating').checked).toBe(false);
    });

    it('should call storageSetMany with all field values on save', async () => {
        const { ui } = await renderUI();
        await ui.save();

        expect(mockAdapter.storageSetMany).toHaveBeenCalledOnce();
        const saved = mockAdapter.storageSetMany.mock.calls[0][0];
        CONFIG_FIELDS.forEach(field => {
            expect(Object.hasOwn(saved, field.key)).toBe(true);
        });
    });

    it('should display "Saved!" status in green on successful save', async () => {
        const { ui, container } = await renderUI();
        await ui.save();

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Saved!');
        expect(status.style.color).toBe('green');
    });

    it('should invoke the onSave callback after a successful save', async () => {
        const { ui } = await renderUI();
        const onSave = vi.fn().mockResolvedValue(undefined);
        ui.onSave = onSave;
        await ui.save();

        expect(onSave).toHaveBeenCalledOnce();
    });

    it('should prevent save and show an error for an invalid field value', async () => {
        const { ui, container } = await renderUI();
        container.querySelector('#fm-fadeRatingThreshold').value = 'abc';
        await ui.save();

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Please fix errors before saving.');
        expect(status.style.color).toBe('red');
        const errorEl = container
            .querySelector('#fm-fadeRatingThreshold')
            .parentElement.querySelector('.error-message');
        expect(errorEl).not.toBeNull();
        expect(mockAdapter.storageSetMany).not.toHaveBeenCalled();
    });

    it('should call cacheManager.clear() and show "Cache cleared." status', async () => {
        const { ui, container } = await renderUI();
        await ui.clearCache();

        expect(mockManagers.cacheManager.clear).toHaveBeenCalledOnce();
        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Cache cleared.');
        expect(status.style.color).toBe('green');
    });

    it('should show re-enabled client names when resetClients finds disabled clients', async () => {
        mockManagers.disabledClientsManager.resetAll.mockResolvedValue(['omdb', 'xmdb']);
        const { ui, container } = await renderUI();
        await ui.resetClients();

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('Re-enabled API clients: omdb, xmdb');
        expect(status.style.color).toBe('green');
    });

    it('should show "no clients" message when resetClients finds nothing to reset', async () => {
        const { ui, container } = await renderUI();
        await ui.resetClients();

        const status = container.querySelector('#fm-status');
        expect(status.textContent).toBe('No disabled API clients found to re-enable.');
        expect(status.style.color).toBe('green');
    });
});
