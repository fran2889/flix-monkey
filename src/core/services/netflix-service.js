/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { NetflixSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

export class NetflixService extends StreamingService {
    // Public methods

    isEnabled(configManager) {
        return configManager.getBool('enableNetflix');
    }

    // Getters ALWAYS at end, regardless of callers

    get id() {
        return 'netflix';
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
