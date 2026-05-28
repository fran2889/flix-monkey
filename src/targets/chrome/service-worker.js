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
import { validateDomain } from '../extension/domains.js';

const HTTP_TIMEOUT = 8000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;

    const validation = validateDomain(url);
    if (!validation.valid) {
        sendResponse({ error: validation.error });
        return false;
    }

    const { responseType = 'json', timeout = HTTP_TIMEOUT } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    })
        .then(async res => {
            clearTimeout(timeoutId);
            if (!res.ok) {
                sendResponse({ error: `HTTP ${res.status}`, status: res.status });
                return;
            }
            const data = responseType === 'json' ? await res.json() : await res.text();
            sendResponse({ data });
        })
        .catch(err => {
            clearTimeout(timeoutId);
            sendResponse({ error: err.message });
        });
    return true; // keep message channel open for async sendResponse
});

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
