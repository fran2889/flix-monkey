/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Converts a string to a URL-friendly slug.
 *
 * @param {string} str - Input string to slugify
 * @returns {string} URL-friendly slug string
 */
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
