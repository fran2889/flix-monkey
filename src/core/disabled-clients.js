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
import { CLIENT_DISABLE_DURATION, ApiSource } from './constants.js';

export class DisabledClientsManager {
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

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

    async disable(source, durationMs = CLIENT_DISABLE_DURATION) {
        const until = Date.now() + durationMs;
        await this.#adapter.storageSet(`fm_disabled_${source}`, until.toString());
    }

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
