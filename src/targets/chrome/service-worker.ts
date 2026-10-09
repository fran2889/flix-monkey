/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { HttpFetchOptions } from '../../platform/adapter.js';
import type { FetchProxyResponse } from '../../types/extension.js';
import { handleFetchMessage } from '../extension/fetch-proxy.js';
import { createExtensionMigrationExecutor } from '../extension/migrations.js';

/**
 * Chrome service worker global: chrome API is available as a bare global.
 * This declaration provides minimal typing for the chrome namespace used in this module.
 */
declare const chrome: {
    runtime: {
        id: string;
        onInstalled: { addListener: (_callback: () => void) => void };
        onMessage: {
            addListener: (
                _callback: (
                    _msg: unknown,
                    _sender: { id?: string },
                    _sendResponse: (_response: unknown) => void
                ) => boolean | void
            ) => void;
        };
        openOptionsPage: () => Promise<void>;
    };
    action: {
        onClicked: { addListener: (_callback: () => void) => void };
    };
};

/**
 * Message types for chrome.runtime.onMessage communication.
 */
type FMRunMigrationsMessage = { type: 'FM_RUN_MIGRATIONS' };
type FMFetchMessage = { type: 'FM_FETCH'; url: string; options?: HttpFetchOptions };
type ExtensionMessage = FMRunMigrationsMessage | FMFetchMessage;

const executeMigrations = createExtensionMigrationExecutor();

/**
 * Run migrations on extension install.
 */
chrome.runtime.onInstalled.addListener((): void => {
    executeMigrations().catch((error: unknown): void => {
        console.error('Failed to run storage migrations', error);
    });
});

/**
 * Handle messages from other extension contexts.
 * Chrome service workers use the bare 'chrome' global.
 * All code paths must explicitly return.
 * Uses sendResponse callback pattern for chrome.runtime.onMessage.
 */
chrome.runtime.onMessage.addListener(
    (
        msg: unknown,
        sender: { id?: string },
        sendResponse: (_response: FetchProxyResponse | Record<string, never>) => void
    ): boolean => {
        if (sender?.id !== chrome.runtime.id) {
            return false;
        }

        const message = msg as ExtensionMessage;
        if (message.type === 'FM_RUN_MIGRATIONS') {
            executeMigrations().then(
                (): void => {
                    sendResponse({});
                },
                (error: unknown): void => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    sendResponse({ error: errorMessage });
                }
            );
            return true; // keep message channel open for async sendResponse
        }

        if (message.type !== 'FM_FETCH') {
            return false;
        }

        const { url, options } = message;
        handleFetchMessage(url, options ?? {}).then(sendResponse);
        return true; // keep message channel open for async sendResponse
    }
);

/**
 * Open options page when extension action is clicked.
 */
chrome.action.onClicked.addListener((): void => {
    chrome.runtime.openOptionsPage();
});
