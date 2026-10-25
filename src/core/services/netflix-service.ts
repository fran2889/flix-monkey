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
     * Whether Netflix decoration is enabled in config.
     *
     * @param configManager - Current application configuration.
     * @returns Whether decoration is enabled for this service.
     */
    override isEnabled(configManager: ConfigManager): boolean {
        return configManager.getBool('enableNetflix');
    }

    override get domains(): readonly string[] {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    override get SurfaceManager(): ServiceSurfaceManager {
        return NetflixSurfaceManager;
    }

    override get constants(): ServicePresentation {
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }
}
