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
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { TOP_10_BADGE } from '../../../src/core/constants.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { Title } from '../../../src/core/title.js';

describe('OverlayRenderer', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    describe('Style injection', () => {
        it('should inject styles into document head', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style).not.toBeNull();
            expect(style.textContent).toContain('.fm-rating-overlay');
        });

        it('should inject styles only once per instance', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            renderer.injectStyles();
            renderer.injectStyles();
            const styles = document.head.querySelectorAll('style');
            expect(styles).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles')).not.toBeNull();
        });

        it('should update the existing style tag when injectStyles is called again', () => {
            const configLeft = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-left' : undefined) })
            );
            const configRight = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-right' : undefined) })
            );
            const rendererA = new OverlayRenderer(configLeft);
            const rendererB = new OverlayRenderer(configRight);

            rendererA.injectStyles();
            expect(document.head.querySelectorAll('style')).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('left:6px');

            rendererB.injectStyles();
            expect(document.head.querySelectorAll('style')).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('right:6px');
        });

        it('should use bottom positioning for bottom-side corners', () => {
            const config = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'bottom-right' : undefined) })
            );
            const renderer = new OverlayRenderer(config);
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).toContain('bottom:6px;right:6px;');
            expect(style.textContent).toContain('flex-direction: column-reverse');
        });

        it('should use TOP_10_BADGE constant in injected CSS', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
        });

        it('should include TOP_10_BADGE offset rule for left-side corners', () => {
            const config = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-left' : undefined) })
            );
            const renderer = new OverlayRenderer(config);
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
        });

        it('should not include TOP_10_BADGE offset rule for right-side corners', () => {
            const config = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-right' : undefined) })
            );
            const renderer = new OverlayRenderer(config);
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).not.toContain(`.${TOP_10_BADGE}`);
        });
    });

    describe('Overlay injection', () => {
        it('should render an IMDb badge for a zero rating', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ imdbId: 'tt1234567', rating: 0 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            expect(overlay).not.toBeNull();
            expect(overlay.querySelector('.fm-value')).not.toBeNull();
            expect(overlay.textContent).toContain('0.0');
        });

        it('should render RT and MC badges for zero percent ratings', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'showRtRating') return true;
                        if (key === 'showMcRating') return true;
                        return undefined;
                    },
                })
            );
            const renderer = new OverlayRenderer(config);
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ imdbId: 'tt1234567', rating: 5, rtRating: 0, mcRating: 0 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            expect(overlay).not.toBeNull();
            const percentBadges = [...overlay.querySelectorAll('.fm-value')].filter(el => el.textContent === '0%');
            expect(percentBadges.length).toBe(2);
        });

        it('should respect showRtRating and showMcRating config', () => {
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

        it('should show the search icon when imdbId is missing', () => {
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
            [
                'normal ratings',
                { rating: 8.2, rtRating: 85, imdbId: 'tt1' },
                'IMDb: 8.2 · RT: 85% – click to open IMDb',
            ],
            [
                'no ratings but IMDb ID present',
                { rating: null, imdbId: 'tt1' },
                'No ratings available – click to open IMDb',
            ],
            ['missing IMDb ID', { rating: null, imdbId: null }, 'Not found on IMDb – click to search'],
        ])('should build correct tooltip for %s', (_, titleObj, expectedTitle) => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj);
            expect(container.querySelector('.fm-rating-overlay').title).toBe(expectedTitle);
        });
    });

    describe('Loading overlay', () => {
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
    });

    describe('Fade', () => {
        it('should not apply fade when disabled in config', () => {
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

        it('should not apply fade when container is not fadeable', () => {
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
    });

    describe('Container positioning', () => {
        it('should ensure container has non-static position', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            const container = document.createElement('div');
            container.style.position = 'static';
            renderer.ensureRelative(container);
            expect(container.style.position).toBe('relative');
        });

        it('should not change position if already non-static', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            const container = document.createElement('div');
            container.style.position = 'absolute';
            renderer.ensureRelative(container);
            expect(container.style.position).toBe('absolute');
        });
    });

    describe('Pointer events and click propagation', () => {
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
            [overlay.querySelector('.fm-rt').parentElement, overlay.querySelector('.fm-mc').parentElement].forEach(
                el => {
                    const event = new MouseEvent('click', { bubbles: true });
                    const spy = vi.spyOn(event, 'stopPropagation');
                    el.dispatchEvent(event);
                    expect(spy).toHaveBeenCalled();
                }
            );
        });
    });

    describe('Clear overlays', () => {
        it('should remove all overlay elements from the document', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            document.body.innerHTML =
                '<div class="fm-rating-overlay"></div>' +
                '<div class="fm-rating-overlay"></div>' +
                '<div class="other"></div>';
            renderer.clearAllOverlays();
            expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(0);
            expect(document.querySelectorAll('.other')).toHaveLength(1);
        });

        it('should remove data-fm-injected attribute from parent when clearing overlays', () => {
            const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', rating: 7.5 });
            renderer.injectOverlay(container, title);
            expect(renderer.hasOverlay(container)).toBe(true);
            renderer.clearAllOverlays();
            expect(renderer.hasOverlay(container)).toBe(false);
        });
    });
});
