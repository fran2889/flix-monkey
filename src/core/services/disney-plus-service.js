/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DisneyPlusSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** Disney+ streaming service implementation. */
export class DisneyPlusService extends StreamingService {
    /**
     * Checks whether Disney+ decoration is enabled in configuration.
     *
     * @param {import('../config/config-manager.js').ConfigManager} _configManager - Current application configuration.
     * @returns {boolean} True when `enableDisneyPlus` is set.
     */
    isEnabled(_configManager) {
        return _configManager.getBool('enableDisneyPlus');
    }

    get domains() {
        return Object.freeze(['disneyplus.com']);
    }

    get SurfaceManager() {
        return DisneyPlusSurfaceManager;
    }
}
