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
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
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

    it('should inject loading and rating overlays on a browse card', () => {
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

describe('Overlay Renderer', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('should inject styles into head', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('.fm-rating-overlay');
    });

    it('should use different corner styles based on config', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'overlayCorner') return 'bottom-right';
                    return undefined;
                },
            })
        );
        const renderer = new OverlayRenderer(config);
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).toContain('bottom:6px;right:6px;');
        expect(style.textContent).toContain('flex-direction: column-reverse');
    });

    it('should respect showRtRating/showMcRating config', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'showRtRating') return false;
                    if (key === 'showMcRating') return false;
                    return undefined;
                },
            })
        );
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');
        renderer.injectOverlay(container, { rating: 7.0, rtRating: 90, mcRating: 80, imdbUrl: 'http://imdb.com' });

        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay.textContent).toContain('7.0');
        expect(overlay.textContent).not.toContain('RT');
        expect(overlay.textContent).not.toContain('MC');
    });

    it('should build correct tooltip', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, { rating: 8.2, rtRating: 85, imdbUrl: 'http://imdb.com', imdbId: 'tt1' });
        expect(container.querySelector('.fm-rating-overlay').title).toBe('IMDb: 8.2 · RT: 85% – click to open IMDb');
    });

    it('should NOT apply fade when disabled in config', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return false;
                    return undefined;
                },
            })
        );
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');
        renderer.applyFade(container, { rating: 5.0 }, true);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });

    it('should NOT apply fade when container is not fadeable', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return true;
                    return undefined;
                },
            })
        );
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');
        renderer.applyFade(container, { rating: 5.0 }, false);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });

    it('should set correct pointer-events for overlay elements', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectStyles();
        renderer.injectOverlay(container, { rating: 8.0, rtRating: 90, imdbUrl: 'http://imdb.com' });

        const overlay = container.querySelector('.fm-rating-overlay');
        const rtRating = overlay.querySelector('.fm-rt').parentElement;
        expect(getComputedStyle(overlay).pointerEvents).toBe('none');
        expect(getComputedStyle(rtRating).pointerEvents).toBe('auto');
        expect(getComputedStyle(rtRating).cursor).toBe('default');
    });

    it('should ensure container has non-static position', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        container.style.position = 'static';
        renderer.ensureRelative(container);
        expect(container.style.position).toBe('relative');
    });

    it('should NOT change position if already non-static', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        container.style.position = 'absolute';
        renderer.ensureRelative(container);
        expect(container.style.position).toBe('absolute');
    });

    it('should stop propagation on IMDb link click', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, { imdbUrl: 'http://imdb.com' });

        const link = container.querySelector('a');
        const event = new MouseEvent('click', { bubbles: true });
        const spy = vi.spyOn(event, 'stopPropagation');
        link.dispatchEvent(event);
        expect(spy).toHaveBeenCalled();
    });

    it('should stop propagation on MC and RT rating clicks', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, {
            rating: 8.5,
            rtRating: 90,
            mcRating: 80,
            imdbUrl: 'http://imdb.com',
            imdbId: 'tt1',
        });

        const overlay = container.querySelector('.fm-rating-overlay');
        [overlay.querySelector('.fm-rt').parentElement, overlay.querySelector('.fm-mc').parentElement].forEach(el => {
            const event = new MouseEvent('click', { bubbles: true });
            const spy = vi.spyOn(event, 'stopPropagation');
            el.dispatchEvent(event);
            expect(spy).toHaveBeenCalled();
        });
    });

    it('should inject loading overlay', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectLoadingOverlay(container, 'Test Movie');
        const loadingElement = container.querySelector('.fm-loading');
        expect(loadingElement).not.toBeNull();
        expect(loadingElement.textContent).toContain('⏳');
        expect(renderer.isLoading(container)).toBe(true);
    });

    it('should replace loading overlay with ratings overlay', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectLoadingOverlay(container, 'Test Movie');
        renderer.injectOverlay(container, {
            rating: 8.5,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        });

        expect(container.querySelector('.fm-loading')).toBeNull();
        expect(renderer.isLoading(container)).toBe(false);
        expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
        expect(renderer.hasOverlay(container)).toBe(true);
    });

    it('should display all three ratings when provided', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, {
            rating: 8.5,
            rtRating: 90,
            mcRating: 80,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        });

        const ratingElement = container.querySelector('.fm-rating-overlay');
        expect(ratingElement.textContent).toContain('8.5');
        expect(ratingElement.textContent).toContain('90%');
        expect(ratingElement.textContent).toContain('80%');

        const labelTexts = Array.from(ratingElement.querySelectorAll('.fm-label')).map(l => l.textContent);
        expect(labelTexts).toContain('IMDb ');
        expect(labelTexts).toContain('RT ');
        expect(labelTexts).toContain('MC ');
    });

    it('should show 🔍 when imdbId is missing', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, { rating: null, imdbId: null });
        expect(container.querySelector('.fm-search')).not.toBeNull();
        expect(container.querySelector('.fm-search').textContent).toBe('🔍');
    });

    it('should show N/A when imdbId is present but rating is missing', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, {
            imdbId: 'tt1234567',
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            rating: null,
        });

        const ratingElement = container.querySelector('.fm-rating-overlay');
        expect(ratingElement.textContent).toContain('N/A');
        expect(ratingElement.querySelector('.fm-na')).not.toBeNull();
    });

    it.each([
        ['normal ratings', { rating: 8.2, rtRating: 85, imdbId: 'tt1' }, 'IMDb: 8.2 · RT: 85% – click to open IMDb'],
        [
            'no ratings but IMDb ID present',
            { rating: null, imdbId: 'tt1' },
            'No ratings available – click to open IMDb',
        ],
        ['missing IMDb ID', { rating: null, imdbId: null }, 'Not found on IMDb – click to search'],
    ])('should build correct tooltips for %s', (_, titleObj, expectedTitle) => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj);
        expect(container.querySelector('.fm-rating-overlay').title).toBe(expectedTitle);
    });
});
