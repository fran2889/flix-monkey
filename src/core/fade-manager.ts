/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';
import type { ConfigManager } from './config/config-manager';

/**
 * Fade override state type.
 */
export type FadeOverrideState = 'always' | 'never' | undefined;

/**
 * Advances a fade override to its next state in the auto -> always -> never cycle.
 *
 * @param current - Current override state, or undefined for auto.
 * @returns Next override state, or undefined to return to auto.
 */
export function nextFadeState(current: FadeOverrideState): FadeOverrideState {
    if (current === undefined) return 'always';
    if (current === 'always') return 'never';
    return undefined;
}

/**
 * Manages fade state overrides for individual titles based on user preferences and ratings.
 */
export class FadeManager {
    readonly #adapter: PlatformAdapter;
    readonly #config: ConfigManager;
    readonly #prefix = 'fm-fade:';

    /**
     * Creates a manager bound to the storage adapter and configuration.
     *
     * @param adapter - Storage adapter for per-title overrides.
     * @param config - Application configuration, read when no override applies.
     */
    constructor(adapter: PlatformAdapter, config: ConfigManager) {
        this.#adapter = adapter;
        this.#config = config;
    }

    /**
     * Reads the stored fade override for a title.
     *
     * @param dedupKey - Slugified display title.
     * @returns Promise resolving to the override state, or undefined when auto.
     */
    async getOverride(dedupKey: string): Promise<FadeOverrideState> {
        const val = await this.#adapter.storageGet(`${this.#prefix}${dedupKey}`);
        if (val === 'always' || val === 'never') return val;
        return undefined;
    }

    /**
     * Stores or clears the fade override for a title.
     *
     * @param dedupKey - Slugified display title.
     * @param state - Override state, or undefined to clear.
     * @returns Promise that resolves when the operation is complete.
     */
    async setOverride(dedupKey: string, state: FadeOverrideState): Promise<void> {
        const key = `${this.#prefix}${dedupKey}`;
        if (state === undefined) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, state);
        }
    }

    /**
     * Decides whether a container should be dimmed.
     *
     * @param override - Stored per-title override, or undefined when auto.
     * @param rating - IMDb rating, or undefined when unknown.
     * @returns True when the container should be faded.
     */
    shouldFade(override: FadeOverrideState, rating: number | undefined): boolean {
        if (override === 'always') return true;
        if (override === 'never') return false;
        if (!this.#config.getBool('enableFadeUnderRating')) return false;
        return typeof rating === 'number' && rating < this.#config.getFloat('fadeRatingThreshold');
    }
}
