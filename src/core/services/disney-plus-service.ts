/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServiceSurfaceManager } from '../../types/services';
import type { ConfigManager } from '../config/config-manager';
import { DisneyPlusSurfaceManager } from '../surfaces/index';
import { StreamingService } from './base-streaming-service';

/** Disney+ streaming service implementation. */
export class DisneyPlusService extends StreamingService {
    /**
     * @param _configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    isEnabled(_configManager: ConfigManager): boolean {
        return _configManager.getBool('enableDisneyPlus');
    }

    /**
     * @returns Root domains or exact hostnames without a protocol, port, or path.
     */
    get domains(): readonly string[] {
        return Object.freeze(['disneyplus.com']);
    }

    /**
     * @returns Constructor that accepts a Logger and creates this service's SurfaceManager.
     */
    get SurfaceManager(): ServiceSurfaceManager {
        return DisneyPlusSurfaceManager;
    }
}
