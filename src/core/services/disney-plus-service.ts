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
     * Whether Disney+ decoration is enabled in config.
     *
     * @param configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    override isEnabled(configManager: ConfigManager): boolean {
        return configManager.getBool('enableDisneyPlus');
    }

    override get domains(): readonly string[] {
        return Object.freeze(['disneyplus.com']);
    }

    override get SurfaceManager(): ServiceSurfaceManager {
        return DisneyPlusSurfaceManager;
    }
}
