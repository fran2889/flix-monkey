/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from './constants.js';

/**
 * Tracks temporarily disabled API clients to prevent redundant requests after failures.
 */
export class DisabledClientsManager {
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * Checks if an API client is currently disabled due to recent failures.
     *
     * @param {import('./constants.js').ApiSourceValue} source - The API provider identifier (e.g., 'xmdb', 'omdb').
     * @returns {Promise<boolean>} True if the source is currently disabled (lockout active), false otherwise.
     */
    async isDisabled(source) {
        const key = `fm_disabled_${source}`;
        const val = await this.#adapter.storageGet(key);
        const disabledUntil = Number.parseInt(val ?? '0', 10);
        if (disabledUntil === 0) return false;
        if (Date.now() > disabledUntil) {
            await this.#adapter.storageSet(key, '0');
            return false;
        }
        return true;
    }

    /**
     * Disables an API client for the specified duration to prevent redundant requests after failures.
     *
     * @param {import('./constants.js').ApiSourceValue} source - The API provider identifier to disable.
     * @param {number} durationMs - Lockout duration in milliseconds (typically CLIENT_DISABLE_DURATION).
     */
    async disable(source, durationMs) {
        const until = Date.now() + durationMs;
        await this.#adapter.storageSet(`fm_disabled_${source}`, until.toString());
    }

    /**
     * Clears all client lockouts and returns list of sources that were previously disabled.
     *
     * @returns {Promise<import('./constants.js').ApiSourceValue[]>} Array of API source identifiers that were disabled and have been reset.
     */
    async resetAll() {
        const sources = Object.values(ApiSource);
        const disabled = [];
        await Promise.all(
            sources.map(async source => {
                const isDisabled = await this.isDisabled(source);
                if (isDisabled) {
                    disabled.push(source);
                    await this.#adapter.storageSet(`fm_disabled_${source}`, '0');
                }
            })
        );
        return disabled;
    }
}
