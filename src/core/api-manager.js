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
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from './api-clients.js';
import { ApiSource } from './constants.js';
import { Title } from './title.js';
import { logger } from './logger.js';

export class ApiClientManager {
    #cache;
    #clients;
    #disabledManager;
    #config;

    constructor(cacheManager, disabledManager, adapter, config, clients = []) {
        this.#cache = cacheManager;
        this.#disabledManager = disabledManager;
        this.#config = config;
        this.#clients = clients;

        if (this.#clients.length === 0) {
            this.#clients = ApiClientManager.#createClientsFromConfig(this.#config, this.#disabledManager, adapter);
        }
    }

    static #createClientsFromConfig(config, disabledManager, adapter) {
        const configuredClients = (config.get('apiClients') ?? 'imdbapi').split(',').map(c => c.trim().toLowerCase());
        const clientMap = {
            [ApiSource.XMDB]: XmdbApiClient,
            [ApiSource.OMDB]: OmdbApiClient,
            [ApiSource.IMDBAPI]: ImdbApiDevClient,
        };

        const clients = [];
        configuredClients.forEach(name => {
            if (clientMap[name]) {
                clients.push(new clientMap[name](disabledManager, adapter, config));
            }
        });
        return clients;
    }

    async resetDisabledClients() {
        await this.#disabledManager.resetAll();
        logger.info('All disabled API clients re-enabled.');
    }

    async clearCache() {
        await this.#cache.clear();
        logger.info('API cache cleared.');
    }

    async getData(displayTitle, domYear) {
        const cached = await this.#cache.read(displayTitle, domYear);
        if (cached !== null) return cached;

        let bestData = null;
        let attempted = false;

        const clientStatuses = await Promise.all(
            this.#clients.map(async client => ({
                client,
                status: await client.getStatus(),
            }))
        );

        const healthyClients = clientStatuses.filter(s => s.status.healthy).map(s => s.client);

        for (const client of healthyClients) {
            attempted = true;
            const data = await client.fetch(displayTitle, domYear);
            if (!data) continue;
            if (data.isBetterThan(bestData)) {
                bestData = data;
                break;
            }
            bestData ??= data;
        }

        if (!bestData) {
            if (attempted) {
                logger.warn(
                    `Total failure: No ratings found for "${displayTitle}"${domYear ? ` (${domYear})` : ''} using ${healthyClients.length} healthy clients.`
                );
                await this.#cache.write(displayTitle, domYear, Title.notFound(displayTitle));
            }
            return null;
        }

        await this.#cache.write(displayTitle, domYear, bestData);
        logger.info(`Successfully retrieved ratings for "${displayTitle}"${domYear ? ` (${domYear})` : ''} from ${bestData.source}.`);
        return bestData;
    }
}
