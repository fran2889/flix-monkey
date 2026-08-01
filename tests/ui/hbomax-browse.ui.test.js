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
import { HboMaxService } from '../../src/core/services.js';
import { HboMaxSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('HBO Max browse UI surface', () => {
    let fixtureHtml, overlayRenderer, surfaceManager;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/hbomax-browse.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new HboMaxSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()), new HboMaxService().constants);
        overlayRenderer.injectStyles();
    });

    it('discovers supported browse tiles and injects overlays', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.map(surface => surface.title)).toEqual([
            'Movie Title',
            'Show Title',
            'Mini Series Title',
            'Continue Watching Show',
            'Search Grid Show',
            'Top Ten Movie',
        ]);
        expect(surfaces.every(({ container }) => container.matches('.hbo-card'))).toBe(true);

        surfaces.forEach(({ container }) => {
            overlayRenderer.injectOverlay(container, {
                rating: 8.5,
                imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            });
        });
        expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(6);
        expect(document.querySelectorAll('.hbo-card > .fm-rating-overlay')).toHaveLength(6);
        expect(document.querySelectorAll('a a')).toHaveLength(0);
        const imdbLinks = document.querySelectorAll('.fm-rating-overlay > a');
        expect(imdbLinks).toHaveLength(6);
        imdbLinks.forEach(link => {
            expect(link.href).toBe('https://www.imdb.com/title/tt1234567/');
        });
        expect(document.querySelector('[data-testid="top-ten_tile"]').parentElement).toHaveClass('fm-hbo-top-10');
    });
});
