/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import fs from 'fs';
import path from 'path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { DisneyPlusService } from '../../src/core/services.js';
import { DisneyPlusSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('Disney+ browse UI surface', () => {
    let fixtureHtml, overlayRenderer, surfaceManager;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/disneyplus-browse.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new DisneyPlusSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(
            new ConfigManager(createMockAdapter()),
            new DisneyPlusService().constants
        );
        overlayRenderer.injectStyles();
    });

    it('discovers supported Disney+ cards and injects parent overlays', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.map(surface => surface.title)).toEqual([
            'Avatar: Fire and Ash',
            'Loki',
            'Moana',
            'How I Met Your Mother',
        ]);
        expect(surfaces.every(({ container }) => container.matches('[data-testid="set-shelf-item"]'))).toBe(true);
        expect(surfaces.every(({ fadeable, showFadeToggle }) => fadeable && !showFadeToggle)).toBe(true);

        surfaces.forEach(({ container }) => {
            overlayRenderer.injectOverlay(container, {
                rating: 8.5,
                imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            });
        });

        expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(4);
        expect(document.querySelectorAll('[data-testid="set-shelf-item"] > .fm-rating-overlay')).toHaveLength(4);
        expect(document.querySelectorAll('a a')).toHaveLength(0);
    });
});
