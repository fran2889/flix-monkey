/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browser } from '../../../mocks/webextension';

const { executeMigrations } = vi.hoisted(() => ({
    executeMigrations: vi.fn(),
}));

vi.mock('../../../../src/targets/extension/migrations', () => ({
    createExtensionMigrationExecutor: () => executeMigrations,
}));

describe('Firefox Background Script', () => {
    let messageListener: (..._args: unknown[]) => Promise<unknown> | void;
    let installedListener: (_details: { reason: string }) => Promise<unknown> | void;
    let actionListener: () => Promise<unknown> | void;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();
        executeMigrations.mockReset();
        executeMigrations.mockResolvedValue(undefined);

        browser.runtime.id = undefined;
        browser.runtime.onMessage.addListener = vi.fn((fn: (..._args: unknown[]) => Promise<unknown> | void) => {
            messageListener = fn;
        });
        browser.runtime.onInstalled.addListener = vi.fn(
            (fn: (_details: { reason: string }) => Promise<unknown> | void) => {
                installedListener = fn;
            }
        );
        browser.runtime.openOptionsPage = vi.fn();
        browser.action.onClicked.addListener = vi.fn((fn: () => Promise<unknown> | void) => {
            actionListener = fn;
        });

        Object.defineProperty(global, 'browser', {
            value: browser,
            writable: true,
            configurable: true,
        });

        global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
        global.AbortController = class {
            signal: { aborted: boolean };
            constructor() {
                this.signal = { aborted: false };
            }
            abort() {
                this.signal.aborted = true;
            }
        } as unknown as { new (): AbortController; prototype: AbortController };

        await import('../../../../src/targets/firefox/background');
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
        const result = await messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: undefined });

        expect(executeMigrations).toHaveBeenCalledOnce();
        expect(result).toBeUndefined();
    });

    it('ignores migration messages from a foreign sender', async () => {
        const result = await messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'other-extension' });

        expect(result).toBeUndefined();
        expect(executeMigrations).not.toHaveBeenCalled();
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

        const fetchMock = global.fetch as unknown as {
            mock: { calls: Array<[string, { signal: { aborted: boolean } }]> };
        };
        const fetchOptions = fetchMock.mock.calls[0][1];
        expect(fetchOptions.signal.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(customTimeout + 10);
        expect(fetchOptions.signal.aborted).toBe(true);
    });

    it('should handle successful JSON response', async () => {
        const mockData = { test: 'data' };
        (global.fetch as unknown as { mockResolvedValue: (_value: unknown) => void }).mockResolvedValue({
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
        (global.fetch as unknown as { mockResolvedValue: (_value: unknown) => void }).mockResolvedValue({
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
        (global.fetch as unknown as { mockResolvedValue: (_value: unknown) => void }).mockResolvedValue({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not Found'),
        });

        const result = await messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' });

        expect(result).toEqual({ error: 'HTTP 404', status: 404, body: 'Not Found' });
    });

    it('should handle fetch exception', async () => {
        (global.fetch as unknown as { mockRejectedValue: (_error: unknown) => void }).mockRejectedValue(
            new Error('Network error')
        );

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
