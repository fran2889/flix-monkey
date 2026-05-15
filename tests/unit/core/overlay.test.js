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

    it('should inject loading overlay and then replace it with ratings overlay', () => {
        const config = new ConfigManager();
        const overlayRenderer = new OverlayRenderer(config);
        const container = document.createElement('div');

        // 1. Inject loading overlay
        overlayRenderer.injectLoadingOverlay(container, 'Test Movie');

        // Verify loading overlay is present
        const loadingElement = container.querySelector('.fm-loading');
        expect(loadingElement).not.toBeNull();
        expect(loadingElement.textContent).toContain('⏳');
        expect(overlayRenderer.isLoading(container)).toBe(true);

        // 2. Replace with ratings overlay
        const mockTitleObj = {
            rating: 8.5,
            imdbUrl: 'https://imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        overlayRenderer.injectOverlay(container, mockTitleObj);

        // Verify loading overlay is removed
        expect(container.querySelector('.fm-loading')).toBeNull();
        expect(overlayRenderer.isLoading(container)).toBe(false);

        // Verify ratings overlay is present
        const ratingElement = container.querySelector('.fm-rating-overlay');
        expect(ratingElement).not.toBeNull();
        expect(ratingElement.textContent).toContain('8.5');
        expect(overlayRenderer.hasOverlay(container)).toBe(true);
    });
});
