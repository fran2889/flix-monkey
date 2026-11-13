/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { SurfaceDefinition } from '../../types/surfaces';
import type { ConfigManager } from '../config/config-manager';
import { DISNEY_PLUS_SURFACES } from '../surfaces/index';
import { StreamingService } from './base-streaming-service';

/** Disney+ streaming service implementation. */
export class DisneyPlusService extends StreamingService {
    override isEnabled(configManager: ConfigManager): boolean {
        return configManager.getBool('enableDisneyPlus');
    }

    override get domains(): readonly string[] {
        return Object.freeze(['disneyplus.com']);
    }

    override get surfaceDefinitions(): Readonly<Record<string, SurfaceDefinition>> {
        return DISNEY_PLUS_SURFACES;
    }
}
