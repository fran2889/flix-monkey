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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { ConfigManager } from '../../src/core/config-manager.js';

describe('Overlay UI Interactions', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        OverlayRenderer.resetInternalState();
    });

    it('should inject styles into head', () => {
        const config = new ConfigManager();
        const renderer = new OverlayRenderer(config);
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('.fm-rating-overlay');
    });

    it('should use different corner styles based on config', () => {
        const config = new ConfigManager(key => {
            if (key === 'overlayCorner') return 'bottom-right';
            return undefined;
        });
        const renderer = new OverlayRenderer(config);
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).toContain('bottom:6px;right:6px;');
        expect(style.textContent).toContain('flex-direction: column-reverse');
    });

    it('should respect showRtRating/showMcRating config', () => {
        const config = new ConfigManager(key => {
            if (key === 'showRtRating') return false;
            if (key === 'showMcRating') return false;
            return undefined;
        });
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');
        const titleObj = {
            rating: 7.0,
            rtRating: 90,
            mcRating: 80,
            imdbUrl: 'http://imdb.com',
        };
        renderer.injectOverlay(container, titleObj);

        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay.textContent).toContain('7.0');
        expect(overlay.textContent).not.toContain('RT');
        expect(overlay.textContent).not.toContain('MC');
    });

    it('should build correct tooltip', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        const titleObj = {
            rating: 8.2,
            rtRating: 85,
            imdbUrl: 'http://imdb.com',
            imdbId: 'tt1',
        };
        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay.title).toBe('IMDb: 8.2 · RT: 85% – click to open IMDb');
    });

    it('should apply fade when rating is below threshold', () => {
        const config = new ConfigManager(key => {
            if (key === 'enableFadeUnderRating') return true;
            if (key === 'fadeRatingThreshold') return 7.5;
            return undefined;
        });
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');

        renderer.applyFade(container, { rating: 6.0 }, true);
        expect(container.classList.contains('fm-faded')).toBe(true);
    });

    it('should NOT apply fade when rating is above or equal to threshold', () => {
        const config = new ConfigManager(key => {
            if (key === 'enableFadeUnderRating') return true;
            if (key === 'fadeRatingThreshold') return 7.5;
            return undefined;
        });
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');

        renderer.applyFade(container, { rating: 8.0 }, true);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });

    it('should set correct pointer-events for overlay elements', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        const titleObj = {
            rating: 8.0,
            rtRating: 90,
            imdbUrl: 'http://imdb.com',
        };
        renderer.injectStyles();
        renderer.injectOverlay(container, titleObj);

        const overlay = container.querySelector('.fm-rating-overlay');
        const rtRating = overlay.querySelector('.fm-rt').parentElement;

        // Check styles
        const overlayStyle = getComputedStyle(overlay);
        const rtStyle = getComputedStyle(rtRating);

        expect(overlayStyle.pointerEvents).toBe('none');
        expect(rtStyle.pointerEvents).toBe('auto'); // Children default to 'auto'
        expect(rtStyle.cursor).toBe('default');
    });

    it('should NOT apply fade when disabled in config', () => {
        const config = new ConfigManager(key => {
            if (key === 'enableFadeUnderRating') return false;
            return undefined;
        });
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');

        renderer.applyFade(container, { rating: 5.0 }, true);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });

    it('should NOT apply fade when container is not fadeable', () => {
        const config = new ConfigManager(key => {
            if (key === 'enableFadeUnderRating') return true;
            return undefined;
        });
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');

        renderer.applyFade(container, { rating: 5.0 }, false);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });

    it('should ensure container has non-static position', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        container.style.position = 'static';
        // Note: JSDOM might not support getComputedStyle perfectly for all cases,
        // but it should handle explicit style.position.
        renderer.ensureRelative(container);
        expect(container.style.position).toBe('relative');
    });

    it('should NOT change position if already non-static', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        container.style.position = 'absolute';
        renderer.ensureRelative(container);
        expect(container.style.position).toBe('absolute');
    });

    it('should stop propagation on IMDb link click', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        renderer.injectOverlay(container, { imdbUrl: 'http://imdb.com' });

        const link = container.querySelector('a');
        const event = new MouseEvent('click', { bubbles: true });
        const spy = vi.spyOn(event, 'stopPropagation');

        link.dispatchEvent(event);
        expect(spy).toHaveBeenCalled();
    });

    it('should stop propagation on RT and MC rating clicks', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        const titleObj = {
            rating: 8.5,
            rtRating: 90,
            mcRating: 80,
            imdbUrl: 'http://imdb.com',
            imdbId: 'tt1',
        };
        renderer.injectOverlay(container, titleObj);

        const overlay = container.querySelector('.fm-rating-overlay');
        const rtRatingEl = overlay.querySelector('.fm-rt').parentElement;
        const mcRatingEl = overlay.querySelector('.fm-mc').parentElement;

        [rtRatingEl, mcRatingEl].forEach(el => {
            const event = new MouseEvent('click', { bubbles: true });
            const spy = vi.spyOn(event, 'stopPropagation');
            el.dispatchEvent(event);
            expect(spy).toHaveBeenCalled();
        });
    });

    it('should inject loading overlay', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        renderer.injectLoadingOverlay(container, 'Test Movie');
        const loadingElement = container.querySelector('.fm-loading');
        expect(loadingElement).not.toBeNull();
        expect(loadingElement.textContent).toContain('⏳');
        expect(renderer.isLoading(container)).toBe(true);
    });

    it('should replace loading overlay with ratings overlay', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        renderer.injectLoadingOverlay(container, 'Test Movie');

        const mockTitleObj = {
            rating: 8.5,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        renderer.injectOverlay(container, mockTitleObj);

        expect(container.querySelector('.fm-loading')).toBeNull();
        expect(renderer.isLoading(container)).toBe(false);
        expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
        expect(renderer.hasOverlay(container)).toBe(true);
    });

    it('should display all three ratings when provided', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');

        const mockTitleObj = {
            rating: 8.5,
            rtRating: 90,
            mcRating: 80,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        renderer.injectOverlay(container, mockTitleObj);

        const ratingElement = container.querySelector('.fm-rating-overlay');
        expect(ratingElement.textContent).toContain('8.5');
        expect(ratingElement.textContent).toContain('90%');
        expect(ratingElement.textContent).toContain('80%');

        const labels = ratingElement.querySelectorAll('.fm-label');
        const labelTexts = Array.from(labels).map(l => l.textContent);
        expect(labelTexts).toContain('IMDb ');
        expect(labelTexts).toContain('RT ');
        expect(labelTexts).toContain('MC ');
    });

    it('should show 🔍 when imdbId is missing', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        renderer.injectOverlay(container, { rating: null, imdbId: null });
        expect(container.querySelector('.fm-search')).not.toBeNull();
        expect(container.querySelector('.fm-search').textContent).toBe('🔍');
    });

    it.each([
        ['Normal ratings', { rating: 8.2, rtRating: 85, imdbId: 'tt1' }, 'IMDb: 8.2 · RT: 85% – click to open IMDb'],
        [
            'No ratings but IMDb ID present',
            { rating: null, imdbId: 'tt1' },
            'No ratings available – click to open IMDb',
        ],
        ['Missing IMDb ID', { rating: null, imdbId: null }, 'Not found on IMDb – click to search'],
    ])('should build correct tooltips for %s', (_, titleObj, expectedTitle) => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj);
        expect(container.querySelector('.fm-rating-overlay').title).toBe(expectedTitle);
    });

    it('should show N/A when imdbId is present but rating is missing', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');

        const mockTitleObj = {
            imdbId: 'tt1234567',
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            rating: null,
        };
        renderer.injectOverlay(container, mockTitleObj);

        const ratingElement = container.querySelector('.fm-rating-overlay');
        expect(ratingElement.textContent).toContain('N/A');
        expect(ratingElement.querySelector('.fm-na')).not.toBeNull();
    });
});
