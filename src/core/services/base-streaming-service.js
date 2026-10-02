/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @typedef {new (logger: import('../logger.js').Logger) => import('../surfaces/').SurfaceManager} ServiceSurfaceManager */

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
     * @returns {import('../overlay.js').ServicePresentation} Optional presentation values consumed by OverlayRenderer.
     */
    get constants() {
        return Object.freeze({});
    }

    /**
     * @abstract
     * @param {import('../config-manager.js').ConfigManager} configManager - Current application configuration.
     * @returns {boolean} Whether decoration is enabled for this service.
     */
    isEnabled(_configManager) {
        throw new Error('Not implemented');
    }
}
