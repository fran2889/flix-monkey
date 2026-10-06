/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DisneyPlusSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** Disney+ streaming service implementation. */
export class DisneyPlusService extends StreamingService {
    /**
     * @param {import('../config/config-manager.js').ConfigManager} _configManager
     * @returns {boolean}
     */
    isEnabled(_configManager) {
        return _configManager.getBool('enableDisneyPlus');
    }

    /**
     * @returns {readonly string[]}
     */
    get domains() {
        return Object.freeze(['disneyplus.com']);
    }

    /**
     * @returns {import('../types/services.js').ServiceSurfaceManager}
     */
    get SurfaceManager() {
        return DisneyPlusSurfaceManager;
    }
}
