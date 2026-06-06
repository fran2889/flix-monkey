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
    #client;
    #disabledManager;
    #config;

    constructor(cacheManager, disabledManager, adapter, config, client = null) {
        this.#cache = cacheManager;
        this.#disabledManager = disabledManager;
        this.#config = config;
        this.#client = client;

        if (!this.#client) {
            this.#client = ApiClientManager.#createClientFromConfig(this.#config, this.#disabledManager, adapter);
        }
    }

    getClient() {
        return this.#client;
    }

    static #createClientFromConfig(config, disabledManager, adapter) {
        const provider = (config.get('apiClient') ?? 'imdbapi').trim().toLowerCase();
        const clientMap = {
            [ApiSource.XMDB]: XmdbApiClient,
            [ApiSource.OMDB]: OmdbApiClient,
            [ApiSource.IMDBAPI]: ImdbApiDevClient,
        };

        const ClientClass = clientMap[provider] ?? ImdbApiDevClient;
        return new ClientClass(disabledManager, adapter, config);
    }

    async resetDisabledClients() {
        const reenabled = await this.#disabledManager.resetAll();
        if (reenabled.length > 0) {
            logger.info(`Re-enabled API clients: ${reenabled.join(', ')}`);
        } else {
            logger.info('No disabled API clients found to re-enable.');
        }
        return reenabled;
    }

    async getData(displayTitle) {
        const cached = await this.#cache.read(displayTitle);
        if (cached !== null) return cached;

        const status = await this.#client.getStatus();
        if (!status.healthy) {
            const notFound = Title.notFound(displayTitle);
            await this.#cache.write(displayTitle, notFound);
            return notFound;
        }

        const data = await this.#client.fetch(displayTitle);
        if (!data) {
            const notFound = Title.notFound(displayTitle);
            await this.#cache.write(displayTitle, notFound);
            return notFound;
        }

        await this.#cache.write(displayTitle, data);
        logger.info(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}.`);
        return data;
    }
}
