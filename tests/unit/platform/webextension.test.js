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
        storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
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

    it('storageDelete should call storage.local.remove', async () => {
        await adapter.storageDelete('key');
        expect(browser.storage.local.remove).toHaveBeenCalledWith('key');
    });

    it('storageGetKeys should call storage.local.get(null) and filter by prefix', async () => {
        browser.storage.local.get.mockResolvedValue({ 'fmc:1': 'v1', 'other:2': 'v2', 'fmc:3': 'v3' });
        const result = await adapter.storageGetKeys('fmc:');
        expect(browser.storage.local.get).toHaveBeenCalledWith(null);
        expect(result.sort()).toEqual(['fmc:1', 'fmc:3'].sort());
    });

    it('httpFetch should send message to background and return data', async () => {
        browser.runtime.sendMessage.mockResolvedValue({ data: { success: true } });
        const result = await adapter.httpFetch('https://api.example.com', { method: 'GET' });

        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
            type: 'FM_FETCH',
            url: 'https://api.example.com',
            options: { method: 'GET' },
        });
        expect(result.success).toBe(true);
    });

    it('httpFetch should throw error if background returns error', async () => {
        browser.runtime.sendMessage.mockResolvedValue({ error: 'Not Found', status: 404 });

        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('Not Found');

        try {
            await adapter.httpFetch('https://api.example.com');
        } catch (e) {
            expect(e.status).toBe(404);
        }
    });

    it('httpFetch should pass timeout to background', async () => {
        const customTimeout = 3000;
        browser.runtime.sendMessage.mockResolvedValue({ data: {} });

        await adapter.httpFetch('https://api.example.com', { timeout: customTimeout });
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({ timeout: customTimeout }),
            })
        );
    });
});
