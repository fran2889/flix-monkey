/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import fs from 'fs';
import path from 'path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { HboMaxService } from '../../src/core/services.js';
import { HboMaxSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('HBO Max search UI surface', () => {
    let fixtureHtml, overlayRenderer, surfaceManager;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/hbomax-search.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new HboMaxSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()), new HboMaxService().constants);
        overlayRenderer.injectStyles();
    });

    it('discovers grid tiles with trailing accessibility metadata and injects overlays', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.map(surface => surface.title)).toEqual([
            'Rooster',
            'Jurassic Sharks',
            'Stuart Fails to Save the Universe',
        ]);

        surfaces.forEach(({ container }) => {
            overlayRenderer.injectOverlay(container, {
                rating: 8.5,
                imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            });
        });
        expect(document.querySelectorAll('.hbo-card > .fm-rating-overlay')).toHaveLength(3);
    });
});
