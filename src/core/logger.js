/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { CONFIG_DEFAULTS } from './config-fields.js';

export class Logger {
    #prefix = '[FlixMonkey]';
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    debug(message, ...args) {
        if (String(this.#adapter.configGet('debug') ?? CONFIG_DEFAULTS['debug']) === 'true') {
            console.log(`${this.#prefix} ${message}`, ...args);
        }
    }

    info(message, ...args) {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}
