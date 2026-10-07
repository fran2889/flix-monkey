/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { NetflixSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

/** Netflix streaming service implementation. */
export class NetflixService extends StreamingService {
    /**
     * Checks whether Netflix decoration is enabled in configuration.
     *
     * @param {import('../config/config-manager.js').ConfigManager} _configManager - Current application configuration.
     * @returns {boolean} True when `enableNetflix` is set.
     */
    isEnabled(_configManager) {
        return _configManager.getBool('enableNetflix');
    }

    get domains() {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    get SurfaceManager() {
        return NetflixSurfaceManager;
    }

    get constants() {
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }
}
