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

/**
 * Creates a debounced function that delays invoking the input function until after
 * the specified wait time has elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Time in milliseconds to wait
 * @returns {Function} Debounced function
 */
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
 *
 * @param {Function} func - Function to execute when idle
 * @param {number} [timeout=2000] - Timeout in milliseconds for requestIdleCallback
 */
export function runIdle(func, timeout = 2000) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(func, { timeout });
    } else {
        setTimeout(func, 1);
    }
}
