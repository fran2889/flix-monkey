/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
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

/**
 * Parse hex color string to RGB object.
 *
 * @param {string} hex - Hex color string with leading # (e.g., '#ff0000')
 * @returns {{r: number, g: number, b: number}} RGB object with values 0-255
 */
export function parseHex(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}
