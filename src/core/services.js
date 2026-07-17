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

import { NetflixSurfaceManager } from './surfaces.js';

/**
 * Base class for streaming service implementations.
 */
export class StreamingService {
    get id() {
        throw new Error('Not implemented');
    }

    get domains() {
        throw new Error('Not implemented');
    }

    get SurfaceManager() {
        throw new Error('Not implemented');
    }

    get constants() {
        return Object.freeze({});
    }
}

/**
 * Netflix service implementation.
 */
export class NetflixService extends StreamingService {
    get id() {
        return 'netflix';
    }

    get domains() {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    get SurfaceManager() {
        return NetflixSurfaceManager;
    }

    get constants() {
        return Object.freeze({ TOP_10_BADGE: 'title-card-top-10' });
    }
}

/**
 * Registry of all supported services.
 */
export const SERVICES = Object.freeze({
    netflix: new NetflixService(),
});

/**
 * Service detection utility.
 */
export class ServiceRegistry {
    static detect() {
        const currentHost = window.location.hostname;
        for (const service of Object.values(SERVICES)) {
            if (service.domains.some(d => currentHost === d || currentHost.endsWith(`.${d}`))) {
                return service;
            }
        }
        return null;
    }
}
