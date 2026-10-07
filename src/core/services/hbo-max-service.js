/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { HboMaxSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** HBO Max streaming service implementation. */
export class HboMaxService extends StreamingService {
    /**
     * Checks whether HBO Max decoration is enabled in configuration.
     *
     * @param {import('../config/config-manager.js').ConfigManager} _configManager - Current application configuration.
     * @returns {boolean} True when `enableHboMax` is set.
     */
    isEnabled(_configManager) {
        return _configManager.getBool('enableHboMax');
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
