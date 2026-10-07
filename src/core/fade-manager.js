/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Advances a fade override to its next state in the auto -> always -> never cycle.
 *
 * @param {string|null} current - Current override state, or null for auto.
 * @returns {'always'|'never'|null} Next override state, or null to return to auto.
 */
export function nextFadeState(current) {
    if (current === null) return 'always';
    if (current === 'always') return 'never';
    return null;
}

/**
 * Manages fade state overrides for individual titles based on user preferences and ratings.
 */
export class FadeManager {
    #adapter;
    #config;
    #prefix = 'fm-fade:';

    /**
     * Overrides beat config; config applies only when a title has no stored override.
     *
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter - Storage adapter for per-title overrides.
     * @param {import('./config/config-manager.js').ConfigManager} config - Application configuration, read when no override applies.
     */
    constructor(adapter, config) {
        this.#adapter = adapter;
        this.#config = config;
    }

    /**
     * Reads the stored fade override for a title.
     *
     * @param {string} dedupKey - Slugified display title.
     * @returns {Promise<'always'|'never'|null>} Stored override, or null when the title is on automatic fade.
     */
    async getOverride(dedupKey) {
        const val = await this.#adapter.storageGet(`${this.#prefix}${dedupKey}`);
        if (val === 'always' || val === 'never') return val;
        return null;
    }

    /**
     * Persists or clears the fade override for a title.
     *
     * @param {string} dedupKey - Slugified display title.
     * @param {'always'|'never'|null} state - Override state, or null to clear.
     * @returns {Promise<void>} Resolves once the override is persisted or removed.
     */
    async setOverride(dedupKey, state) {
        const key = `${this.#prefix}${dedupKey}`;
        if (state === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, state);
        }
    }

    /**
     * Decides whether a container should be dimmed.
     *
     * @param {string|null} override - Stored per-title override, or null when auto.
     * @param {number|null} rating - IMDb rating, or null when unknown.
     * @returns {boolean} True when the container should be faded.
     */
    shouldFade(override, rating) {
        if (override === 'always') return true;
        if (override === 'never') return false;
        if (!this.#config.getBool('enableFadeUnderRating')) return false;
        return typeof rating === 'number' && rating < this.#config.getFloat('fadeRatingThreshold');
    }
}
