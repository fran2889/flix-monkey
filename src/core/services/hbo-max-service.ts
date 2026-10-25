/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { ServiceSurfaceManager } from '../../types/services';
import type { ConfigManager } from '../config/config-manager';
import { HboMaxSurfaceManager } from '../surfaces/index';
import { StreamingService } from './base-streaming-service';

/** HBO Max streaming service implementation. */
export class HboMaxService extends StreamingService {
    /**
     * Whether HBO Max decoration is enabled in config.
     *
     * @param configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    override isEnabled(configManager: ConfigManager): boolean {
        return configManager.getBool('enableHboMax');
    }

    override get domains(): readonly string[] {
        return Object.freeze(['play.hbomax.com']);
    }

    override get SurfaceManager(): ServiceSurfaceManager {
        return HboMaxSurfaceManager;
    }

    override get constants(): ServicePresentation {
        return Object.freeze({ TOP_10_SELECTORS: Object.freeze(['.fm-hbo-top-10']), TOP_10_OFFSET: '30%' });
    }
}
