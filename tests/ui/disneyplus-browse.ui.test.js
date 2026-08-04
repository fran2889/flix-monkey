/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
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
        expect(surfaces.map(surface => surface.title)).toEqual(['Avatar: Fire and Ash', 'Loki', 'Moana']);
        expect(surfaces.every(({ container }) => container.matches('[data-testid="set-shelf-item"]'))).toBe(true);
        expect(surfaces.every(({ fadeable, showFadeToggle }) => fadeable && !showFadeToggle)).toBe(true);

        surfaces.forEach(({ container }) => {
            overlayRenderer.injectOverlay(container, {
                rating: 8.5,
                imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            });
        });

        expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(3);
        expect(document.querySelectorAll('[data-testid="set-shelf-item"] > .fm-rating-overlay')).toHaveLength(3);
        expect(document.querySelectorAll('a a')).toHaveLength(0);
    });
});
