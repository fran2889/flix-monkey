/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Error used at application boundaries. HTTP request failures may include the
 * request URL, response status, and response body metadata.
 */
export class FlixMonkeyError extends Error {
    constructor(message, url = null, status = null, body = null) {
        super(message);
        this.name = 'FlixMonkeyError';
        this.url = url;
        this.status = status;
        this.body = body;
    }
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Schedules work with requestIdleCallback and its timeout when available;
 * otherwise schedules it with setTimeout.
 */
export function runIdle(func, timeout = 2000) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(func, { timeout });
    } else {
        setTimeout(func, 1);
    }
}

export function slugify(str) {
    let slug = '';

    for (const char of str.normalize('NFKC').toLowerCase()) {
        if (/^[a-z0-9]$/.test(char)) {
            slug += char;
        } else if (char.codePointAt(0) > 0x7f && /[\p{L}\p{N}]/u.test(char)) {
            slug += encodeURIComponent(char);
        } else if (slug && !slug.endsWith('_')) {
            slug += '_';
        }
    }

    return slug.replace(/_$/, '');
}
