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
import { ConfigManager } from '../../src/core/config-manager.js';
import { createMockAdapter } from '../mocks/adapter.js';
import fs from 'fs';
import path from 'path';

describe('Browse UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/netflix-browse.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
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

    it('should extract non-empty string titles from each browse card', () => {
        const surfaces = surfaceManager.discover(document.body);
        surfaces.forEach(s => {
            expect(s.title).toBeTruthy();
            expect(typeof s.title).toBe('string');
        });
    });

    it('should inject a loading overlay on a browse card', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container, title } = surfaces[0];

        overlayRenderer.injectLoadingOverlay(container, title);

        const loading = container.querySelector('.fm-loading');
        expect(loading).not.toBeNull();
        expect(loading.textContent).toContain('IMDb');
        expect(loading.title).toContain('Fetching ratings');
    });

    it('should replace loading overlay with rating overlay on a browse card', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container, title } = surfaces[0];

        overlayRenderer.injectLoadingOverlay(container, title);

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
        const link = overlay.querySelector('a');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe(titleObj.imdbUrl);
    });

    it('should apply fading for low ratings below threshold', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container } = surfaces[0];

        const mockConfig = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return true;
                    if (key === 'fadeRatingThreshold') return 9.0;
                    return null;
                },
            })
        );
        new OverlayRenderer(mockConfig).applyFade(container, { rating: 7.0 }, true);
        expect(container.classList.contains('fm-faded')).toBe(true);
    });

    it('should NOT apply fading for ratings at or above threshold', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container } = surfaces[0];

        const mockConfig = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return true;
                    if (key === 'fadeRatingThreshold') return 9.0;
                    return null;
                },
            })
        );
        new OverlayRenderer(mockConfig).applyFade(container, { rating: 9.5 }, true);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });
});
