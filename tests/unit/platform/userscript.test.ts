/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { FlixMonkeyError } from '../../../src/core/utils/index';
import { UserscriptAdapter } from '../../../src/platform/userscript';
import { setupUserscriptMocks } from '../../mocks/platform';

// Declare mocked GM_* globals - they are mocked by setupUserscriptMocks() in beforeEach
// Using Mock type for all to maintain type safety
declare const GM_getValue: Mock;
declare const GM_setValue: Mock;
declare const GM_deleteValue: Mock;
declare const GM_listValues: Mock;
declare const GM_registerMenuCommand: Mock;
declare const GM_xmlhttpRequest: Mock;

// Type for XHR callback parameters
interface XHRCallbacks {
    onload?: (_response: unknown) => void;
    onerror?: () => void;
    ontimeout?: () => void;
}

describe('UserscriptAdapter', () => {
    let adapter: UserscriptAdapter;

    beforeEach(() => {
        setupUserscriptMocks();
        adapter = new UserscriptAdapter();
    });

    describe('storage', () => {
        it('reads a stored value through GM_getValue', async () => {
            GM_getValue.mockReturnValue('test-value');
            const result = await adapter.storageGet('key');
            expect(GM_getValue).toHaveBeenCalledWith('key');
            expect(result).toBe('test-value');
        });
        it('returns undefined when the storage key is missing', async () => {
            GM_getValue.mockReturnValue(undefined);
            const result = await adapter.storageGet('nonexistent');
            expect(result).toBeUndefined();
        });
        it('reads every stored key through GM_listValues and GM_getValue', async () => {
            GM_listValues.mockReturnValue(['key1', 'key2']);
            GM_getValue.mockImplementation((key: string) => `val-${key}`);
            const result = await adapter.storageGetAll();
            expect(GM_listValues).toHaveBeenCalled();
            expect(GM_getValue).toHaveBeenCalledWith('key1');
            expect(GM_getValue).toHaveBeenCalledWith('key2');
            expect(result).toEqual({ key1: 'val-key1', key2: 'val-key2' });
        });
        it('omits stored keys whose value is undefined', async () => {
            GM_listValues.mockReturnValue(['key1', 'missing', 'key2']);
            GM_getValue.mockImplementation((key: string) => (key === 'missing' ? undefined : `val-${key}`));
            const result = await adapter.storageGetAll();
            expect(result).toEqual({ key1: 'val-key1', key2: 'val-key2' });
            expect(result).not.toHaveProperty('missing');
        });
        it('writes a value through GM_setValue', async () => {
            await adapter.storageSet('key', 'value');
            expect(GM_setValue).toHaveBeenCalledWith('key', 'value');
        });
        it('writes each entry through GM_setValue', async () => {
            await adapter.storageSetMany({ k1: 'v1', k2: 'v2' });
            expect(GM_setValue).toHaveBeenCalledWith('k1', 'v1');
            expect(GM_setValue).toHaveBeenCalledWith('k2', 'v2');
        });
        it('deletes a key through GM_deleteValue', async () => {
            await adapter.storageDelete('key');
            expect(GM_deleteValue).toHaveBeenCalledWith('key');
        });
        it('filters stored keys by prefix', async () => {
            GM_listValues.mockReturnValue(['fmc:1', 'other:2', 'fmc:3']);
            const result = await adapter.storageGetKeys('fmc:');
            expect(GM_listValues).toHaveBeenCalled();
            expect(result).toEqual(['fmc:1', 'fmc:3']);
        });
    });

    it('registers a menu command through GM_registerMenuCommand', () => {
        const fn = vi.fn();
        adapter.registerMenuCommand('test-label', fn);
        expect(GM_registerMenuCommand).toHaveBeenCalledWith('test-label', fn);
    });

    describe('http fetch', () => {
        it('resolves with parsed JSON on success', async () => {
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 200, response: { data: 'ok' } });
            });

            const result = await adapter.httpFetch('http://example.com');
            expect(GM_xmlhttpRequest).toHaveBeenCalled();
            expect(result).toEqual({ data: 'ok' });
        });
        it('rejects on an HTTP error', async () => {
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 404 });
            });

            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(FlixMonkeyError);
            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow('HTTP 404');
        });
        it('rejects on a network error', async () => {
            GM_xmlhttpRequest.mockImplementation(({ onerror }: XHRCallbacks) => {
                onerror?.();
            });

            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(FlixMonkeyError);
            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow('network error');
        });
        it('rejects on a timeout', async () => {
            GM_xmlhttpRequest.mockImplementation(({ ontimeout }: XHRCallbacks) => {
                ontimeout?.();
            });

            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(FlixMonkeyError);
            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow('timeout');
        });
        it('passes the configured timeout to GM_xmlhttpRequest', async () => {
            const customTimeout = 5432;
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 200, response: {} });
            });

            await adapter.httpFetch('http://example.com', { timeout: customTimeout });
            expect(GM_xmlhttpRequest).toHaveBeenCalledWith(expect.objectContaining({ timeout: customTimeout }));
        });
        it('resolves with text when responseType is text', async () => {
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 200, responseText: 'plain text' });
            });

            const result = await adapter.httpFetch('http://example.com', { responseType: 'text' });
            expect(result).toBe('plain text');
        });
        it('parses responseText as JSON when response is missing', async () => {
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 200, response: null, responseText: '{"data":"parsed"}' });
            });

            const result = await adapter.httpFetch('http://example.com');
            expect(result).toEqual({ data: 'parsed' });
        });
        it('rejects when a JSON response has neither response nor responseText', async () => {
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 200, response: null, responseText: null });
            });

            // response and responseText are both absent, so the fallback parses an empty string.
            await expect(adapter.httpFetch('http://example.com')).rejects.toThrow(SyntaxError);
        });
        it('includes the URL on an HTTP error', async () => {
            expect.assertions(1);
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 403, responseText: '' });
            });

            try {
                await adapter.httpFetch('http://example.com/api');
            } catch (e: unknown) {
                const err = e as Error & { url?: string };
                expect(err.url).toBe('http://example.com/api');
            }
        });
        it('includes the error body on an HTTP error', async () => {
            expect.assertions(1);
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 401, responseText: 'Invalid API key' });
            });

            try {
                await adapter.httpFetch('http://example.com/api');
            } catch (e: unknown) {
                const err = e as Error & { body?: string };
                expect(err.body).toBe('Invalid API key');
            }
        });
        it('truncates the error body to 200 characters', async () => {
            expect.assertions(1);
            const longBody = 'x'.repeat(500);
            GM_xmlhttpRequest.mockImplementation(({ onload }: XHRCallbacks) => {
                onload?.({ status: 500, responseText: longBody });
            });

            try {
                await adapter.httpFetch('http://example.com/api');
            } catch (e: unknown) {
                const err = e as Error & { body?: string };
                expect(err.body).toHaveLength(200);
            }
        });
        it('includes the URL on a network error', async () => {
            expect.assertions(1);
            GM_xmlhttpRequest.mockImplementation(({ onerror }: XHRCallbacks) => {
                onerror?.();
            });

            try {
                await adapter.httpFetch('http://example.com/api');
            } catch (e: unknown) {
                const err = e as Error & { url?: string };
                expect(err.url).toBe('http://example.com/api');
            }
        });
        it('includes the URL on a timeout error', async () => {
            expect.assertions(1);
            GM_xmlhttpRequest.mockImplementation(({ ontimeout }: XHRCallbacks) => {
                ontimeout?.();
            });

            try {
                await adapter.httpFetch('http://example.com/api');
            } catch (e: unknown) {
                const err = e as Error & { url?: string };
                expect(err.url).toBe('http://example.com/api');
            }
        });
    });

    it('reads config through GM_getValue', () => {
        GM_getValue.mockReturnValue('val');
        const result = adapter.configGet('key');
        expect(GM_getValue).toHaveBeenCalledWith('key');
        expect(result).toBe('val');
    });
});
