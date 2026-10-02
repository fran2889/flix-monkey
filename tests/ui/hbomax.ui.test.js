/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, it } from 'vitest';

import { HboMaxSurfaceManager } from '../../../src/core/surfaces/';
import { ConfigManager } from '../../src/core/config/';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { HboMaxService } from '../../src/core/services/';
import fixtures from '../fixtures/hbomax-surfaces.js';
import { testSurfaceFixtures } from '../helpers/surface-tests.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('HBO Max surfaces', () => {
    let surfaceManager, overlayRenderer;

    beforeEach(() => {
        surfaceManager = new HboMaxSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()), new HboMaxService().constants);
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all HBO Max surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
