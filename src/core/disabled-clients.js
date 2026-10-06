/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from './constants.js';

/**
 *
 */
export class DisabledClientsManager {
    #adapter;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter
     */
    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * @param {import('./constants.js').ApiSourceValue} source - API source to check.
     * @returns {Promise<boolean>}
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
     * Locks a client out for `durationMs`.
     *
     * @param {string} source - API source to disable.
     * @param {number} durationMs - Lockout duration in milliseconds.
     */
    async disable(source, durationMs) {
        const until = Date.now() + durationMs;
        await this.#adapter.storageSet(`fm_disabled_${source}`, until.toString());
    }

    /**
     * Clears all client lockouts and returns list of sources that were previously disabled.
     *
     * @returns {Promise<import('./constants.js').ApiSourceValue[]>} List of sources that were disabled.
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
