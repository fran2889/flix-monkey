import { CacheManager } from './cache.js';
import { DisabledClientsManager } from './disabled-clients.js';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from './api-clients.js';
import { ApiSource } from './constants.js';
import { Title } from './title.js';
import { CONFIG } from './config.js';

export class ApiClientManager {
    #cache;
    #clients;
    #disabledManager;

    constructor(cacheManager, disabledManager, adapter, clients = []) {
        this.#cache = cacheManager;
        this.#disabledManager = disabledManager;
        this.#clients = clients;

        if (this.#clients.length === 0) {
            const configuredClients = (CONFIG.apiClients ?? 'imdbapi').split(',').map(c => c.trim().toLowerCase());
            const clientMap = {
                [ApiSource.XMDB]: XmdbApiClient,
                [ApiSource.OMDB]: OmdbApiClient,
                [ApiSource.IMDBAPI]: ImdbApiDevClient,
            };
            configuredClients.forEach(name => {
                if (clientMap[name]) this.#clients.push(new clientMap[name](this.#disabledManager, adapter));
            });
        }
    }

    async resetDisabledClients() {
        await this.#disabledManager.resetAll();
        console.warn('[FlixMonkey] All disabled API clients re-enabled.');
    }

    async getData(displayTitle, domYear) {
        const cached = await this.#cache.read(displayTitle, domYear);
        if (cached !== null) return cached;

        let bestData = null;

        for (const client of this.#clients) {
            if (await client.isDisabled()) continue;
            const data = await client.fetch(displayTitle, domYear);
            if (!data) continue;
            if (data.isBetterThan(bestData)) {
                bestData = data;
                break;
            }
            bestData ??= data;
        }

        if (!bestData) {
            console.warn(
                `[FlixMonkey] Total failure: No ratings found for "${displayTitle}"${domYear ? ` (${domYear})` : ''} using any configured client.`
            );
            await this.#cache.write(displayTitle, domYear, Title.notFound(displayTitle));
            return null;
        }

        await this.#cache.write(displayTitle, domYear, bestData);
        return bestData;
    }
}
