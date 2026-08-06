/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DEFAULT_FETCH_TIMEOUT } from '../../core/constants.js';
import { validateDomain } from './domains.js';

/**
 * @typedef {{data: unknown}|{error: string, status?: number, body?: string|null}} FetchProxyResponse
 */

/**
 * @param {string} url
 * @param {import('../../platform/adapter.js').HttpFetchOptions} [options]
 * @returns {Promise<FetchProxyResponse>}
 */
export async function handleFetchMessage(url, options = {}) {
    const validation = validateDomain(url);
    if (!validation.valid) {
        return { error: validation.error };
    }

    const { responseType = 'json', timeout = DEFAULT_FETCH_TIMEOUT } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            const body = await res.text().catch(() => null);
            return { error: `HTTP ${res.status}`, status: res.status, body: body ? body.slice(0, 200) : null };
        }
        const data = responseType === 'json' ? await res.json() : await res.text();
        return { data };
    } catch (err) {
        clearTimeout(timeoutId);
        return { error: err.message };
    }
}
