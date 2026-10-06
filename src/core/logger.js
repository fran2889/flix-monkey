/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { CONFIG_DEFAULTS } from './config/index.js';

/** Centralized logging with platform-specific config support. */
export class Logger {
    #prefix = '[FlixMonkey]';
    #adapter;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter
     */
    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * @param {unknown} message
     * @param {...unknown} args
     */
    debug(message, ...args) {
        if (String(this.#adapter.configGet('debug') ?? CONFIG_DEFAULTS['debug']) === 'true') {
            console.log(`${this.#prefix} ${message}`, ...args);
        }
    }

    /**
     * @param {unknown} message
     * @param {...unknown} args
     */
    info(message, ...args) {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    /**
     * @param {unknown} message
     * @param {...unknown} args
     */
    warn(message, ...args) {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    /**
     * @param {unknown} message
     * @param {...unknown} args
     */
    error(message, ...args) {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}
