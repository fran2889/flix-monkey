/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { PlatformAdapter } from '../platform/adapter';
import { CONFIG_DEFAULTS } from './config/index';

/** Centralized logging with platform-specific config support. */
export class Logger {
    readonly #prefix = '[FlixMonkey]';
    readonly #adapter: PlatformAdapter;

    /**
     * @param adapter
     */
    constructor(adapter: PlatformAdapter) {
        this.#adapter = adapter;
    }

    /**
     * Logs debug message when debug mode is enabled in configuration.
     *
     * @param message
     * @param args
     */
    debug(message: unknown, ...args: unknown[]): void {
        if (String(this.#adapter.configGet('debug') ?? CONFIG_DEFAULTS['debug']) === 'true') {
            console.log(`${this.#prefix} ${message}`, ...args);
        }
    }

    /**
     * Logs informational message to console.
     *
     * @param message
     * @param args
     */
    info(message: unknown, ...args: unknown[]): void {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    /**
     * Logs warning message to console.
     *
     * @param message
     * @param args
     */
    warn(message: unknown, ...args: unknown[]): void {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    /**
     * Logs error message to console.
     *
     * @param message
     * @param args
     */
    error(message: unknown, ...args: unknown[]): void {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}
