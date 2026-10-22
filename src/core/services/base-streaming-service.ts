/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { ServiceSurfaceManager } from '../../types/services';
import type { ConfigManager } from '../config/config-manager';

/**
 * Abstract contract for a supported streaming service. Implementations provide
 * hostname suffixes used by ServiceRegistry; a surface-manager constructor;
 * presentation constants; and an enablement predicate backed by
 * ConfigManager.
 */
export abstract class StreamingService {
    /**
     * @returns Root domains or exact hostnames without a protocol, port, or path. ServiceRegistry accepts an exact match or a subdomain of an entry.
     */
    abstract get domains(): readonly string[];

    /**
     * @returns Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    abstract get SurfaceManager(): ServiceSurfaceManager;

    /**
     * @returns Optional presentation values consumed by OverlayRenderer.
     */
    get constants(): ServicePresentation {
        return Object.freeze({});
    }

    /**
     * @param configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    abstract isEnabled(configManager: ConfigManager): boolean;
}
