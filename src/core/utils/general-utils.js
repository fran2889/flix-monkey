/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { IDLE_CALLBACK_TIMEOUT_MS } from '../constants.js';

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
 * Debounced wrapper that forwards its receiver and arguments to the wrapped function.
 *
 * @callback DebouncedFunction
 * @this {unknown}
 * @param {...unknown[]} args - Arguments forwarded to the wrapped function.
 * @returns {unknown} Whatever the wrapped function returns, once the wait elapses.
 */

/**
 * Creates a debounced function that delays invoking the input function until after
 * the specified wait time has elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Time in milliseconds to wait
 * @returns {DebouncedFunction} Debounced function
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
 * @param {IdleRequestCallback} func - Function to execute when idle
 */
export function runIdle(func) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(func, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
    } else {
        setTimeout(func, 1);
    }
}
