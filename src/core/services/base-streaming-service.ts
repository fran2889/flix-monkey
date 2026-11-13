/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { SurfaceDefinition } from '../../types/surfaces';
import type { ConfigManager } from '../config/config-manager';

/**
 * Abstract contract for a supported streaming service. Implementations provide
 * hostname suffixes used by ServiceRegistry; surface definitions; presentation
 * constants; and an enablement predicate backed by ConfigManager.
 */
export abstract class StreamingService {
    /**
     * Whether decoration is enabled for this service.
     *
     * @param configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    abstract isEnabled(configManager: ConfigManager): boolean;

    /**
     * Root domains or exact hostnames without a protocol, port, or path.
     * ServiceRegistry accepts an exact match or a subdomain of an entry.
     *
     * @returns Root domains or exact hostnames.
     */
    abstract get domains(): readonly string[];

    /**
     * Surface definitions used by this service's SurfaceManager.
     *
     * @returns Surface definitions keyed by surface name.
     */
    abstract get surfaceDefinitions(): Readonly<Record<string, SurfaceDefinition>>;

    get constants(): ServicePresentation {
        return Object.freeze({});
    }
}
