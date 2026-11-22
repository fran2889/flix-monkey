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

describe('Chrome service worker', () => {
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

    describe('startup', () => {
        it.each([{ reason: 'install' }, { reason: 'update' }])(
            'runs migrations on extension $reason',
            async details => {
                await installedListener(details);
                await Promise.resolve();
                expect(executeMigrations).toHaveBeenCalledOnce();
            }
        );
        it('runs migrations and logs an error when the install-time migration rejects', async () => {
            executeMigrations.mockRejectedValue(new Error('migration boom'));
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            await installedListener({ reason: 'install' });
            await Promise.resolve();
            await Promise.resolve();

            expect(executeMigrations).toHaveBeenCalledOnce();
            expect(consoleError).toHaveBeenCalledWith('Failed to run storage migrations', expect.any(Error));
            consoleError.mockRestore();
        });
    });

    describe('message handling', () => {
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
        it('ignores migration messages from a foreign sender', () => {
            const sendResponse = vi.fn();
            const result = messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'other-extension' }, sendResponse);

            expect(result).toBe(false);
            expect(executeMigrations).not.toHaveBeenCalled();
            expect(sendResponse).not.toHaveBeenCalled();
        });
        it('forwards an authenticated message without options', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ Title: 'The Matrix' }),
            } as unknown as Response);
            const sendResponse = vi.fn();

            const result = messageListener(
                { type: 'FM_FETCH', url: 'https://www.omdbapi.com/?apikey=k&i=tt0133093' },
                { id: 'test-ext' },
                sendResponse
            );

            expect(result).toBe(true);
            await vi.waitFor(() => {
                expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { Title: 'The Matrix' } });
            });
        });
        it('forwards fetch options on an authenticated FM_FETCH message', async () => {
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve('The Matrix'),
            } as unknown as Response);
            const sendResponse = vi.fn();

            const result = messageListener(
                {
                    type: 'FM_FETCH',
                    url: 'https://www.omdbapi.com/?apikey=k&i=tt0133093',
                    options: { responseType: 'text', timeout: 1234 },
                },
                { id: 'test-ext' },
                sendResponse
            );

            expect(result).toBe(true);
            await vi.waitFor(() => {
                expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: 'The Matrix' });
            });
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1234);
            setTimeoutSpy.mockRestore();
        });
        it('ignores non-FM_FETCH messages', () => {
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
        it('rejects FM_FETCH messages from a foreign sender', () => {
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

    describe('action clicks', () => {
        it('opens the options page when the action icon is clicked', async () => {
            await actionListener();
            expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
        });
        it('logs an error when opening the options page fails', async () => {
            vi.mocked(chrome.runtime.openOptionsPage).mockRejectedValue(new Error('open boom'));
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            await actionListener();
            await Promise.resolve();
            await Promise.resolve();

            expect(consoleError).toHaveBeenCalledWith('Failed to open options page', expect.any(Error));
            consoleError.mockRestore();
        });
    });
});
