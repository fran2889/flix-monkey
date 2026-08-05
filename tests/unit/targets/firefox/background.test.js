/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Firefox Background Script', () => {
    let messageListener;
    let actionListener;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();

        global.browser = {
            runtime: {
                onMessage: {
                    addListener: vi.fn(fn => {
                        messageListener = fn;
                    }),
                },
                openOptionsPage: vi.fn(),
            },
            action: {
                onClicked: {
                    addListener: vi.fn(fn => {
                        actionListener = fn;
                    }),
                },
            },
        };

        global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
        global.AbortController = class {
            constructor() {
                this.signal = { aborted: false };
            }
            abort() {
                this.signal.aborted = true;
            }
        };

        await import('../../../../src/targets/firefox/background.js');
    });

    it('should ignore non-FM_FETCH messages', async () => {
        const result = await messageListener({ type: 'OTHER' });
        expect(result).toBeUndefined();
    });

    it('should reject requests to disallowed domains', async () => {
        const result = await messageListener({ type: 'FM_FETCH', url: 'http://malicious.com' });
        expect(result).toEqual({ error: 'Domain not allowed' });
    });

    it('should handle invalid URLs', async () => {
        const result = await messageListener({ type: 'FM_FETCH', url: 'not-a-url' });
        expect(result).toEqual({ error: 'Invalid URL' });
    });

    it('should respect custom timeout in options', async () => {
        const customTimeout = 1234;
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

        messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: customTimeout } });

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customTimeout);
        setTimeoutSpy.mockRestore();
    });

    it('should fall back to DEFAULT_FETCH_TIMEOUT (8000ms)', async () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: {} });
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8000);
        setTimeoutSpy.mockRestore();
    });

    it('should actually abort fetch when timer fires', async () => {
        const customTimeout = 500;
        messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: customTimeout } });

        const fetchOptions = global.fetch.mock.calls[0][1];
        expect(fetchOptions.signal.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(customTimeout + 10);
        expect(fetchOptions.signal.aborted).toBe(true);
    });

    it('should handle successful JSON response', async () => {
        const mockData = { test: 'data' };
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        const result = await messageListener({
            type: 'FM_FETCH',
            url: 'https://xmdbapi.com',
            options: { responseType: 'json' },
        });

        expect(result).toEqual({ data: mockData });
    });

    it('should handle successful text response', async () => {
        const mockData = 'plain text';
        global.fetch.mockResolvedValue({
            ok: true,
            text: async () => mockData,
        });

        const result = await messageListener({
            type: 'FM_FETCH',
            url: 'https://xmdbapi.com',
            options: { responseType: 'text' },
        });

        expect(result).toEqual({ data: mockData });
    });

    it('should handle HTTP error response', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not Found'),
        });

        const result = await messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' });

        expect(result).toEqual({ error: 'HTTP 404', status: 404, body: 'Not Found' });
    });

    it('should handle fetch exception', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        const result = await messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' });

        expect(result).toEqual({ error: 'Network error' });
    });

    it('should ignore messages from external senders', async () => {
        // browser.runtime.id is undefined in test env; sender.id must match it
        const result = await messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com' },
            { id: 'some-other-extension-id' }
        );
        expect(result).toBeUndefined();
    });

    it('should open options page when action icon is clicked', () => {
        actionListener();
        expect(browser.runtime.openOptionsPage).toHaveBeenCalled();
    });
});
