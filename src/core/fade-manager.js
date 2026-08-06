/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
export class FadeManager {
    #adapter;
    #prefix = 'fm-fade:';

    /** @param {import('../platform/adapter.js').PlatformAdapter} adapter */
    constructor(adapter) {
        this.#adapter = adapter;
    }

    /** @param {string} dedupKey @returns {Promise<'always'|'never'|null>} */
    async getOverride(dedupKey) {
        const val = await this.#adapter.storageGet(`${this.#prefix}${dedupKey}`);
        if (val === 'always' || val === 'never') return val;
        return null;
    }

    /** @param {string} dedupKey @param {'always'|'never'|null} state @returns {Promise<void>} */
    async setOverride(dedupKey, state) {
        const key = `${this.#prefix}${dedupKey}`;
        if (state === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, state);
        }
    }

    /**
     * @param {'always'|'never'|null} override
     * @param {number|null} rating
     * @param {import('./config-manager.js').ConfigManager} config
     * @returns {boolean}
     */
    shouldFade(override, rating, config) {
        if (override === 'always') return true;
        if (override === 'never') return false;
        if (!config.getBool('enableFadeUnderRating')) return false;
        return typeof rating === 'number' && rating < config.getFloat('fadeRatingThreshold');
    }

    /** @param {'always'|'never'|null} current @returns {'always'|'never'|null} */
    nextState(current) {
        if (current === null) return 'always';
        if (current === 'always') return 'never';
        return null;
    }
}
