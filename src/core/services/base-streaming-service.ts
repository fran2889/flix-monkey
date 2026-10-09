/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { ServiceSurfaceManager } from '../../types/services';
import type { ConfigManager } from '../config/config-manager.js';

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
     * @abstract
     * @returns Root domains or exact hostnames without a protocol, port, or path. ServiceRegistry accepts an exact match or a subdomain of an entry.
     */
    get domains(): readonly string[] {
        throw new Error('Not implemented');
    }

    /**
     * @abstract
     * @returns Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    get SurfaceManager(): ServiceSurfaceManager {
        throw new Error('Not implemented');
    }

    /**
     * @returns Optional presentation values consumed by OverlayRenderer.
     */
    get constants(): ServicePresentation {
        return Object.freeze({});
    }

    /**
     * @abstract
     * @param _configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    isEnabled(_configManager: ConfigManager): boolean {
        throw new Error('Not implemented');
    }
}
