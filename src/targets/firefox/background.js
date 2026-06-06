/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
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
