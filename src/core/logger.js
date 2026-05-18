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

export class Logger {
    #prefix = '[FlixMonkey]';
    #config;

    constructor(config) {
        this.#config = config;
    }

    setConfig(config) {
        this.#config = config;
    }

    debug(message, ...args) {
        if (this.#config.get('debug') === true) {
            console.debug(`${this.#prefix} ${message}`, ...args);
        }
    }

    info(message, ...args) {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}

export const logger = new Logger({ get: () => false });
