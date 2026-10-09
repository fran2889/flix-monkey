/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter.js';
import { ApiSource, type ApiSourceType } from './constants.js';

/**
 * Tracks temporarily disabled API clients to prevent redundant requests after failures.
 */
export class DisabledClientsManager {
    #adapter: PlatformAdapter;

    /**
     * @param adapter
     */
    constructor(adapter: PlatformAdapter) {
        this.#adapter = adapter;
    }

    /**
     * Checks if an API client is currently disabled due to recent failures.
     *
     * @param source - The API provider identifier (e.g., 'xmdb', 'omdb').
     * @returns True if the source is currently disabled (lockout active), false otherwise.
     */
    async isDisabled(source: ApiSourceType): Promise<boolean> {
        const key = `fm_disabled_${source}`;
        const val = await this.#adapter.storageGet(key);
        const disabledUntil = Number.parseInt(typeof val === 'string' ? val : '0', 10);
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
     * @param source - The API provider identifier to disable.
     * @param durationMs - Lockout duration in milliseconds (typically CLIENT_DISABLE_DURATION).
     */
    async disable(source: ApiSourceType, durationMs: number): Promise<void> {
        const until = Date.now() + durationMs;
        await this.#adapter.storageSet(`fm_disabled_${source}`, until.toString());
    }

    /**
     * Clears all client lockouts and returns list of sources that were previously disabled.
     *
     * @returns Array of API source identifiers that were disabled and have been reset.
     */
    async resetAll(): Promise<ApiSourceType[]> {
        const sources = Object.values(ApiSource) as ApiSourceType[];
        const disabled: ApiSourceType[] = [];
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
