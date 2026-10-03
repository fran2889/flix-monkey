/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { DisneyPlusService } from '../../src/core/services/index.js';
import { DisneyPlusSurfaceManager } from '../../src/core/surfaces/index.js';
import fixtures from '../fixtures/disneyplus-surfaces.js';
import { testSurfaceFixtures } from '../helpers/surface-tests.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('Disney+ surfaces', () => {
    let surfaceManager, overlayRenderer;

    beforeEach(() => {
        surfaceManager = new DisneyPlusSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(
            new ConfigManager(createMockAdapter(), createMockLogger()),
            new DisneyPlusService().constants
        );
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all Disney+ surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
