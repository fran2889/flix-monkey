/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { SurfaceDefinition } from '../../types/surfaces';
import type { ConfigManager } from '../config/config-manager';
import { NETFLIX_SURFACES } from '../surfaces/index';
import { StreamingService } from './base-streaming-service';

/** Netflix streaming service implementation. */
export class NetflixService extends StreamingService {
    override isEnabled(configManager: ConfigManager): boolean {
        return configManager.getBool('enableNetflix');
    }

    override get domains(): readonly string[] {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    override get surfaceDefinitions(): Readonly<Record<string, SurfaceDefinition>> {
        return NETFLIX_SURFACES;
    }

    override get constants(): ServicePresentation {
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }
}
