/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DisneyPlusSurfaceManager } from '../surfaces/index.js';
import { StreamingService } from './base-streaming-service.js';

export class DisneyPlusService extends StreamingService {
    isEnabled(configManager) {
        return configManager.getBool('enableDisneyPlus');
    }

    get id() {
        return 'disneyplus';
    }

    get domains() {
        return Object.freeze(['disneyplus.com']);
    }

    get SurfaceManager() {
        return DisneyPlusSurfaceManager;
    }
}
