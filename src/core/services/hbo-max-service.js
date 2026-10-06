/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { HboMaxSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** HBO Max streaming service implementation. */
export class HboMaxService extends StreamingService {
    /**
     * @param {import('../config/config-manager.js').ConfigManager} _configManager
     * @returns {boolean}
     */
    isEnabled(_configManager) {
        return _configManager.getBool('enableHboMax');
    }

    /**
     * @returns {readonly string[]}
     */
    get domains() {
        return Object.freeze(['play.hbomax.com']);
    }

    /**
     * @returns {import('../types/services.js').ServiceSurfaceManager}
     */
    get SurfaceManager() {
        return HboMaxSurfaceManager;
    }

    /**
     * @returns {import('../types/overlay.js').ServicePresentation}
     */
    get constants() {
        return Object.freeze({ TOP_10_SELECTORS: Object.freeze(['.fm-hbo-top-10']), TOP_10_OFFSET: '30%' });
    }
}
