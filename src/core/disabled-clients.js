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
        await Promise.all(
            Object.values(ApiSource).map(source =>
                this.#adapter.storageSet(`fm_disabled_${source}`, '0')
            )
        );
    }
}
