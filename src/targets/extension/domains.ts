/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { DomainValidationResult } from '../../types/extension';

/** External API hosts that extension background contexts may fetch. */
const ALLOWED_DOMAINS = new Set(['www.omdbapi.com', 'xmdbapi.com', 'api.agregarr.org', 'v3.sg.media-imdb.com']);

/**
 * Validates an untrusted URL without throwing. Only an exact hostname in
 * ALLOWED_DOMAINS is accepted.
 *
 * @param url - Candidate external request URL.
 * @returns Domain validation result
 */
export function validateDomain(url: string): DomainValidationResult {
    try {
        const urlObj = new URL(url);
        if (!ALLOWED_DOMAINS.has(urlObj.hostname)) {
            return { valid: false, error: 'Domain not allowed' };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL' };
    }
}
