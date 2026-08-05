/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
export class FadeManager {
    #adapter;
    #prefix = 'fm-fade:';

    constructor(adapter) {
        this.#adapter = adapter;
    }

    async getOverride(dedupKey) {
        const val = await this.#adapter.storageGet(`${this.#prefix}${dedupKey}`);
        if (val === 'always' || val === 'never') return val;
        return null;
    }

    async setOverride(dedupKey, state) {
        const key = `${this.#prefix}${dedupKey}`;
        if (state === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, state);
        }
    }

    shouldFade(override, rating, config) {
        if (override === 'always') return true;
        if (override === 'never') return false;
        if (!config.getBool('enableFadeUnderRating')) return false;
        return typeof rating === 'number' && rating < config.getFloat('fadeRatingThreshold');
    }

    nextState(current) {
        if (current === null) return 'always';
        if (current === 'always') return 'never';
        return null;
    }
}
