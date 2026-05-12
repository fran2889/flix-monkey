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
import { WebExtensionAdapter } from '../../../src/platform/webextension.js';
import browser from 'webextension-polyfill';

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: { local: { get: vi.fn(), set: vi.fn() } },
        runtime: { sendMessage: vi.fn() },
    },
}));

describe('WebExtensionAdapter', () => {
    let adapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new WebExtensionAdapter();
    });

    it('storageGet should call storage.local.get', async () => {
        browser.storage.local.get.mockResolvedValue({ key: 'value' });
        const result = await adapter.storageGet('key');
        expect(browser.storage.local.get).toHaveBeenCalledWith('key');
        expect(result).toBe('value');
    });

    it('storageSet should call storage.local.set', async () => {
        await adapter.storageSet('key', 'value');
        expect(browser.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
    });
});
