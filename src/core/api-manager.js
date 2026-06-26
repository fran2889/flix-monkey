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
import { Title } from './title.js';

export class ApiClientManager {
    #cache;
    #client;
    #disabledManager;
    #logger;

    constructor(cache, disabledManager, client, logger) {
        this.#cache = cache;
        this.#disabledManager = disabledManager;
        this.#client = client;
        this.#logger = logger;
    }

    getClient() {
        return this.#client;
    }

    async resetDisabledClients() {
        const reenabled = await this.#disabledManager.resetAll();
        if (reenabled.length > 0) {
            this.#logger.info(`Re-enabled API clients: ${reenabled.join(', ')}`);
        } else {
            this.#logger.info('No disabled API clients found to re-enable');
        }
        return reenabled;
    }

    async getData(displayTitle) {
        const source = this.#client.source;
        const cached = await this.#cache.read(displayTitle, source);
        if (cached !== null) return cached;

        const status = await this.#client.getStatus();
        if (!status.healthy) {
            return Title.notFound(displayTitle, source);
        }

        try {
            const data = await this.#client.fetch(displayTitle);
            if (!data) {
                const notFound = Title.notFound(displayTitle, source);
                await this.#cache.write(displayTitle, notFound);
                return notFound;
            }
            await this.#cache.write(displayTitle, data);
            this.#logger.debug(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}`);
            return data;
        } catch (err) {
            const isHttpError = Number.isInteger(err.status) && err.status >= 400;
            if (isHttpError && err.status < 500) {
                await this.#client.disable();
            }
            this.#logger[isHttpError ? 'error' : 'warn'](
                `Failed to fetch ratings for "${displayTitle}": ${err.message}`,
                { url: err.url ?? null, status: err.status ?? null, body: err.body ?? null }
            );
            return Title.notFound(displayTitle, source);
        }
    }
}
