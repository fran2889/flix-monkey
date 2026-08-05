/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
export const ALLOWED_DOMAINS = ['www.omdbapi.com', 'xmdbapi.com', 'api.agregarr.org', 'v3.sg.media-imdb.com'];

export function validateDomain(url) {
    try {
        const urlObj = new URL(url);
        if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
            return { valid: false, error: 'Domain not allowed' };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL' };
    }
}
