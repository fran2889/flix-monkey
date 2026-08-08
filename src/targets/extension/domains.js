/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
/** External API hosts that extension background contexts may fetch. */
export const ALLOWED_DOMAINS = ['www.omdbapi.com', 'xmdbapi.com', 'api.agregarr.org', 'v3.sg.media-imdb.com'];

/**
 * @typedef {{valid: true}|{valid: false, error: string}} DomainValidationResult
 */

/**
 * Validates an untrusted URL without throwing. Only an exact hostname in
 * ALLOWED_DOMAINS is accepted.
 *
 * @param {string} url - Candidate external request URL.
 * @returns {DomainValidationResult}
 */
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
