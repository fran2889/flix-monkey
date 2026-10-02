/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { NetflixSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

export class NetflixService extends StreamingService {
    isEnabled(configManager) {
        return configManager.getBool('enableNetflix');
    }

    get id() {
        return 'netflix';
    }

    get domains() {
        return Object.freeze(['netflix.com', 'www.netflix.com']);
    }

    get SurfaceManager() {
        return NetflixSurfaceManager;
    }

    /**
     * @returns {import('../overlay.js').ServicePresentation}
     */
    get constants() {
        return Object.freeze({
            TOP_10_SELECTORS: Object.freeze(['.title-card-top-10', '[data-uia="ranked-card"]']),
        });
    }
}
