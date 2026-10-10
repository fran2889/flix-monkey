/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index';
import { OverlayRenderer } from '../../src/core/overlay';
import { HboMaxService } from '../../src/core/services/index';
import { HboMaxSurfaceManager } from '../../src/core/surfaces/index';
import fixtures from '../fixtures/hbomax-surfaces';
import { testSurfaceFixtures } from '../helpers/surface-tests';
import { buildMockAdapter } from '../mocks/adapter';
import { buildLogger } from '../mocks/logger';

describe('HBO Max surfaces', () => {
    let surfaceManager: HboMaxSurfaceManager;
    let overlayRenderer: OverlayRenderer;

    beforeEach(() => {
        surfaceManager = new HboMaxSurfaceManager(buildLogger().build());
        overlayRenderer = new OverlayRenderer(
            new ConfigManager(buildMockAdapter().build(), buildLogger().build()),
            new HboMaxService().constants
        );
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all HBO Max surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
