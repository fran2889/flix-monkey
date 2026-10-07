/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Abstract contract for a supported streaming service. Implementations provide
 * hostname suffixes used by ServiceRegistry; a surface-manager constructor;
 * presentation constants; and an enablement predicate backed by
 * ConfigManager.
 *
 * @abstract
 */
export class StreamingService {
    /**
     * ServiceRegistry matches the page hostname against these entries, accepting
     * an exact match or a subdomain of any entry.
     *
     * @abstract
     * @returns {string[]} Root domains or exact hostnames, without a protocol, port, or path.
     */
    get domains() {
        throw new Error('Not implemented');
    }

    /**
     * Subclasses return their own SurfaceManager constructor.
     *
     * @abstract
     * @returns {import('../../types/services.js').ServiceSurfaceManager} Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    get SurfaceManager() {
        throw new Error('Not implemented');
    }

    /**
     * Defaults to no overrides; subclasses may supply presentation constants.
     *
     * @returns {import('../../types/overlay.js').ServicePresentation} Optional presentation values consumed by OverlayRenderer.
     */
    get constants() {
        return Object.freeze({});
    }

    /**
     * Checks whether decoration is enabled for this service.
     *
     * @abstract
     * @param {import('../config/config-manager.js').ConfigManager} _configManager - Current application configuration.
     * @returns {boolean} Whether decoration is enabled for this service.
     */
    isEnabled(_configManager) {
        throw new Error('Not implemented');
    }
}
