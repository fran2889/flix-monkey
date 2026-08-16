/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { parseHex } from '../../../../src/core/color-utils.js';
import { RATING_COLOR_GREEN, RATING_COLOR_RED } from '../../../../src/core/constants.js';
import { Title } from '../../../../src/core/title.js';
import { createLoadingOverlayElement, createOverlayElement } from '../../../../src/core/ui/overlay-elements.js';

const defaultOptions = {
    overlayClass: 'fm-rating-overlay',
    showRtRating: false,
    showMcRating: false,
    showFadeToggle: false,
    fadeToggleState: null,
    onFadeToggleClick: null,
};

function createOverlay(title, options = {}) {
    return createOverlayElement(title, { ...defaultOptions, ...options });
}

describe('createOverlayElement', () => {
    it('builds the IMDb rating link', () => {
        const element = createOverlay(new Title({ imdbId: 'tt1234567', rating: 7.5 }));

        expect(element.className).toBe('fm-rating-overlay');
        expect(element.querySelector('a').href).toContain('/title/tt1234567/');
        expect(element.textContent).toContain('IMDb 7.5');
    });

    it('renders IMDb badge for a zero rating', () => {
        const element = createOverlay(new Title({ imdbId: 'tt1234567', rating: 0 }));

        expect(element.querySelector('.fm-value')).not.toBeNull();
        expect(element.textContent).toContain('0.0');
    });

    it('renders RT and MC badges for zero percent ratings when enabled', () => {
        const element = createOverlay(new Title({ imdbId: 'tt1234567', rating: 5, rtRating: 0, mcRating: 0 }), {
            showRtRating: true,
            showMcRating: true,
        });

        const percentBadges = [...element.querySelectorAll('.fm-value')].filter(el => el.textContent === '0%');
        expect(percentBadges).toHaveLength(2);
    });

    it('does not render optional ratings when disabled', () => {
        const element = createOverlay({ rating: 7, rtRating: 90, mcRating: 80, imdbUrl: 'http://imdb.com' });

        expect(element.textContent).toContain('7.0');
        expect(element.textContent).not.toContain('RT');
        expect(element.textContent).not.toContain('MC');
    });

    it('displays all ratings when provided and enabled', () => {
        const element = createOverlay(
            {
                rating: 8.5,
                rtRating: 90,
                mcRating: 80,
                imdbUrl: 'https://imdb.com/title/tt1234567/',
                imdbId: 'tt1234567',
            },
            { showRtRating: true, showMcRating: true }
        );

        expect(element.textContent).toContain('8.5');
        expect(element.textContent).toContain('90%');
        expect(element.textContent).toContain('80%');
        const labelTexts = Array.from(element.querySelectorAll('.fm-label')).map(label => label.textContent);
        expect(labelTexts).toContain('IMDb ');
        expect(labelTexts).toContain('RT ');
        expect(labelTexts).toContain('MC ');
    });

    it('shows the search icon when imdbId is missing', () => {
        const element = createOverlay({ rating: null, imdbId: null });

        expect(element.querySelector('.fm-search')).not.toBeNull();
        expect(element.querySelector('.fm-search').textContent).toBe('🔍');
    });

    it('shows N/A when imdbId is present but rating is missing', () => {
        const element = createOverlay({
            imdbId: 'tt1234567',
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            rating: null,
        });

        expect(element.textContent).toContain('N/A');
        expect(element.querySelector('.fm-na')).not.toBeNull();
    });

    it.each([
        ['normal ratings', { rating: 8.2, rtRating: 85, imdbId: 'tt1' }, 'IMDb: 8.2 · Open IMDb'],
        ['no ratings but IMDb ID present', { rating: null, imdbId: 'tt1' }, 'IMDb: No rating · Open IMDb'],
        ['missing IMDb ID', { rating: null, imdbId: null }, 'IMDb: Not found · Search IMDb'],
    ])('builds the tooltip title for %s', (_, title, expectedTitle) => {
        const element = createOverlay(title, { showRtRating: true });

        expect(element.querySelector('a').title).toBe(expectedTitle);
    });

    describe('loading overlay', () => {
        it('creates loading content', () => {
            const element = createLoadingOverlayElement('fm-rating-overlay', 'fm-loading');

            expect(element.className).toBe('fm-rating-overlay fm-loading');
            expect(element.textContent).toContain('⏳');
            expect(element.title).toBe('IMDb: Fetching ratings... * Search IMDb');
        });
    });

    describe('fade toggle', () => {
        const title = { rating: 7, imdbUrl: 'https://www.imdb.com/title/tt1/', imdbId: 'tt1' };

        it('does not render the toggle when the click callback is absent', () => {
            const element = createOverlay(title, { showFadeToggle: true });

            expect(element.querySelector('.fm-fade-toggle')).toBeNull();
        });

        it('does not render the toggle when disabled', () => {
            const element = createOverlay(title, { onFadeToggleClick: vi.fn() });

            expect(element.querySelector('.fm-fade-toggle')).toBeNull();
        });

        it('renders auto state with the star icon', () => {
            const element = createOverlay(title, { showFadeToggle: true, onFadeToggleClick: vi.fn() });
            const toggle = element.querySelector('.fm-fade-toggle');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');

            expect(toggle.tagName).toBe('DIV');
            expect(toggle.dataset.state).toBe('auto');
            expect(toggle.title).toBe('Fade: Auto');
            expect(icon.textContent).toBe('⭐');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(false);
        });

        it('renders always state with a faded eye icon', () => {
            const element = createOverlay(title, {
                showFadeToggle: true,
                fadeToggleState: 'always',
                onFadeToggleClick: vi.fn(),
            });
            const toggle = element.querySelector('.fm-fade-toggle');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');

            expect(toggle.dataset.state).toBe('always');
            expect(toggle.title).toBe('Fade: Always');
            expect(icon.textContent).toBe('👁️');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(true);
        });

        it('renders never state with a non-faded eye icon', () => {
            const element = createOverlay(title, {
                showFadeToggle: true,
                fadeToggleState: 'never',
                onFadeToggleClick: vi.fn(),
            });
            const toggle = element.querySelector('.fm-fade-toggle');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');

            expect(toggle.dataset.state).toBe('never');
            expect(toggle.title).toBe('Fade: Never');
            expect(icon.textContent).toBe('👁️');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(false);
        });

        it('calls the fade-toggle callback with the badge element', () => {
            const onFadeToggleClick = vi.fn();
            const element = createOverlay(title, { showFadeToggle: true, onFadeToggleClick });
            const toggle = element.querySelector('.fm-fade-toggle');

            toggle.click();

            expect(onFadeToggleClick).toHaveBeenCalledWith(toggle);
        });
    });

    describe('click propagation', () => {
        it('stops propagation on the IMDb link', () => {
            const element = createOverlay({ imdbUrl: 'http://imdb.com' });
            const event = new MouseEvent('click', { bubbles: true });
            const spy = vi.spyOn(event, 'stopPropagation');

            element.querySelector('a').dispatchEvent(event);

            expect(spy).toHaveBeenCalled();
        });

        it('stops propagation on enabled MC and RT rating clicks', () => {
            const element = createOverlay(
                { rating: 8.5, rtRating: 90, mcRating: 80, imdbUrl: 'http://imdb.com', imdbId: 'tt1' },
                { showRtRating: true, showMcRating: true }
            );

            [element.querySelector('.fm-rt').parentElement, element.querySelector('.fm-mc').parentElement].forEach(
                badge => {
                    const event = new MouseEvent('click', { bubbles: true });
                    const spy = vi.spyOn(event, 'stopPropagation');
                    badge.dispatchEvent(event);
                    expect(spy).toHaveBeenCalled();
                }
            );
        });
    });

    describe('vote count formatting in tooltip', () => {
        it.each([
            [{ rating: 8.5, imdbVotes: 250000 }, 'Test\nIMDb: 8.5 (250k votes) · Open IMDb'],
            [{ rating: 9, imdbVotes: 2500000 }, 'Test\nIMDb: 9.0 (3M votes) · Open IMDb'],
            [{ rating: 7.5, imdbVotes: null }, 'Test\nIMDb: 7.5 · Open IMDb'],
            [{ rating: 6 }, 'Test\nIMDb: 6.0 · Open IMDb'],
        ])('formats tooltip for vote data %o', (titleData, expectedTitle) => {
            const element = createOverlay(new Title({ apiTitle: 'Test', imdbId: 'tt1234567', ...titleData }));

            expect(element.querySelector('a').title).toBe(expectedTitle);
        });

        it('formats a small vote count', () => {
            const element = createOverlay(
                new Title({ apiTitle: 'Test', imdbId: 'tt1234567', rating: 5, imdbVotes: 123 })
            );

            expect(element.querySelector('a').title).toBe('Test\nIMDb: 5.0 (123 votes) · Open IMDb');
        });

        it('formats apiTitle and year', () => {
            const element = createOverlay(
                new Title({
                    apiTitle: 'The Shawshank Redemption',
                    imdbId: 'tt0111161',
                    rating: 9.3,
                    imdbVotes: 2700000,
                    year: 1994,
                })
            );

            expect(element.querySelector('a').title).toBe(
                'The Shawshank Redemption (1994)\nIMDb: 9.3 (3M votes) · Open IMDb'
            );
        });

        it('formats apiTitle without a year', () => {
            const element = createOverlay(
                new Title({ apiTitle: 'Inception', imdbId: 'tt1375666', rating: 8.8, imdbVotes: 2400000 })
            );

            expect(element.querySelector('a').title).toBe('Inception\nIMDb: 8.8 (2M votes) · Open IMDb');
        });
    });

    describe('rating colors', () => {
        it.each([
            ['IMDb low rating', 5, false, RATING_COLOR_RED],
            ['IMDb high rating', 9, false, RATING_COLOR_GREEN],
            ['percentage low rating', 50, true, RATING_COLOR_RED],
            ['percentage high rating', 90, true, RATING_COLOR_GREEN],
        ])('uses the threshold color for %s', (_, rating, isPercentage, expectedHex) => {
            const element = isPercentage
                ? createOverlay(
                      { rating: 7, imdbId: 'tt1', imdbUrl: 'http://imdb.com', rtRating: rating },
                      { showRtRating: true }
                  )
                : createOverlay({ rating, imdbId: 'tt1', imdbUrl: 'http://imdb.com' });
            const valueSpans = element.querySelectorAll('.fm-value');
            const value = isPercentage ? valueSpans[1] : valueSpans[0];
            const expectedRgb = parseHex(expectedHex);

            expect(value.style.color).toBe(`rgb(${expectedRgb.r}, ${expectedRgb.g}, ${expectedRgb.b})`);
        });

        it.each([
            ['IMDb rating', 7, false],
            ['percentage rating', 70, true],
        ])('uses a gradient color for %s', (_, rating, isPercentage) => {
            const element = isPercentage
                ? createOverlay(
                      { rating: 7, imdbId: 'tt1', imdbUrl: 'http://imdb.com', rtRating: rating },
                      { showRtRating: true }
                  )
                : createOverlay({ rating, imdbId: 'tt1', imdbUrl: 'http://imdb.com' });
            const valueSpans = element.querySelectorAll('.fm-value');
            const value = isPercentage ? valueSpans[1] : valueSpans[0];

            expect(value.style.color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });

        it('does not apply color to N/A', () => {
            const element = createOverlay({ rating: null, imdbId: 'tt1', imdbUrl: 'http://imdb.com' });

            expect(element.querySelector('.fm-na').style.color).toBe('');
        });

        it('applies a gradient color to MC ratings', () => {
            const element = createOverlay(
                { rating: 7, imdbId: 'tt1', imdbUrl: 'http://imdb.com', mcRating: 74 },
                { showMcRating: true }
            );

            expect(element.querySelectorAll('.fm-value')[1].style.color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });
    });
});
