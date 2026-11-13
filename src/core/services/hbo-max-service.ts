/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ServicePresentation } from '../../types/overlay';
import type { SurfaceDefinition } from '../../types/surfaces';
import type { ConfigManager } from '../config/config-manager';
import { HBO_MAX_SURFACES } from '../surfaces/index';
import { StreamingService } from './base-streaming-service';

/** HBO Max streaming service implementation. */
export class HboMaxService extends StreamingService {
    override isEnabled(configManager: ConfigManager): boolean {
        return configManager.getBool('enableHboMax');
    }

    override get domains(): readonly string[] {
        return Object.freeze(['hbomax.com']);
    }

    override get surfaceDefinitions(): Record<string, SurfaceDefinition> {
        return HBO_MAX_SURFACES;
    }

    override get constants(): ServicePresentation {
        return Object.freeze({ TOP_10_SELECTORS: Object.freeze(['.fm-hbo-top-10']), TOP_10_OFFSET: '30%' });
    }
}
