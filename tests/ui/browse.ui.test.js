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
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { initConfig as _initConfig } from '../../src/core/config.js';
import fs from 'fs';
import path from 'path';

describe('Browse UI Surface', () => {
    let surfaceManager, overlayRenderer, _fixtureHtml;

    beforeAll(() => {
        _fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/netflix-browse.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = _fixtureHtml;
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer();
        // Ensure styles are injected for position checks if needed
        overlayRenderer.injectStyles();
    });

    it('should discover title cards on the browse grid', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.length).toBeGreaterThan(0);

        const first = surfaces[0];
        expect(first.title).toBeTruthy();
        expect(first.container).toBeInstanceOf(HTMLElement);
        expect(first.fadeable).toBe(true);
    });

    it('should inject loading and rating overlays correctly', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container, title } = surfaces[0];

        overlayRenderer.injectLoadingOverlay(container, title);
        const loading = container.querySelector('.fm-loading');
        expect(loading).not.toBeNull();
        expect(loading.textContent).toContain('IMDb');
        expect(loading.title).toContain('Fetching ratings');

        const titleObj = {
            rating: 8.5,
            imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        overlayRenderer.injectOverlay(container, titleObj);

        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.classList.contains('fm-loading')).toBe(false);
        expect(overlay.textContent).toContain('8.5');
        expect(overlay.getAttribute('href')).toBe(titleObj.imdbUrl);
    });

    it('should apply fading for low ratings', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container } = surfaces[0];

        // Set threshold high to ensure fading
        _initConfig(key => {
            if (key === 'enableFadeUnderRating') return true;
            if (key === 'fadeRatingThreshold') return 9.0;
            return null;
        });

        overlayRenderer.applyFade(container, { rating: 7.0 }, true);
        expect(container.classList.contains('fm-faded')).toBe(true);

        overlayRenderer.applyFade(container, { rating: 9.5 }, true);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });
});
