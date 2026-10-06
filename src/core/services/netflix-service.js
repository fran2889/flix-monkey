/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { NetflixSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** Netflix streaming service implementation. */
export class NetflixService extends StreamingService {
    /**
     * @param {import('../config/config-manager.js').ConfigManager} _configManager
     * @returns {boolean}
     */
    isEnabled(_configManager) {
        return _configManager.getBool('enableNetflix');
    }

    /**
     * @returns {string[]}
     */
    get domains() {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    /**
     * @returns {import('../types/services.js').ServiceSurfaceManager}
     */
    get SurfaceManager() {
        return NetflixSurfaceManager;
    }

    /**
     * @returns {import('../types/overlay.js').ServicePresentation}
     */
    get constants() {
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }
}
