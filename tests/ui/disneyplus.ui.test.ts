/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index';
import { OverlayRenderer } from '../../src/core/overlay';
import { DisneyPlusService } from '../../src/core/services/index';
import { DisneyPlusSurfaceManager } from '../../src/core/surfaces/index';
import fixtures from '../fixtures/disneyplus-surfaces';
import { testSurfaceFixtures } from '../helpers/surface-tests';
import { buildMockAdapter } from '../mocks/adapter';
import { buildLogger } from '../mocks/logger';

describe('Disney+ surfaces', () => {
    let surfaceManager: DisneyPlusSurfaceManager;
    let overlayRenderer: OverlayRenderer;

    beforeEach(() => {
        surfaceManager = new DisneyPlusSurfaceManager(buildLogger().build());
        overlayRenderer = new OverlayRenderer(
            new ConfigManager(buildMockAdapter().build(), buildLogger().build()),
            new DisneyPlusService().constants
        );
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all Disney+ surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
