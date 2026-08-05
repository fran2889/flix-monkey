/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { handleFetchMessage } from '../extension/fetch-proxy.js';

// Firefox-only background script.
// Uses bare 'browser' global available in Firefox's non-bundled background environment.
browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (sender?.id !== browser.runtime.id) return;
    if (msg.type !== 'FM_FETCH') return;
    const { url, options = {} } = msg;
    return handleFetchMessage(url, options);
});

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});
