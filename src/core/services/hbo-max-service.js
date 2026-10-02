/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { HboMaxSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

export class HboMaxService extends StreamingService {
    // Public methods

    isEnabled(configManager) {
        return configManager.getBool('enableHboMax');
    }

    // Getters ALWAYS at end, regardless of callers

    get id() {
        return 'hbomax';
    }

    get domains() {
        return Object.freeze(['play.hbomax.com']);
    }

    get SurfaceManager() {
        return HboMaxSurfaceManager;
    }

    get constants() {
        return Object.freeze({ TOP_10_SELECTORS: Object.freeze(['.fm-hbo-top-10']), TOP_10_OFFSET: '30%' });
    }
}
