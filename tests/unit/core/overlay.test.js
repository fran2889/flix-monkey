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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TOP_10_BADGE } from '../../../src/core/constants.js';
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { Title } from '../../../src/core/title.js';
import { createConfig } from '../../mocks/config.js';

describe('OverlayRenderer', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    describe('Style injection', () => {
        it('should inject styles into document head', () => {
            const renderer = new OverlayRenderer(createConfig());
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style).not.toBeNull();
            expect(style.textContent).toContain('.fm-rating-overlay');
        });

        it('should inject styles only once per instance', () => {
            const renderer = new OverlayRenderer(createConfig());
            renderer.injectStyles();
            renderer.injectStyles();
            const styles = document.head.querySelectorAll('style');
            expect(styles).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles')).not.toBeNull();
        });

        it('should update the existing style tag when injectStyles is called again', () => {
            const rendererA = new OverlayRenderer(createConfig({ overlayCorner: 'top-left' }));
            const rendererB = new OverlayRenderer(createConfig({ overlayCorner: 'top-right' }));

            rendererA.injectStyles();
            expect(document.head.querySelectorAll('style')).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('left:6px');

            rendererB.injectStyles();
            expect(document.head.querySelectorAll('style')).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('right:6px');
        });

        it('should use bottom positioning for bottom-side corners', () => {
            const renderer = new OverlayRenderer(createConfig({ overlayCorner: 'bottom-right' }));
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).toContain('bottom:6px;right:6px;');
            expect(style.textContent).toContain('flex-direction: column-reverse');
        });

        it('should use TOP_10_BADGE constant in injected CSS', () => {
            const renderer = new OverlayRenderer(createConfig({ overlayCorner: 'top-left' }));
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
        });

        it('should include TOP_10_BADGE offset rule for left-side corners', () => {
            const renderer = new OverlayRenderer(createConfig({ overlayCorner: 'top-left' }));
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
        });

        it('should not include TOP_10_BADGE offset rule for right-side corners', () => {
            const renderer = new OverlayRenderer(createConfig({ overlayCorner: 'top-right' }));
            renderer.injectStyles();
            const style = document.head.querySelector('style');
            expect(style.textContent).not.toContain(`.${TOP_10_BADGE}`);
        });
    });

    describe('Overlay injection', () => {
        it('should render an IMDb badge for a zero rating', () => {
            const renderer = new OverlayRenderer(createConfig());
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
            const renderer = new OverlayRenderer(createConfig({ showRtRating: true, showMcRating: true }));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ imdbId: 'tt1234567', rating: 5, rtRating: 0, mcRating: 0 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            expect(overlay).not.toBeNull();
            const percentBadges = [...overlay.querySelectorAll('.fm-value')].filter(el => el.textContent === '0%');
            expect(percentBadges.length).toBe(2);
        });

        it('should not render RT and MC badges when disabled by config', () => {
            const renderer = new OverlayRenderer(createConfig({ showRtRating: false, showMcRating: false }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, { rating: 7.0, rtRating: 90, mcRating: 80, imdbUrl: 'http://imdb.com' });

            const overlay = container.querySelector('.fm-rating-overlay');
            expect(overlay.textContent).toContain('7.0');
            expect(overlay.textContent).not.toContain('RT');
            expect(overlay.textContent).not.toContain('MC');
        });

        it('should display all three ratings when provided and enabled', () => {
            const renderer = new OverlayRenderer(createConfig({ showRtRating: true, showMcRating: true }));
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
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            renderer.injectOverlay(container, { rating: null, imdbId: null });
            expect(container.querySelector('.fm-search')).not.toBeNull();
            expect(container.querySelector('.fm-search').textContent).toBe('🔍');
        });

        it('should show N/A when imdbId is present but rating is missing', () => {
            const renderer = new OverlayRenderer(createConfig());
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
            ['normal ratings', { rating: 8.2, rtRating: 85, imdbId: 'tt1' }, 'IMDb: 8.2 - Open IMDb', true],
            ['no ratings but IMDb ID present', { rating: null, imdbId: 'tt1' }, 'No rating - Open IMDb', false],
            ['missing IMDb ID', { rating: null, imdbId: null }, 'Not found - Search IMDb', false],
        ])('should build tooltip title for %s', (_, titleObj, expectedTitle, showRtRating) => {
            const renderer = new OverlayRenderer(createConfig({ showRtRating }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj);
            expect(container.querySelector('.fm-rating-overlay a').title).toBe(expectedTitle);
        });
    });

    describe('Loading overlay', () => {
        it('should inject loading overlay', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            renderer.injectLoadingOverlay(container, 'Test Movie');
            const loadingElement = container.querySelector('.fm-loading');
            expect(loadingElement).not.toBeNull();
            expect(loadingElement.textContent).toContain('⏳');
            expect(renderer.isLoading(container)).toBe(true);
        });

        it('should replace loading overlay with ratings overlay', () => {
            const renderer = new OverlayRenderer(createConfig());
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
        it('should add fm-faded class when shouldFade is true', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            renderer.applyFade(container, true);
            expect(container.classList.contains('fm-faded')).toBe(true);
        });

        it('should remove fm-faded class when shouldFade is false', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            container.classList.add('fm-faded');
            renderer.applyFade(container, false);
            expect(container.classList.contains('fm-faded')).toBe(false);
        });
    });

    describe('Fade toggle', () => {
        const titleObj = { rating: 7.0, imdbUrl: 'https://www.imdb.com/title/tt1/', imdbId: 'tt1' };

        it('should not render toggle when onFadeToggleClick is absent', () => {
            const renderer = new OverlayRenderer(createConfig({ enableFadeToggle: true }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj);
            expect(container.querySelector('.fm-fade-toggle')).toBeNull();
        });

        it('should not render toggle when enableFadeToggle config is false', () => {
            const renderer = new OverlayRenderer(createConfig({ enableFadeToggle: false }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj, null, vi.fn());
            expect(container.querySelector('.fm-fade-toggle')).toBeNull();
        });

        it('should render toggle with ⭐ and data-state="auto" for null state', () => {
            const renderer = new OverlayRenderer(createConfig({ enableFadeToggle: true }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj, null, vi.fn());
            const toggle = container.querySelector('.fm-fade-toggle');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');
            expect(toggle).not.toBeNull();
            expect(toggle.dataset.state).toBe('auto');
            expect(toggle.title).toBe('Fade: Auto');
            expect(icon.textContent).toBe('⭐');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(false);
        });

        it('should render toggle with 👁️ and fm-fade-toggle--faded for "always" state', () => {
            const renderer = new OverlayRenderer(createConfig({ enableFadeToggle: true }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj, 'always', vi.fn());
            const toggle = container.querySelector('.fm-fade-toggle');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');
            expect(toggle.dataset.state).toBe('always');
            expect(toggle.title).toBe('Fade: Always');
            expect(icon.textContent).toBe('👁️');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(true);
        });

        it('should render toggle with 👁️ without fm-fade-toggle--faded for "never" state', () => {
            const renderer = new OverlayRenderer(createConfig({ enableFadeToggle: true }));
            const container = document.createElement('div');
            renderer.injectOverlay(container, titleObj, 'never', vi.fn());
            const toggle = container.querySelector('.fm-fade-toggle');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');
            expect(toggle.dataset.state).toBe('never');
            expect(toggle.title).toBe('Fade: Never');
            expect(icon.textContent).toBe('👁️');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(false);
        });

        it('should call onFadeToggleClick with the badge element on click', () => {
            const renderer = new OverlayRenderer(createConfig({ enableFadeToggle: true }));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const onClick = vi.fn();
            renderer.injectOverlay(container, titleObj, null, onClick);
            const toggle = container.querySelector('.fm-fade-toggle');
            toggle.click();
            expect(onClick).toHaveBeenCalledWith(toggle);
        });

        it('should include fm-fade-toggle CSS scoped under fm-rating-overlay', () => {
            const renderer = new OverlayRenderer(createConfig());
            renderer.injectStyles();
            const css = document.head.querySelector('#fm-overlay-styles').textContent;
            expect(css).toContain('.fm-rating-overlay .fm-fade-toggle');
            expect(css).toContain('.fm-rating-overlay .fm-fade-toggle .fm-label');
            expect(css).toContain('.fm-rating-overlay .fm-fade-toggle--faded');
            expect(css).not.toContain('\n            .fm-fade-toggle {');
        });
    });

    describe('Container positioning', () => {
        it('should ensure container has non-static position', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            container.style.position = 'static';
            renderer.ensureRelative(container);
            expect(container.style.position).toBe('relative');
        });

        it('should not change position if already non-static', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            container.style.position = 'absolute';
            renderer.ensureRelative(container);
            expect(container.style.position).toBe('absolute');
        });
    });

    describe('Pointer events and click propagation', () => {
        it('should enable pointer events on rating badges when RT is enabled', () => {
            const renderer = new OverlayRenderer(createConfig({ showRtRating: true }));
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
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            renderer.injectOverlay(container, { imdbUrl: 'http://imdb.com' });

            const link = container.querySelector('a');
            const event = new MouseEvent('click', { bubbles: true });
            const spy = vi.spyOn(event, 'stopPropagation');
            link.dispatchEvent(event);
            expect(spy).toHaveBeenCalled();
        });

        it('should stop propagation on MC and RT rating clicks when enabled', () => {
            const renderer = new OverlayRenderer(createConfig({ showRtRating: true, showMcRating: true }));
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
            const renderer = new OverlayRenderer(createConfig());
            document.body.innerHTML =
                '<div class="fm-rating-overlay"></div>' +
                '<div class="fm-rating-overlay"></div>' +
                '<div class="other"></div>';
            renderer.clearAllOverlays();
            expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(0);
            expect(document.querySelectorAll('.other')).toHaveLength(1);
        });

        it('should remove data-fm-injected attribute from parent when clearing overlays', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', rating: 7.5 });
            renderer.injectOverlay(container, title);
            expect(renderer.hasOverlay(container)).toBe(true);
            renderer.clearAllOverlays();
            expect(renderer.hasOverlay(container)).toBe(false);
        });
    });

    describe('vote count formatting in tooltip', () => {
        it('should format tooltip with vote count in k format', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: 8.5, imdbVotes: 250000 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('IMDb: 8.5 (250k votes) - Open IMDb');
        });

        it('should format tooltip with vote count in M format', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: 9.0, imdbVotes: 2500000 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('IMDb: 9.0 (3M votes) - Open IMDb');
        });

        it('should format tooltip without votes when imdbVotes is null', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: 7.5, imdbVotes: null });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('IMDb: 7.5 - Open IMDb');
        });

        it('should format tooltip without votes when imdbVotes is undefined', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: 6.0 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('IMDb: 6.0 - Open IMDb');
        });

        it('should show no rating tooltip when rating is null but imdbId exists', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: null });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('No rating - Open IMDb');
        });

        it('should show not found tooltip when no imdbId', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', rating: null, imdbId: null });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('Not found - Search IMDb');
        });

        it('should show tooltip with small vote count', () => {
            const renderer = new OverlayRenderer(createConfig());
            const container = document.createElement('div');
            document.body.appendChild(container);
            const title = new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: 5.0, imdbVotes: 123 });
            renderer.injectOverlay(container, title);
            const overlay = container.querySelector('.fm-rating-overlay');
            const imdbLink = overlay.querySelector('a');
            expect(imdbLink.title).toBe('IMDb: 5.0 (123 votes) - Open IMDb');
        });
    });
});
