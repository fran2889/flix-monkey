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

    it('reads a stored value through storage.local.get', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: 'value' });
        const result = await adapter.storageGet('key');
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith('key');
        expect(result).toBe('value');
    });

    it('returns a stored boolean value', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: true });
        await expect(adapter.storageGet('key')).resolves.toBe(true);
    });

    it.each([
        ['a number', 42],
        ['null', null],
        ['an object', { nested: true }],
        ['an array', ['value']],
    ])('returns undefined for %s', async (_label, value) => {
        mockedBrowser.storage.local.get.mockResolvedValue({ key: value });
        await expect(adapter.storageGet('key')).resolves.toBeUndefined();
    });

    it('returns undefined when storage.local.get does not return a record', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue(null as unknown as Record<string, unknown>);
        await expect(adapter.storageGet('key')).resolves.toBeUndefined();
    });

    it('reads every stored value through storage.local.get', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ k1: 'v1', k2: 'v2' });
        const result = await adapter.storageGetAll();
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith(null);
        expect(result).toEqual({ k1: 'v1', k2: 'v2' });
    });

    it('omits values that are not storage values', async () => {
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

    it('returns an empty record when storage is not an object', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue(null as unknown as Record<string, unknown>);
        await expect(adapter.storageGetAll()).resolves.toEqual({});
    });

    it('writes a value through storage.local.set', async () => {
        await adapter.storageSet('key', 'value');
        expect(mockedBrowser.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
    });

    it('writes all values through storage.local.set', async () => {
        const values = { k1: 'v1', k2: 'v2' };
        await adapter.storageSetMany(values);
        expect(mockedBrowser.storage.local.set).toHaveBeenCalledWith(values);
    });

    it('deletes a key through storage.local.remove', async () => {
        await adapter.storageDelete('key');
        expect(mockedBrowser.storage.local.remove).toHaveBeenCalledWith('key');
    });

    it('filters stored keys by prefix', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({ 'fmc:1': 'v1', 'other:2': 'v2', 'fmc:3': 'v3' });
        const result = await adapter.storageGetKeys('fmc:');
        expect(mockedBrowser.storage.local.get).toHaveBeenCalledWith(null);
        expect(result.sort()).toEqual(['fmc:1', 'fmc:3'].sort());
    });

    it('sends a fetch message to the background and returns its data', async () => {
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

    it('returns success data that contains an error field', async () => {
        const data = { error: 'upstream rate limit', status: 429 };
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: true, data });

        await expect(adapter.httpFetch('https://api.example.com')).resolves.toEqual(data);
    });

    it('throws when the background returns an error', async () => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: false, error: 'Not Found', status: 404 });

        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('Not Found');

        try {
            await adapter.httpFetch('https://api.example.com');
        } catch (e: unknown) {
            const err = e as Error & { status?: number };
            expect(err.status).toBe(404);
        }
    });

    it('passes the configured timeout to the background', async () => {
        const customTimeout = 3000;
        mockedBrowser.runtime.sendMessage.mockResolvedValue({ ok: true, data: {} });

        await adapter.httpFetch('https://api.example.com', { timeout: customTimeout });
        expect(mockedBrowser.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({ timeout: customTimeout }),
            })
        );
    });

    it('returns undefined when the storage key is missing', async () => {
        mockedBrowser.storage.local.get.mockResolvedValue({});
        const result = await adapter.storageGet('nonexistent');
        expect(result).toBeUndefined();
    });

    it('returns a value from the seeded config data', () => {
        adapter.setConfigData({ key: 'value' });
        expect(adapter.configGet('key')).toBe('value');
    });

    it('returns undefined before seeding and for absent keys after seeding', () => {
        const freshAdapter = new WebExtensionAdapter();
        expect(freshAdapter.configGet('overlayCorner')).toBeUndefined();
        expect(freshAdapter.configGet('xmdbApiKey')).toBeUndefined();

        freshAdapter.setConfigData({});
        expect(freshAdapter.configGet('overlayCorner')).toBeUndefined();

        freshAdapter.setConfigData({ overlayCorner: 'bottom-left' });
        expect(freshAdapter.configGet('overlayCorner')).toBe('bottom-left');
    });

    it.each([
        ['an undefined response', undefined],
        ['an array response', []],
        ['an untagged success payload', { data: { success: true } }],
        ['an untagged error payload', { error: 'Not Found', status: 404 }],
        ['a non-boolean discriminant', { ok: 'true', data: {} }],
        ['a failure without an error', { ok: false }],
        ['a failure with a non-string error', { ok: false, error: 42 }],
        ['a failure with a non-number status', { ok: false, error: 'Not Found', status: '404' }],
        ['a failure with a non-string body', { ok: false, error: 'Not Found', body: {} }],
    ])('rejects %s as an empty background response', async (_label, payload) => {
        mockedBrowser.runtime.sendMessage.mockResolvedValue(payload);
        await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('empty background response');
    });

    it('includes the URL, status, and body on an HTTP error from the background', async () => {
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

    it('includes the URL on an empty background response', async () => {
        expect.assertions(1);
        mockedBrowser.runtime.sendMessage.mockResolvedValue(undefined);

        try {
            await adapter.httpFetch('https://api.example.com/test');
        } catch (e: unknown) {
            const err = e as Error & { url?: string };
            expect(err.url).toBe('https://api.example.com/test');
        }
    });

    it.each(['resolves', 'rejects'])('clears the timeout when the request %s', async outcome => {
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
