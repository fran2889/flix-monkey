/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { CONFIG_DEFAULTS } from './config/index.js';

/** Centralized logging with platform-specific config support. */
export class Logger {
    #prefix = '[FlixMonkey]';
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * Logs debug message when debug mode is enabled in configuration.
     *
     * @param {unknown} message - Message or format string to log.
     * @param {...unknown} args - Values interpolated into `message`.
     */
    debug(message, ...args) {
        if (String(this.#adapter.configGet('debug') ?? CONFIG_DEFAULTS['debug']) === 'true') {
            console.log(`${this.#prefix} ${message}`, ...args);
        }
    }

    /**
     * Logs informational message to console.
     *
     * @param {unknown} message - Message or format string to log.
     * @param {...unknown} args - Values interpolated into `message`.
     */
    info(message, ...args) {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    /**
     * Logs warning message to console.
     *
     * @param {unknown} message - Message or format string to log.
     * @param {...unknown} args - Values interpolated into `message`.
     */
    warn(message, ...args) {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    /**
     * Logs error message to console.
     *
     * @param {unknown} message - Message or format string to log.
     * @param {...unknown} args - Values interpolated into `message`.
     */
    error(message, ...args) {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}
