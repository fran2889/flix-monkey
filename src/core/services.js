/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { DisneyPlusSurfaceManager, HboMaxSurfaceManager, NetflixSurfaceManager } from './surfaces.js';

/** @typedef {new (logger: import('./logger.js').Logger) => import('./surfaces.js').SurfaceManager} ServiceSurfaceManager */

/**
 * Abstract contract for a supported streaming service. Implementations provide
 * a stable, unique, lowercase service ID; hostname suffixes used by
 * ServiceRegistry; a surface-manager constructor; presentation constants; and
 * an enablement predicate backed by ConfigManager.
 *
 * @abstract
 */
export class StreamingService {
    /**
     * @abstract
     * @returns {string} Stable, unique, lowercase service identifier used for service-specific configuration.
     */
    get id() {
        throw new Error('Not implemented');
    }

    /**
     * @abstract
     * @returns {ReadonlyArray<string>} Root domains or exact hostnames without a protocol, port, or path. ServiceRegistry accepts an exact match or a subdomain of an entry.
     */
    get domains() {
        throw new Error('Not implemented');
    }

    /**
     * @abstract
     * @returns {ServiceSurfaceManager} Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    get SurfaceManager() {
        throw new Error('Not implemented');
    }

    /**
     * @returns {import('./overlay.js').ServicePresentation} Optional presentation values consumed by OverlayRenderer.
     */
    get constants() {
        return Object.freeze({});
    }

    /**
     * @abstract
     * @param {import('./config-manager.js').ConfigManager} configManager - Current application configuration.
     * @returns {boolean} Whether decoration is enabled for this service.
     */
    isEnabled(_configManager) {
        throw new Error('Not implemented');
    }
}

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

export const SERVICES = Object.freeze({
    netflix: new NetflixService(),
    hbomax: new HboMaxService(),
    disneyplus: new DisneyPlusService(),
});

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
