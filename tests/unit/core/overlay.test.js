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
import { describe, it, expect } from 'vitest';
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { ConfigManager } from '../../../src/core/config-manager.js';

describe('Overlay', () => {
    it('should create an overlay element', () => {
        const overlay = new OverlayRenderer(new ConfigManager());
        expect(overlay).toBeDefined();
    });

    it('should inject loading overlay', () => {
        const overlayRenderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        overlayRenderer.injectLoadingOverlay(container, 'Test Movie');
        const loadingElement = container.querySelector('.fm-loading');
        expect(loadingElement).not.toBeNull();
        expect(loadingElement.textContent).toContain('⏳');
        expect(overlayRenderer.isLoading(container)).toBe(true);
    });

    it('should replace loading overlay with ratings overlay', () => {
        const overlayRenderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');
        overlayRenderer.injectLoadingOverlay(container, 'Test Movie');

        const mockTitleObj = {
            rating: 8.5,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        overlayRenderer.injectOverlay(container, mockTitleObj);

        expect(container.querySelector('.fm-loading')).toBeNull();
        expect(overlayRenderer.isLoading(container)).toBe(false);
        expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
        expect(overlayRenderer.hasOverlay(container)).toBe(true);
    });

    it('should display all three ratings when provided', () => {
        const overlayRenderer = new OverlayRenderer(new ConfigManager());
        const container = document.createElement('div');

        const mockTitleObj = {
            rating: 8.5,
            rtRating: 90,
            mcRating: 80,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        overlayRenderer.injectOverlay(container, mockTitleObj);

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
});
