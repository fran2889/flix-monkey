/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { handleFetchMessage } from '../extension/fetch-proxy';
import { parseExtensionMessage } from '../extension/messages';
import { createExtensionMigrationExecutor } from '../extension/migrations';

/**
 * Chrome service worker global: chrome API is available as a bare global.
 * This declaration provides minimal typing for the chrome namespace used in this module.
 */
interface ChromeMessageSender {
    id?: string;
}
type ChromeSendResponse = (_response?: unknown) => void;

declare const chrome: {
    runtime: {
        id: string;
        onInstalled: { addListener: (_callback: () => void) => void };
        onMessage: {
            addListener: (
                _callback: (
                    _msg: unknown,
                    _sender: ChromeMessageSender,
                    _sendResponse: ChromeSendResponse
                ) => boolean | void
            ) => void;
        };
        openOptionsPage: () => Promise<void>;
    };
    action: {
        onClicked: { addListener: (_callback: () => void) => void };
    };
};

const executeMigrations = createExtensionMigrationExecutor();

chrome.runtime.onInstalled.addListener(() => {
    executeMigrations().catch((error: unknown) => {
        console.error('Failed to run storage migrations', error);
    });
});

/**
 * Handle messages from other extension contexts.
 * Chrome service workers use the bare 'chrome' global.
 * All code paths must explicitly return.
 */
chrome.runtime.onMessage.addListener(
    (msg: unknown, sender: ChromeMessageSender, sendResponse: ChromeSendResponse): boolean => {
        if (sender?.id !== chrome.runtime.id) {
            return false;
        }

        const message = parseExtensionMessage(msg);
        if (!message) return false;
        if (message.type === 'FM_RUN_MIGRATIONS') {
            executeMigrations().then(
                () => sendResponse({}),
                (error: unknown) => sendResponse({ error: error instanceof Error ? error.message : String(error) })
            );
            return true;
        }

        const { url, options } = message;
        handleFetchMessage(url, options ?? {})
            .then(sendResponse)
            .catch((error: unknown) => {
                sendResponse({ error: error instanceof Error ? error.message : String(error) });
            });
        return true; // keep message channel open for async sendResponse
    }
);

/**
 * Open options page when extension action is clicked.
 */
chrome.action.onClicked.addListener((): void => {
    chrome.runtime.openOptionsPage().catch((error: unknown) => {
        console.error('Failed to open options page', error);
    });
});
