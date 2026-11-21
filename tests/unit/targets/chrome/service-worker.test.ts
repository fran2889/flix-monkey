/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chrome } from '../../../mocks/chrome';

const { executeMigrations } = vi.hoisted(() => ({
    executeMigrations: vi.fn(),
}));

vi.mock('../../../../src/targets/extension/migrations', () => ({
    createExtensionMigrationExecutor: () => executeMigrations,
}));

describe('Chrome Service Worker', () => {
    let messageListener: (_message: unknown, _sender: unknown, _sendResponse: unknown) => Promise<unknown> | void;
    let installedListener: (_details: { reason: string }) => Promise<unknown> | void;
    let actionListener: () => Promise<unknown> | void;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();
        executeMigrations.mockReset();
        executeMigrations.mockResolvedValue(undefined);

        chrome.runtime.id = 'test-ext';
        chrome.runtime.onMessage.addListener = vi.fn(
            (fn: (_message: unknown, _sender: unknown, _sendResponse: unknown) => Promise<unknown> | void) => {
                messageListener = fn;
            }
        );
        chrome.runtime.onInstalled.addListener = vi.fn(
            (fn: (_details: { reason: string }) => Promise<unknown> | void) => {
                installedListener = fn;
            }
        );
        chrome.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined);
        chrome.action.onClicked.addListener = vi.fn((fn: () => Promise<unknown> | void) => {
            actionListener = fn;
        });

        Object.defineProperty(global, 'chrome', {
            value: chrome,
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
        } as unknown as { prototype: AbortController; new (): AbortController };

        await import('../../../../src/targets/chrome/service-worker');
    });

    it.each([{ reason: 'install' }, { reason: 'update' }])(
        'runs migrations when the extension is $reason',
        async details => {
            await installedListener(details);
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

    it('responds with the migration error message when the run rejects', async () => {
        executeMigrations.mockRejectedValue(new Error('migration boom'));
        const sendResponse = vi.fn();

        const result = messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'test-ext' }, sendResponse);

        expect(result).toBe(true);
        await Promise.resolve();
        await Promise.resolve();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'migration boom' });
    });

    it('stringifies a non-Error migration rejection', async () => {
        executeMigrations.mockRejectedValue('plain failure');
        const sendResponse = vi.fn();

        await messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'test-ext' }, sendResponse);

        await Promise.resolve();
        await Promise.resolve();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'plain failure' });
    });

    it('logs an error when the install-time migration run rejects', async () => {
        executeMigrations.mockRejectedValue(new Error('migration boom'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        await installedListener({ reason: 'install' });
        await Promise.resolve();
        await Promise.resolve();

        expect(consoleError).toHaveBeenCalledWith('Failed to run storage migrations', expect.any(Error));
        consoleError.mockRestore();
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

    it('ignores a message with malformed options', () => {
        const sendResponse = vi.fn();
        const result = messageListener(
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'xml' } },
            { id: 'test-ext' },
            sendResponse
        );

        expect(result).toBe(false);
        expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should open options page when action icon is clicked', async () => {
        await actionListener();
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
