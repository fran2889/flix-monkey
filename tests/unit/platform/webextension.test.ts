/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebExtensionAdapter } from '../../../src/platform/webextension';

// Mock webextension-polyfill before any imports that use it
// vi.mock is hoisted, so this runs before the WebExtensionAdapter import
vi.mock('webextension-polyfill', () => ({
    default: {
        storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
        runtime: { sendMessage: vi.fn() },
    },
}));

// Import browser after the mock is set up
import browser from 'webextension-polyfill';

// Cast browser to the mocked type - using the type from our helper
import type { MockedBrowser } from '../../mocks/browser';
const mockedBrowser = browser as unknown as MockedBrowser;

describe('WebExtensionAdapter', () => {
    let adapter: WebExtensionAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new WebExtensionAdapter();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('storageGet should call storage.local.get', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: 'value' });
        const result = await adapter.storageGet('key');
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith('key');
        expect(result).toBe('value');
    });

    it('storageGet should return a boolean value', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: true });
        await expect(adapter.storageGet('key')).resolves.toBe(true);
    });

    it.each([
        ['a number', 42],
        ['null', null],
        ['an object', { nested: true }],
        ['an array', ['value']],
    ])('storageGet should return undefined for %s', async (_label, value) => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: value });
        await expect(adapter.storageGet('key')).resolves.toBeUndefined();
    });

    it('storageGet should return undefined when storage.local.get is not a record', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue(null as unknown as Record<string, unknown>);
        await expect(adapter.storageGet('key')).resolves.toBeUndefined();
    });

    it('storageGetAll should call storage.local.get(null)', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ k1: 'v1', k2: 'v2' });
        const result = await adapter.storageGetAll();
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith(null);
        expect(result).toEqual({ k1: 'v1', k2: 'v2' });
    });

    it('storageGetAll should omit values that are not storage values', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({
            validString: 'value',
            validBoolean: false,
            invalidNumber: 42,
            invalidNull: null,
            invalidObject: { nested: true },
        });

        await expect(adapter.storageGetAll()).resolves.toEqual({
            validString: 'value',
            validBoolean: false,
        });
    });

    it('storageGetAll should return an empty record when storage is not an object', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue(null as unknown as Record<string, unknown>);
        await expect(adapter.storageGetAll()).resolves.toEqual({});
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
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: true, data: { success: true } });
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

    it('httpFetch should return success data that contains an error field', async () => {
        const data = { error: 'upstream rate limit', status: 429 };
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: true, data });

        await expect(adapter.httpFetch('https://api.example.com')).resolves.toEqual(data);
    });

    it('httpFetch should throw error if background returns error', async () => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: false, error: 'Not Found', status: 404 });

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
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: true, data: {} });

        await adapter.httpFetch('https://api.example.com', { timeout: customTimeout });
        expect(mockedBrowser.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({ timeout: customTimeout }),
            })
        );
    });

    it('storageGet should return undefined if key is not found', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({});
        const result = await adapter.storageGet('nonexistent');
        expect(result).toBeUndefined();
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

    it('httpFetch should reject a non-object background response', async () => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue([]);
        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('empty background response');
    });

    it.each([
        ['an untagged success payload', { data: { success: true } }],
        ['an untagged error payload', { error: 'Not Found', status: 404 }],
        ['a non-boolean discriminant', { ok: 'true', data: {} }],
        ['a failure without an error', { ok: false }],
        ['a failure with a non-string error', { ok: false, error: 42 }],
        ['a failure with a non-number status', { ok: false, error: 'Not Found', status: '404' }],
        ['a failure with a non-string body', { ok: false, error: 'Not Found', body: {} }],
    ])('httpFetch should reject %s as an empty background response', async (_label, payload) => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue(payload);
        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('empty background response');
    });

    it('httpFetch should include url on HTTP error from background', async () => {
        expect.assertions(3);
        mockedBrowser.runtime.sendMessage.mockResolvedValue({
            ok: false,
            error: 'HTTP 403',
            status: 403,
            body: 'Forbidden',
        });

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

    it.each(['resolves', 'rejects'])('httpFetch clears the timeout when the request %s', async outcome => {
        vi.useFakeTimers();
        if (outcome === 'rejects') {
            mockedBrowser.runtime.sendMessage.mockRejectedValue(new Error('network failure'));
        } else {
            mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: true, data: { ok: true } });
        }

        const request = adapter.httpFetch('https://api.example.com');

        if (outcome === 'rejects') {
            await expect(request).rejects.toThrow('network failure');
        } else {
            await expect(request).resolves.toEqual({ ok: true });
        }

        expect(mockedBrowser.runtime.sendMessage).toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});
