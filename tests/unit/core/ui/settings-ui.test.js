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

describe('SettingsUI', () => {
    let adapter;
    let settingsUI;
    let container;

    beforeEach(() => {
        adapter = {
            storageGetAll: vi.fn().mockResolvedValue({
                xmdbApiKey: 'test-xmdb-key',
                omdbApiKey: 'test-omdb-key',
                apiClient: 'omdb',
                showRtRating: false,
            }),
        };
        settingsUI = new SettingsUI(adapter);
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
        adapter.storageGetAll.mockResolvedValue(null);
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
});
