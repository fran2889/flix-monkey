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
        browser.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined);
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
        } as unknown as { prototype: AbortController; new (): AbortController };

        await import('../../../../src/targets/firefox/background');
    });

    it.each([{ reason: 'install' }, { reason: 'update' }])('runs migrations on extension $reason', async details => {
        await installedListener(details);
        await Promise.resolve();
        expect(executeMigrations).toHaveBeenCalledOnce();
    });

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

    it('opens the options page when the action icon is clicked', async () => {
        await actionListener();
        expect(browser.runtime.openOptionsPage).toHaveBeenCalled();
    });
});
