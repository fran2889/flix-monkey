/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import browser from 'webextension-polyfill';

import { WebExtensionAdapter } from '../../../src/platform/webextension';

// Type for the mocked browser object - using any to avoid generic issues
// The actual mocks are created by vi.fn() in the vi.mock call

type MockBrowser = {
    storage: {
        local: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set: any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            remove: any;
        };
    };
    runtime: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendMessage: any;
    };
};

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
        runtime: { sendMessage: vi.fn() },
    },
}));

// Cast browser to the mocked type
const mockedBrowser = browser as unknown as MockBrowser;

describe('WebExtensionAdapter', () => {
    let adapter: WebExtensionAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new WebExtensionAdapter();
    });

    it('storageGet should call storage.local.get', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: 'value' });
        const result = await adapter.storageGet('key');
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith('key');
        expect(result).toBe('value');
    });

    it('storageGetAll should call storage.local.get(null)', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ k1: 'v1', k2: 'v2' });
        const result = await adapter.storageGetAll();
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith(null);
        expect(result).toEqual({ k1: 'v1', k2: 'v2' });
    });

    it('storageSet should call storage.local.set', async () => {
        await adapter.storageSet('key', 'value');
        expect(mockedBrowser.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
    });

    it('storageSetMany should call storage.local.set with values', async () => {
        const values = { k1: 'v1', k2: 'v2' };
        await adapter.storageSetMany(values);
        expect(mockedBrowser.storage.local.set).toHaveBeenCalledWith(values);
    });

    it('storageDelete should call storage.local.remove', async () => {
        await adapter.storageDelete('key');
        expect(mockedBrowser.storage.local.remove).toHaveBeenCalledWith('key');
    });

    it('storageGetKeys should call storage.local.get(null) and filter by prefix', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ 'fmc:1': 'v1', 'other:2': 'v2', 'fmc:3': 'v3' });
        const result = await adapter.storageGetKeys('fmc:');
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith(null);
        expect(result.sort()).toEqual(['fmc:1', 'fmc:3'].sort());
    });

    it('httpFetch should send message to background and return data', async () => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ data: { success: true } });
        const result = (await adapter.httpFetch('https://api.example.com', { responseType: 'json' })) as {
            success: boolean;
        };

        expect(mockedBrowser.runtime.sendMessage).toHaveBeenCalledWith({
            type: 'FM_FETCH',
            url: 'https://api.example.com',
            options: { responseType: 'json' },
        });
        expect(result.success).toBe(true);
    });

    it('httpFetch should throw error if background returns error', async () => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ error: 'Not Found', status: 404 });

        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('Not Found');

        try {
            await adapter.httpFetch('https://api.example.com');
        } catch (e: unknown) {
            const err = e as Error & { status?: number };
            expect(err.status).toBe(404);
        }
    });

    it('httpFetch should pass timeout to background', async () => {
        const customTimeout = 3000;
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ data: {} });

        await adapter.httpFetch('https://api.example.com', { timeout: customTimeout });
        expect(mockedBrowser.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({ timeout: customTimeout }),
            })
        );
    });

    it('storageGet should return null if key is not found', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({});
        const result = await adapter.storageGet('nonexistent');
        expect(result).toBeNull();
    });

    it('configGet should return value from configData', () => {
        adapter.setConfigData({ key: 'value' });
        expect(adapter.configGet('key')).toBe('value');
    });

    it('configGet should return undefined if key is missing', () => {
        adapter.setConfigData({});
        expect(adapter.configGet('missing')).toBeUndefined();
    });

    it('configGet should return undefined for all keys before setConfigData is called', () => {
        const freshAdapter = new WebExtensionAdapter();
        expect(freshAdapter.configGet('overlayCorner')).toBeUndefined();
        expect(freshAdapter.configGet('xmdbApiKey')).toBeUndefined();
    });

    it('httpFetch should throw FlixMonkeyError when background returns undefined', async () => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue(undefined);
        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('empty background response');
    });

    it('httpFetch should include url on HTTP error from background', async () => {
        expect.assertions(3);
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ error: 'HTTP 403', status: 403, body: 'Forbidden' });

        try {
            await adapter.httpFetch('https://api.example.com/test');
        } catch (e: unknown) {
            const err = e as Error & { url?: string; status?: number; body?: string };
            expect(err.url).toBe('https://api.example.com/test');
            expect(err.status).toBe(403);
            expect(err.body).toBe('Forbidden');
        }
    });

    it('httpFetch should include url on empty background response', async () => {
        expect.assertions(1);
        mockedBrowser.runtime.sendMessage.mockResolvedValue(undefined);

        try {
            await adapter.httpFetch('https://api.example.com/test');
        } catch (e: unknown) {
            const err = e as Error & { url?: string };
            expect(err.url).toBe('https://api.example.com/test');
        }
    });

    it('httpFetch clears the timeout after a successful fetch', async () => {
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ data: { ok: true } });
        await adapter.httpFetch('https://api.example.com');
        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});
