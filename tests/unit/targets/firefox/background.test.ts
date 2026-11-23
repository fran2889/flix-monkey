/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushAsyncWork } from '../../../helpers/async';
import { type BackgroundListener, installBackgroundHarness } from '../../../helpers/background-harness';
import { browser } from '../../../mocks/webextension';

const { executeMigrations } = vi.hoisted(() => ({
    executeMigrations: vi.fn(),
}));

vi.mock('../../../../src/targets/extension/migrations', () => ({
    createExtensionMigrationExecutor: () => executeMigrations,
}));

describe('Firefox background script', () => {
    let messageListener: BackgroundListener;
    let installedListener: BackgroundListener;
    let actionListener: BackgroundListener;

    beforeEach(async () => {
        vi.resetModules();
        executeMigrations.mockReset();
        executeMigrations.mockResolvedValue(undefined);

        ({ messageListener, installedListener, actionListener } = installBackgroundHarness(
            browser,
            'browser',
            undefined
        ));

        await import('../../../../src/targets/firefox/background');
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
            const result = await messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: undefined });

            expect(executeMigrations).toHaveBeenCalledOnce();
            expect(result).toBeUndefined();
        });
        it('ignores migration messages from a foreign sender', async () => {
            const result = await messageListener({ type: 'FM_RUN_MIGRATIONS' }, { id: 'other-extension' });

            expect(result).toBeUndefined();
            expect(executeMigrations).not.toHaveBeenCalled();
        });
        it('forwards an authenticated message without options', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ Title: 'The Matrix' }),
            } as unknown as Response);

            const result = await messageListener(
                { type: 'FM_FETCH', url: 'https://www.omdbapi.com/?apikey=k&i=tt0133093' },
                { id: undefined }
            );

            expect(result).toEqual({ ok: true, data: { Title: 'The Matrix' } });
        });
        it('forwards fetch options on an authenticated FM_FETCH message', async () => {
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve('The Matrix'),
            } as unknown as Response);

            const result = await messageListener(
                {
                    type: 'FM_FETCH',
                    url: 'https://www.omdbapi.com/?apikey=k&i=tt0133093',
                    options: { responseType: 'text', timeout: 1234 },
                },
                { id: undefined }
            );

            expect(result).toEqual({ ok: true, data: 'The Matrix' });
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1234);
            setTimeoutSpy.mockRestore();
        });
        it('ignores non-FM_FETCH messages', async () => {
            const result = await messageListener({ type: 'OTHER' });
            expect(result).toBeUndefined();
        });
        it('ignores a message with malformed options', async () => {
            const result = await messageListener({
                type: 'FM_FETCH',
                url: 'https://xmdbapi.com',
                options: { responseType: 'xml' },
            });

            expect(result).toBeUndefined();
        });
        it('ignores messages from external senders', async () => {
            // browser.runtime.id is undefined in test env; sender.id must match it
            const result = await messageListener(
                { type: 'FM_FETCH', url: 'https://xmdbapi.com' },
                { id: 'some-other-extension-id' }
            );
            expect(result).toBeUndefined();
        });
    });

    describe('action clicks', () => {
        it('opens the options page when the action icon is clicked', async () => {
            await actionListener();
            expect(browser.runtime.openOptionsPage).toHaveBeenCalled();
        });
        it('logs an error when opening the options page fails', async () => {
            vi.mocked(browser.runtime.openOptionsPage).mockRejectedValue(new Error('open boom'));
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            await actionListener();
            await flushAsyncWork();

            expect(consoleError).toHaveBeenCalledWith('Failed to open options page', expect.any(Error));
            consoleError.mockRestore();
        });
    });
});
