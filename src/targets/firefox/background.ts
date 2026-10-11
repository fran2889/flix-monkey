/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { HttpFetchOptions } from '../../platform/adapter';
import type { FetchProxyResponse } from '../../types/extension';
import { handleFetchMessage } from '../extension/fetch-proxy';
import { createExtensionMigrationExecutor } from '../extension/migrations';

/**
 * Firefox background script global: browser API is available as a bare global.
 * This declaration provides minimal typing for the browser namespace used in this module.
 */
declare const browser: {
    runtime: {
        id: string;
        onInstalled: { addListener: (_callback: () => void) => void };
        onMessage: {
            addListener: (_callback: (_msg: unknown, _sender: { id?: string }) => Promise<unknown> | unknown) => void;
        };
        openOptionsPage: () => Promise<void>;
    };
    action: {
        onClicked: { addListener: (_callback: () => void) => void };
    };
};

/**
 * Message types for browser.runtime.onMessage communication.
 */
type FMRunMigrationsMessage = { type: 'FM_RUN_MIGRATIONS' };
type FMFetchMessage = { type: 'FM_FETCH'; url: string; options?: HttpFetchOptions };
type ExtensionMessage = FMRunMigrationsMessage | FMFetchMessage;

const executeMigrations = createExtensionMigrationExecutor();

/**
 * Run migrations on extension install.
 */
browser.runtime.onInstalled.addListener((): void => {
    executeMigrations().catch((error: unknown): void => {
        console.error('Failed to run storage migrations', error);
    });
});

/**
 * Handle messages from other extension contexts.
 * Firefox background scripts use the bare 'browser' global.
 * All code paths must explicitly return.
 */
browser.runtime.onMessage.addListener(
    async (msg: unknown, sender: { id?: string }): Promise<FetchProxyResponse | undefined> => {
        if (sender?.id !== browser.runtime.id) {
            return undefined;
        }

        const message = msg as ExtensionMessage;
        if (message.type === 'FM_RUN_MIGRATIONS') {
            await executeMigrations();
            return undefined;
        }

        if (message.type !== 'FM_FETCH') {
            return undefined;
        }

        const { url, options } = message;
        return handleFetchMessage(url, options ?? {});
    }
);

/**
 * Open options page when extension action is clicked.
 */
browser.action.onClicked.addListener((): void => {
    browser.runtime.openOptionsPage();
});
