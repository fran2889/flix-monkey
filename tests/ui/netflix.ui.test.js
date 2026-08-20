/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach,describe, it } from 'vitest';

import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { NetflixService } from '../../src/core/services.js';
import { NetflixSurfaceManager } from '../../src/core/surfaces.js';
import fixtures from '../fixtures/netflix-surfaces.js';
import { testSurfaceFixtures } from '../helpers/surface-tests.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('Netflix surfaces', () => {
    let surfaceManager, overlayRenderer;

    beforeEach(() => {
        surfaceManager = new NetflixSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()), new NetflixService().constants);
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all Netflix surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
