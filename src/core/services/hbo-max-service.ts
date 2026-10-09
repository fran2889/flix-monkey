/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { ServiceSurfaceManager } from '../../types/services';
import type { ConfigManager } from '../config/config-manager.js';
import { HboMaxSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** HBO Max streaming service implementation. */
export class HboMaxService extends StreamingService {
    /**
     * @param _configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    isEnabled(_configManager: ConfigManager): boolean {
        return _configManager.getBool('enableHboMax');
    }

    /**
     * @returns Root domains or exact hostnames without a protocol, port, or path.
     */
    get domains(): readonly string[] {
        return Object.freeze(['play.hbomax.com']);
    }

    /**
     * @returns Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    get SurfaceManager(): ServiceSurfaceManager {
        return HboMaxSurfaceManager;
    }

    /**
     * @returns Optional presentation values consumed by OverlayRenderer.
     */
    get constants(): ServicePresentation {
        return Object.freeze({ TOP_10_SELECTORS: Object.freeze(['.fm-hbo-top-10']), TOP_10_OFFSET: '30%' });
    }
}
