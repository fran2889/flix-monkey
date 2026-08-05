/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource, CLIENT_DISABLE_DURATION } from './constants.js';

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
