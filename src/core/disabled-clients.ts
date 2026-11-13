/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';
import { ApiSource, type ApiSourceType } from './constants';

/**
 * Tracks temporarily disabled API clients to prevent redundant requests after failures.
 */
export class DisabledClientsManager {
    readonly #adapter: PlatformAdapter;

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
        const key = this.#key(source);
        const val = await this.#adapter.storageGet(key);
        const disabledUntil = Number.parseInt(typeof val === 'string' ? val : '0', 10);
        if (disabledUntil === 0) return false;
        if (Date.now() > disabledUntil) {
            await this.#adapter.storageSet(key, '0');
            return false;
        }
        return true;
    }

    #key(source: ApiSourceType): string {
        return `fm_disabled_${source}`;
    }

    /**
     * Disables an API client for the specified duration to prevent redundant requests after failures.
     *
     * @param source - The API provider identifier to disable.
     * @param durationMs - Lockout duration in milliseconds (typically CLIENT_DISABLE_DURATION).
     */
    async disable(source: ApiSourceType, durationMs: number): Promise<void> {
        const until = Date.now() + durationMs;
        await this.#adapter.storageSet(this.#key(source), until.toString());
    }

    /**
     * Clears all client lockouts and returns list of sources that were previously disabled.
     *
     * Sources are checked and reset sequentially in `ApiSource` order, so the
     * returned list is deterministic and a storage failure rejects immediately.
     *
     * @returns Array of API source identifiers that were disabled and have been reset.
     */
    async resetAll(): Promise<ApiSourceType[]> {
        const disabled: ApiSourceType[] = [];
        for (const source of Object.values(ApiSource)) {
            if (await this.isDisabled(source)) {
                disabled.push(source);
                await this.#adapter.storageSet(this.#key(source), '0');
            }
        }
        return disabled;
    }
}
