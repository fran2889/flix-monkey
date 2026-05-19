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
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CONFIG_FIELDS, CONFIG_DEFAULTS } from '../../src/core/config-fields.js';

// Mock webextension-polyfill BEFORE importing options.js
vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                get: vi.fn(),
                set: vi.fn(),
            },
        },
    },
}));

import browser from 'webextension-polyfill';
import { init } from '../../src/targets/extension/options.js';

describe('Options UI', () => {
    let optionsHtml;

    beforeAll(() => {
        const htmlPath = path.resolve(__dirname, '../../src/targets/extension/options.html');
        optionsHtml = fs.readFileSync(htmlPath, 'utf8');
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup DOM
        const bodyMatch = optionsHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        document.body.innerHTML = bodyMatch ? bodyMatch[1] : optionsHtml;

        // Mock window.confirm
        window.confirm = vi.fn(() => true);

        // Mock storage default behavior
        browser.storage.local.get.mockResolvedValue({});

        // Initialize the UI
        await init();
    });

    it('should render all config fields from CONFIG_FIELDS', () => {
        const fields = document.querySelectorAll('.field');
        expect(fields.length).toBe(CONFIG_FIELDS.length);

        CONFIG_FIELDS.forEach(f => {
            const label = document.querySelector(`label[for="field_${f.key}"]`);
            const input = document.getElementById(`field_${f.key}`);

            expect(label).not.toBeNull();
            expect(label.textContent).toBe(f.label);
            expect(input).not.toBeNull();
            expect(input.dataset.key).toBe(f.key);
        });
    });

    it('should load default values if storage is empty', () => {
        CONFIG_FIELDS.forEach(f => {
            const input = document.getElementById(`field_${f.key}`);
            const expectedValue = String(CONFIG_DEFAULTS[f.key]);

            if (f.type === 'checkbox') {
                expect(input.checked).toBe(CONFIG_DEFAULTS[f.key]);
            } else {
                expect(input.value).toBe(expectedValue);
            }
        });
    });

    it('should load saved values from storage', async () => {
        const customValues = {
            xmdbApiKey: 'custom-key',
            showRtRating: false,
            apiClient: 'omdb',
        };

        // Reset and re-init with mocked values
        vi.clearAllMocks();
        browser.storage.local.get.mockResolvedValue(customValues);
        await init();

        expect(document.getElementById('field_xmdbApiKey').value).toBe('custom-key');
        expect(document.getElementById('field_showRtRating').checked).toBe(false);
        expect(document.getElementById('field_apiClient').value).toBe('omdb');
    });

    it('should save values to storage when clicking Save', async () => {
        const xmdbInput = document.getElementById('field_xmdbApiKey');
        const rtCheckbox = document.getElementById('field_showRtRating');

        xmdbInput.value = 'new-api-key';
        rtCheckbox.checked = false;

        const saveBtn = document.getElementById('saveBtn');
        await saveBtn.click();

        expect(browser.storage.local.set).toHaveBeenCalled();
        const lastCall = browser.storage.local.set.mock.calls[0][0];
        expect(lastCall.xmdbApiKey).toBe('new-api-key');
        expect(lastCall.showRtRating).toBe(false);

        const status = document.getElementById('status');
        expect(status.textContent).toBe('Saved!');
    });

    it('should clear cache when clicking Clear Cache and confirmed', async () => {
        const clearBtn = document.getElementById('clearCacheBtn');

        await clearBtn.click();

        expect(window.confirm).toHaveBeenCalledWith('Clear all cached ratings?');
        expect(browser.storage.local.set).toHaveBeenCalledWith({ fm_cache: '{}' });

        const status = document.getElementById('status');
        expect(status.textContent).toBe('Cache cleared.');
    });

    it('should NOT clear cache if NOT confirmed', async () => {
        window.confirm.mockReturnValue(false);
        const clearBtn = document.getElementById('clearCacheBtn');

        await clearBtn.click();

        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it('should reset disabled clients when clicking Reset Disabled Clients', async () => {
        const resetBtn = document.getElementById('resetClientsBtn');

        await resetBtn.click();

        expect(window.confirm).toHaveBeenCalledWith('Re-enable all failing API endpoints?');
        expect(browser.storage.local.set).toHaveBeenCalled();
        const lastCall = browser.storage.local.set.mock.calls[0][0];
        expect(lastCall.fm_disabled_imdbapi).toBe('0');
        expect(lastCall.fm_disabled_omdb).toBe('0');

        const status = document.getElementById('status');
        expect(status.textContent).toBe('API clients re-enabled.');
    });
});
