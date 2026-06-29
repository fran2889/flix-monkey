/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
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
