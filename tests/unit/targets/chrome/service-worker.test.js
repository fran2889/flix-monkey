/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeMigrations } = vi.hoisted(() => ({
    executeMigrations: vi.fn(),
}));

vi.mock('../../../../src/targets/extension/migrations.js', () => ({
    createExtensionMigrationExecutor: () => executeMigrations,
}));

describe('Chrome Service Worker', () => {
    let messageListener;
    let installedListener;
    let actionListener;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();
        executeMigrations.mockReset();
        executeMigrations.mockResolvedValue();

        global.chrome = {
            runtime: {
                id: 'test-ext',
                onMessage: {
                    addListener: vi.fn(fn => {
                        messageListener = fn;
                    }),
                },
                onInstalled: {
                    addListener: vi.fn(fn => {
                        installedListener = fn;
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

        await import('../../../../src/targets/chrome/service-worker.js');
    });

    it.each([{ reason: 'install' }, { reason: 'update' }])(
        'runs migrations when the extension is $reason',
        async details => {
            installedListener(details);
            await Promise.resolve();
            expect(executeMigrations).toHaveBeenCalledOnce();
        }
    );

    it('runs migrations for authenticated migration messages', async () => {
        const sendResponse = vi.fn();
        const result = messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'test-ext' }, sendResponse);

        expect(result).toBe(true);
        await Promise.resolve();
        expect(executeMigrations).toHaveBeenCalledOnce();
        expect(sendResponse).toHaveBeenCalledWith({});
    });

    it('ignores migration messages from a foreign sender', () => {
        const sendResponse = vi.fn();
        const result = messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'other-extension' }, sendResponse);

        expect(result).toBe(false);
        expect(executeMigrations).not.toHaveBeenCalled();
        expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should ignore non-FM_FETCH messages', () => {
        const result = messageListener({ type: 'OTHER' }, { id: 'test-ext' }, vi.fn());
        expect(result).toBe(false);
    });

    it('should reject requests to disallowed domains', async () => {
        const sendResponse = vi.fn();
        const result = messageListener(
            { type: 'FM_FETCH', url: 'http://malicious.com' },
            { id: 'test-ext' },
            sendResponse
        );
        expect(result).toBe(true);
        await Promise.resolve();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'Domain not allowed' });
    });

    it('should handle invalid URLs', async () => {
        const sendResponse = vi.fn();
        const result = messageListener({ type: 'FM_FETCH', url: 'not-a-url' }, { id: 'test-ext' }, sendResponse);
        expect(result).toBe(true);
        await Promise.resolve();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'Invalid URL' });
    });

    it('should respect custom timeout in options', async () => {
        const customTimeout = 1234;
        const sendResponse = vi.fn();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

        messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: customTimeout } },
            { id: 'test-ext' },
            sendResponse
        );

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customTimeout);
        setTimeoutSpy.mockRestore();
    });

    it('should fall back to DEFAULT_FETCH_TIMEOUT (8000ms)', async () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: {} }, { id: 'test-ext' }, vi.fn());
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8000);
        setTimeoutSpy.mockRestore();
    });

    it('should actually abort fetch when timer fires', async () => {
        const customTimeout = 500;
        messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: customTimeout } },
            { id: 'test-ext' },
            vi.fn()
        );

        const fetchOptions = global.fetch.mock.calls[0][1];
        expect(fetchOptions.signal.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(customTimeout + 10);
        expect(fetchOptions.signal.aborted).toBe(true);
    });

    it('should handle successful JSON response', async () => {
        const sendResponse = vi.fn();
        const mockData = { test: 'data' };
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'json' } },
            { id: 'test-ext' },
            sendResponse
        );

        // We need to wait for the microtasks (promises) to resolve
        await vi.runAllTimersAsync();
        await Promise.resolve(); // then(...)
        await Promise.resolve(); // await res.json()
        await Promise.resolve(); // next tick

        expect(sendResponse).toHaveBeenCalledWith({ data: mockData });
    });

    it('should handle successful text response', async () => {
        const sendResponse = vi.fn();
        const mockData = 'plain text';
        global.fetch.mockResolvedValue({
            ok: true,
            text: async () => mockData,
        });

        messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'text' } },
            { id: 'test-ext' },
            sendResponse
        );

        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendResponse).toHaveBeenCalledWith({ data: mockData });
    });

    it('should handle HTTP error response', async () => {
        const sendResponse = vi.fn();
        global.fetch.mockResolvedValue({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not Found'),
        });

        messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' }, { id: 'test-ext' }, sendResponse);

        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendResponse).toHaveBeenCalledWith({ error: 'HTTP 404', status: 404, body: 'Not Found' });
    });

    it('should handle fetch exception', async () => {
        const sendResponse = vi.fn();
        global.fetch.mockRejectedValue(new Error('Network error'));

        messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' }, { id: 'test-ext' }, sendResponse);

        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendResponse).toHaveBeenCalledWith({ error: 'Network error' });
    });

    it('should open options page when action icon is clicked', () => {
        actionListener();
        expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('should reject FM_FETCH messages from a foreign sender', () => {
        const fetchSpy = vi.spyOn(global, 'fetch');
        const sendResponse = vi.fn();
        const result = messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com' },
            { id: 'other-extension' },
            sendResponse
        );
        expect(result).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
