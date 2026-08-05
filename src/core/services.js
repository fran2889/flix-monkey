/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { DisneyPlusSurfaceManager, HboMaxSurfaceManager, NetflixSurfaceManager } from './surfaces.js';

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

    isEnabled(_configManager) {
        throw new Error('Not implemented');
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
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }

    isEnabled(configManager) {
        return configManager.getBool('enableNetflix');
    }
}

/**
 * HBO Max service implementation.
 */
export class HboMaxService extends StreamingService {
    get id() {
        return 'hbomax';
    }

    get domains() {
        return Object.freeze(['play.hbomax.com']);
    }

    get SurfaceManager() {
        return HboMaxSurfaceManager;
    }

    get constants() {
        return Object.freeze({ TOP_10_SELECTORS: Object.freeze(['.fm-hbo-top-10']), TOP_10_OFFSET: '30%' });
    }

    isEnabled(configManager) {
        return configManager.getBool('enableHboMax');
    }
}

/**
 * Disney+ service implementation.
 */
export class DisneyPlusService extends StreamingService {
    get id() {
        return 'disneyplus';
    }

    get domains() {
        return Object.freeze(['disneyplus.com']);
    }

    get SurfaceManager() {
        return DisneyPlusSurfaceManager;
    }

    isEnabled(configManager) {
        return configManager.getBool('enableDisneyPlus');
    }
}

/**
 * Registry of all supported services.
 */
export const SERVICES = Object.freeze({
    netflix: new NetflixService(),
    hbomax: new HboMaxService(),
    disneyplus: new DisneyPlusService(),
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
