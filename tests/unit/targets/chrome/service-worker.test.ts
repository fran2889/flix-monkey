/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as FetchProxy from '../../../../src/targets/extension/fetch-proxy';
import { flushAsyncWork } from '../../../helpers/async';
import { type BackgroundListener, installBackgroundHarness } from '../../../helpers/background-harness';
import { chrome } from '../../../mocks/chrome';

const { executeMigrations } = vi.hoisted(() => ({
    executeMigrations: vi.fn(),
}));

vi.mock('../../../../src/targets/extension/migrations', () => ({
    createExtensionMigrationExecutor: () => executeMigrations,
}));

vi.mock('../../../../src/targets/extension/fetch-proxy', async importOriginal => {
    const actual = await importOriginal<typeof FetchProxy>();
    return {
        ...actual,
        handleFetchMessage: vi.fn(actual.handleFetchMessage),
    };
});

describe('Chrome service worker', () => {
    let messageListener: BackgroundListener;
    let installedListener: BackgroundListener;
    let actionListener: BackgroundListener;

    beforeEach(async () => {
        vi.resetModules();
        executeMigrations.mockReset();
        executeMigrations.mockResolvedValue(undefined);

        ({ messageListener, installedListener, actionListener } = installBackgroundHarness(
            chrome,
            'chrome',
            'test-ext'
        ));

        await import('../../../../src/targets/chrome/service-worker');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('startup', () => {
        it.each([{ reason: 'install' }, { reason: 'update' }])(
            'runs migrations on extension $reason',
            async details => {
                await installedListener(details);
                await flushAsyncWork();
                expect(executeMigrations).toHaveBeenCalledOnce();
            }
        );
        it('runs migrations and logs an error when the install-time migration rejects', async () => {
            executeMigrations.mockRejectedValue(new Error('migration boom'));
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            await installedListener({ reason: 'install' });
            await flushAsyncWork();

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
            await flushAsyncWork();
            expect(executeMigrations).toHaveBeenCalledOnce();
            expect(sendResponse).toHaveBeenCalledWith({});
        });
        it('responds with the migration error message when the run rejects', async () => {
            executeMigrations.mockRejectedValue(new Error('migration boom'));
            const sendResponse = vi.fn();

            const result = messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'test-ext' }, sendResponse);

            expect(result).toBe(true);
            await flushAsyncWork();
            expect(sendResponse).toHaveBeenCalledWith({ error: 'migration boom' });
        });
        it('stringifies a non-Error migration rejection', async () => {
            executeMigrations.mockRejectedValue('plain failure');
            const sendResponse = vi.fn();

            await messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'test-ext' }, sendResponse);

            await flushAsyncWork();
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
            await flushAsyncWork();
            expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { Title: 'The Matrix' } });
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
            await flushAsyncWork();
            expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: 'The Matrix' });
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1234);
            setTimeoutSpy.mockRestore();
        });
        it.each([
            ['an Error rejection', new Error('proxy exploded'), 'proxy exploded'],
            ['a non-Error rejection', 'proxy exploded', 'proxy exploded'],
        ])('responds with the proxy error for %s', async (_label, rejection, expected) => {
            const { handleFetchMessage } = await import('../../../../src/targets/extension/fetch-proxy');
            vi.mocked(handleFetchMessage).mockRejectedValueOnce(rejection);

            const sendResponse = vi.fn();
            const result = messageListener(
                { type: 'FM_FETCH', url: 'https://xmdbapi.com' },
                { id: 'test-ext' },
                sendResponse
            );

            expect(result).toBe(true);
            await flushAsyncWork();
            expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: expected });
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
            await flushAsyncWork();

            expect(consoleError).toHaveBeenCalledWith('Failed to open options page', expect.any(Error));
            consoleError.mockRestore();
        });
    });
});
