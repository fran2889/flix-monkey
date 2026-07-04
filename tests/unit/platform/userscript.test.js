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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FlixMonkeyError } from '../../../src/core/utils.js';
import { UserscriptAdapter } from '../../../src/platform/userscript.js';
import { setupUserscriptMocks } from '../../mocks/platform.js';

describe('UserscriptAdapter', () => {
    let adapter;

    beforeEach(() => {
        setupUserscriptMocks();
        adapter = new UserscriptAdapter();
    });

    it('storageGet should call GM_getValue', async () => {
        GM_getValue.mockReturnValue('test-value');
        const result = await adapter.storageGet('key');
        expect(GM_getValue).toHaveBeenCalledWith('key');
        expect(result).toBe('test-value');
    });

    it('storageGet should return null if key is not found', async () => {
        GM_getValue.mockReturnValue(undefined);
        const result = await adapter.storageGet('nonexistent');
        expect(result).toBeNull();
    });

    it('storageGetAll should call GM_listValues and GM_getValue for each key', async () => {
        GM_listValues.mockReturnValue(['key1', 'key2']);
        GM_getValue.mockImplementation(key => `val-${key}`);
        const result = await adapter.storageGetAll();
        expect(GM_listValues).toHaveBeenCalled();
        expect(GM_getValue).toHaveBeenCalledWith('key1');
        expect(GM_getValue).toHaveBeenCalledWith('key2');
        expect(result).toEqual({ key1: 'val-key1', key2: 'val-key2' });
    });

    it('storageSet should call GM_setValue', async () => {
        await adapter.storageSet('key', 'value');
        expect(GM_setValue).toHaveBeenCalledWith('key', 'value');
    });

    it('storageSetMany should call GM_setValue for each entry', async () => {
        await adapter.storageSetMany({ k1: 'v1', k2: 'v2' });
        expect(GM_setValue).toHaveBeenCalledWith('k1', 'v1');
        expect(GM_setValue).toHaveBeenCalledWith('k2', 'v2');
    });

    it('storageDelete should call GM_deleteValue', async () => {
        await adapter.storageDelete('key');
        expect(GM_deleteValue).toHaveBeenCalledWith('key');
    });

    it('storageGetKeys should call GM_listValues and filter by prefix', async () => {
        GM_listValues.mockReturnValue(['fmc:1', 'other:2', 'fmc:3']);
        const result = await adapter.storageGetKeys('fmc:');
        expect(GM_listValues).toHaveBeenCalled();
        expect(result).toEqual(['fmc:1', 'fmc:3']);
    });

    it('registerMenuCommand should call GM_registerMenuCommand', () => {
        const fn = vi.fn();
        adapter.registerMenuCommand('test-label', fn);
        expect(GM_registerMenuCommand).toHaveBeenCalledWith('test-label', fn);
    });

    it('httpFetch should resolve with JSON on success', async () => {
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 200, response: { data: 'ok' } });
        });

        const result = await adapter.httpFetch('http://example.com');
        expect(GM_xmlhttpRequest).toHaveBeenCalled();
        expect(result).toEqual({ data: 'ok' });
    });

    it('httpFetch should reject on HTTP error', async () => {
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 404 });
        });

        await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(FlixMonkeyError);
        await expect(adapter.httpFetch('http://example.com')).rejects.toThrow('HTTP 404');
    });

    it('httpFetch should reject on network error', async () => {
        GM_xmlhttpRequest.mockImplementation(({ onerror }) => {
            onerror();
        });

        await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(FlixMonkeyError);
        await expect(adapter.httpFetch('http://example.com')).rejects.toThrow('network error');
    });

    it('httpFetch should reject on timeout', async () => {
        GM_xmlhttpRequest.mockImplementation(({ ontimeout }) => {
            ontimeout();
        });

        await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(FlixMonkeyError);
        await expect(adapter.httpFetch('http://example.com')).rejects.toThrow('timeout');
    });

    it('httpFetch should pass timeout to GM_xmlhttpRequest', async () => {
        const customTimeout = 5432;
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 200, response: {} });
        });

        await adapter.httpFetch('http://example.com', { timeout: customTimeout });
        expect(GM_xmlhttpRequest).toHaveBeenCalledWith(expect.objectContaining({ timeout: customTimeout }));
    });

    it('httpFetch should resolve with text when responseType is not json', async () => {
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 200, responseText: 'plain text' });
        });

        const result = await adapter.httpFetch('http://example.com', { responseType: 'text' });
        expect(result).toBe('plain text');
    });

    it('httpFetch should resolve with JSON.parse(responseText) if response is missing', async () => {
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 200, response: null, responseText: '{"data":"parsed"}' });
        });

        const result = await adapter.httpFetch('http://example.com');
        expect(result).toEqual({ data: 'parsed' });
    });

    it('httpFetch should include url on HTTP error', async () => {
        expect.assertions(1);
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 403, responseText: '' });
        });

        try {
            await adapter.httpFetch('http://example.com/api');
        } catch (e) {
            expect(e.url).toBe('http://example.com/api');
        }
    });

    it('httpFetch should include truncated body on HTTP error', async () => {
        expect.assertions(1);
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 401, responseText: 'Invalid API key' });
        });

        try {
            await adapter.httpFetch('http://example.com/api');
        } catch (e) {
            expect(e.body).toBe('Invalid API key');
        }
    });

    it('httpFetch should truncate body to 200 characters', async () => {
        expect.assertions(1);
        const longBody = 'x'.repeat(500);
        GM_xmlhttpRequest.mockImplementation(({ onload }) => {
            onload({ status: 500, responseText: longBody });
        });

        try {
            await adapter.httpFetch('http://example.com/api');
        } catch (e) {
            expect(e.body).toHaveLength(200);
        }
    });

    it('httpFetch should include url on network error', async () => {
        expect.assertions(1);
        GM_xmlhttpRequest.mockImplementation(({ onerror }) => {
            onerror();
        });

        try {
            await adapter.httpFetch('http://example.com/api');
        } catch (e) {
            expect(e.url).toBe('http://example.com/api');
        }
    });

    it('httpFetch should include url on timeout error', async () => {
        expect.assertions(1);
        GM_xmlhttpRequest.mockImplementation(({ ontimeout }) => {
            ontimeout();
        });

        try {
            await adapter.httpFetch('http://example.com/api');
        } catch (e) {
            expect(e.url).toBe('http://example.com/api');
        }
    });

    it('configGet should call GM_getValue', () => {
        GM_getValue.mockReturnValue('val');
        const result = adapter.configGet('key');
        expect(GM_getValue).toHaveBeenCalledWith('key');
        expect(result).toBe('val');
    });
});
