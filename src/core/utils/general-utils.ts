/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { IDLE_CALLBACK_TIMEOUT_MS } from '../constants';

/**
 * Error used at application boundaries. HTTP request failures may include the
 * request URL, response status, and response body metadata.
 */
export class FlixMonkeyError extends Error {
    url: string | undefined;
    status: number | undefined;
    body: string | undefined;

    /**
     * Creates a FlixMonkeyError with optional request details.
     *
     * @param {string} message - Error message.
     * @param {string} [url] - Request URL if applicable.
     * @param {number} [status] - HTTP status code if applicable.
     * @param {string} [body] - Response body if applicable.
     */
    constructor(message: string, url?: string, status?: number, body?: string) {
        super(message);
        this.name = 'FlixMonkeyError';
        this.url = url;
        this.status = status;
        this.body = body;
    }
}

/**
 * Debounced wrapper that forwards its receiver and arguments to the wrapped function.
 */
export type DebouncedFunction<T extends (..._args: unknown[]) => unknown> = (..._args: Parameters<T>) => ReturnType<T>;

/**
 * Creates a debounced function that delays invoking the input function until after
 * the specified wait time has elapsed since the last time the debounced function was invoked.
 *
 * @template T - Function type to debounce
 * @param {T} func - Function to debounce
 * @param {number} wait - Time in milliseconds to wait
 * @returns {DebouncedFunction<T>} Debounced function
 */
export function debounce<T extends (..._args: unknown[]) => unknown>(func: T, wait: number): DebouncedFunction<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function (this: unknown, ..._args: Parameters<T>) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, _args), wait);
    } as DebouncedFunction<T>;
}

/**
 * Schedules work with requestIdleCallback and its timeout when available;
 * otherwise schedules it with setTimeout.
 *
 * @param {Function} func - Function to execute when idle
 */
export function runIdle(func: () => void): void {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(func, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
    } else {
        setTimeout(func, 1);
    }
}
