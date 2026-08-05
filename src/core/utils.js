/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Custom error class for FlixMonkey.
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

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Schedules a function to run during the browser's idle periods.
 * Falls back to setTimeout if requestIdleCallback is not available.
 *
 * @param {Function} func The function to schedule.
 * @param {number} timeout Optional timeout after which the function will be run if it hasn't already.
 */
export function runIdle(func, timeout = 2000) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(func, { timeout });
    } else {
        setTimeout(func, 1);
    }
}

/**
 * Converts a string to a slug by lowercasing, replacing non-alphanumeric sequences with underscores,
 * and trimming leading/trailing underscores.
 *
 * @param {string} str The string to slugify.
 * @returns {string} The slugified string.
 */
export function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}
