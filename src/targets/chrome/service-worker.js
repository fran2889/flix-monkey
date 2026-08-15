/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { handleFetchMessage } from '../extension/fetch-proxy.js';
import { createExtensionMigrationExecutor } from '../extension/migrations.js';

const executeMigrations = createExtensionMigrationExecutor();

chrome.runtime.onInstalled.addListener(() => {
    executeMigrations().catch(error => {
        console.error('Failed to run storage migrations', error);
    });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id) return false;
    if (msg.type === 'FM_RUN_MIGRATIONS') {
        executeMigrations().then(
            () => sendResponse({}),
            error => sendResponse({ error: error.message })
        );
        return true;
    }
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    handleFetchMessage(url, options).then(sendResponse);
    return true; // keep message channel open for async sendResponse
});

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
