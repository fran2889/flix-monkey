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
     * Reports whether an API client is currently disabled due to recent failures.
     *
     * This is a read-only check: it never writes to storage. A marker that is
     * absent, `'0'`, non-string, non-numeric, or already expired reads as not
     * disabled.
     *
     * @param source - The API provider identifier (e.g., 'xmdb', 'omdb').
     * @returns True when the source's lockout has not expired, false otherwise.
     */
    async isDisabled(source: ApiSourceType): Promise<boolean> {
        return (await this.#disabledUntil(source)) > Date.now();
    }

    async #disabledUntil(source: ApiSourceType): Promise<number> {
        const stored = await this.#adapter.storageGet(this.#key(source));
        if (typeof stored !== 'string') return 0;
        const parsed = Number.parseInt(stored, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
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
