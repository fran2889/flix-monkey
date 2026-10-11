/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index';
import { OverlayRenderer } from '../../src/core/overlay';
import { NetflixService } from '../../src/core/services/index';
import { NetflixSurfaceManager } from '../../src/core/surfaces/index';
import fixtures from '../fixtures/netflix-surfaces';
import { testSurfaceFixtures } from '../helpers/surface-tests';
import { buildMockAdapter } from '../mocks/adapter';
import { buildLogger } from '../mocks/logger';

describe('Netflix surfaces', () => {
    let surfaceManager: NetflixSurfaceManager;
    let overlayRenderer: OverlayRenderer;

    beforeEach(() => {
        surfaceManager = new NetflixSurfaceManager(buildLogger().build());
        overlayRenderer = new OverlayRenderer(
            new ConfigManager(buildMockAdapter().build(), buildLogger().build()),
            new NetflixService().constants
        );
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all Netflix surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
