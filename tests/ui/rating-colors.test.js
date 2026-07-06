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
import { beforeEach, describe, expect, it } from 'vitest';

import { OverlayRenderer } from '../../src/core/overlay.js';
import { createConfig } from '../mocks/config.js';

describe('Rating Colors UI Tests', () => {
    let renderer;

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        renderer = new OverlayRenderer(createConfig());
        renderer.injectStyles();
    });

    it('applies color to IMDb rating in overlay', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const titleObj = {
            rating: 8.5,
            imdbId: 'tt0468569',
            imdbUrl: 'https://www.imdb.com/title/tt0468569',
            imdbVotes: 2500000,
        };

        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        const allValueSpans = overlay.querySelectorAll('.fm-value');
        // IMDb rating is the first value element
        const valueSpan = allValueSpans[0];
        expect(valueSpan).not.toBeNull();
        // 8.5 is 87.5% between 5.0 and 9.0: r=32, g=223
        expect(valueSpan.style.color).toBe('rgb(32, 223, 0)');
    });

    it('applies red color to low IMDb rating in overlay', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const titleObj = {
            rating: 3.2,
            imdbId: 'tt0468569',
            imdbUrl: 'https://www.imdb.com/title/tt0468569',
            imdbVotes: 50000,
        };

        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        const allValueSpans = overlay.querySelectorAll('.fm-value');
        const valueSpan = allValueSpans[0];
        expect(valueSpan).not.toBeNull();
        // Hex #ff0000 is converted to rgb(255, 0, 0) by the browser
        expect(valueSpan.style.color).toBe('rgb(255, 0, 0)');
    });

    it('applies green color to high IMDb rating in overlay', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const titleObj = {
            rating: 9.5,
            imdbId: 'tt0468569',
            imdbUrl: 'https://www.imdb.com/title/tt0468569',
            imdbVotes: 2500000,
        };

        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        const allValueSpans = overlay.querySelectorAll('.fm-value');
        const valueSpan = allValueSpans[0];
        expect(valueSpan).not.toBeNull();
        // Hex #00cc00 is converted to rgb(0, 204, 0) by the browser
        expect(valueSpan.style.color).toBe('rgb(0, 204, 0)');
    });

    it('applies color to RT rating in overlay', () => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        const renderer = new OverlayRenderer(createConfig({ showRtRating: true }));
        renderer.injectStyles();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const titleObj = {
            rating: 7.2,
            imdbId: 'tt0468569',
            imdbUrl: 'https://www.imdb.com/title/tt0468569',
            rtRating: 87,
        };

        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        const allValueSpans = overlay.querySelectorAll('.fm-value');
        // RT rating should be the second value element (after IMDb)
        const rtValueSpan = allValueSpans[1];
        expect(rtValueSpan).not.toBeNull();
        // 87 is 92.5% between 50 and 90: r=19, g=236
        expect(rtValueSpan.style.color).toBe('rgb(19, 236, 0)');
    });

    it('applies color to MC rating in overlay', () => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        const renderer = new OverlayRenderer(createConfig({ showMcRating: true, showRtRating: false }));
        renderer.injectStyles();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const titleObj = {
            rating: 7.2,
            imdbId: 'tt0468569',
            imdbUrl: 'https://www.imdb.com/title/tt0468569',
            mcRating: 74,
        };

        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay).not.toBeNull();
        const mcLabel = overlay.querySelector('.fm-label.fm-mc');
        expect(mcLabel).not.toBeNull();
        const valueSpan = overlay.querySelector('.fm-value');
        expect(valueSpan).not.toBeNull();
        // MC rating should be the last value element
        const allValueSpans = overlay.querySelectorAll('.fm-value');
        const mcValueSpan = allValueSpans[allValueSpans.length - 1];
        // 74 is 60% between 50 and 90: r=102, g=153
        expect(mcValueSpan.style.color).toBe('rgb(102, 153, 0)');
    });

    it('does not apply color to N/A rating in overlay', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const titleObj = {
            rating: null,
            imdbId: 'tt0468569',
            imdbUrl: 'https://www.imdb.com/title/tt0468569',
        };

        renderer.injectOverlay(container, titleObj);
        const overlay = container.querySelector('.fm-rating-overlay');
        const naSpan = overlay.querySelector('.fm-na');
        expect(naSpan).not.toBeNull();
        // N/A elements should have the default color from CSS, not gradient
        expect(naSpan.style.color).toBe('');
    });
});
