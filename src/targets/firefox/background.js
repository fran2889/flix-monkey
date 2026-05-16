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
const HTTP_TIMEOUT = 8000;

browser.runtime.onMessage.addListener(async msg => {
    if (msg.type !== 'FM_FETCH') return;
    const { url, options = {} } = msg;
    const { responseType = 'json', timeout = HTTP_TIMEOUT } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        });
        clearTimeout(timeoutId);
        if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
        const data = responseType === 'json' ? await res.json() : await res.text();
        return { data };
    } catch (err) {
        clearTimeout(timeoutId);
        return { error: err.message };
    }
});

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});
