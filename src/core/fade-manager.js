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
    #config;
    #prefix = 'fm-fade:';

    constructor(adapter, config) {
        this.#adapter = adapter;
        this.#config = config;
    }

    async getOverride(titleKey) {
        const val = await this.#adapter.storageGet(`${this.#prefix}${titleKey}`);
        if (val === 'true') return true;
        if (val === 'false') return false;
        return null;
    }

    async setOverride(titleKey, value) {
        const key = `${this.#prefix}${titleKey}`;
        if (value === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, String(value));
        }
    }

    shouldFade(fadeOverride, rating, fadeable) {
        if (fadeable && this.#config.get('enableFadeToggle', true) && fadeOverride !== null) {
            return fadeOverride;
        }
        if (fadeable && this.#config.get('enableFadeUnderRating', false)) {
            return typeof rating === 'number' && rating < this.#config.getFloat('fadeRatingThreshold', 6.0);
        }
        return false;
    }

    getToggleState(fadeOverride, isRatingFaded) {
        if (fadeOverride === true) return 'faded';
        if (fadeOverride === false) return 'not-faded';
        return isRatingFaded ? 'faded' : 'auto';
    }

    stateToOverride(state) {
        const map = { faded: true, 'not-faded': false, auto: null };
        return state in map ? map[state] : null;
    }

    nextToggleState(currentState) {
        const cycle = { faded: 'not-faded', 'not-faded': 'auto', auto: 'faded' };
        return cycle[currentState] ?? 'auto';
    }
}
