/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { ServiceSurfaceManager } from '../../types/services';
import type { ConfigManager } from '../config/config-manager';
import { NetflixSurfaceManager } from '../surfaces/index';
import { StreamingService } from './base-streaming-service';

/** Netflix streaming service implementation. */
export class NetflixService extends StreamingService {
    /**
     * @param _configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    override isEnabled(_configManager: ConfigManager): boolean {
        return _configManager.getBool('enableNetflix');
    }

    /**
     * @returns Root domains or exact hostnames without a protocol, port, or path.
     */
    override get domains(): readonly string[] {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    /**
     * @returns Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    override get SurfaceManager(): ServiceSurfaceManager {
        return NetflixSurfaceManager;
    }

    /**
     * @returns Optional presentation values consumed by OverlayRenderer.
     */
    override get constants(): ServicePresentation {
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }
}
