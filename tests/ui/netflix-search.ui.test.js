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
import fs from 'fs';
import path from 'path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { NetflixSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('Search UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/netflix-search.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new NetflixSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    });

    it('should discover gallery cards but ignore suggestion items', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.length).toBeGreaterThan(0);

        const hasGallery = surfaces.some(s => s.container.matches('[data-uia="standard-card"]'));
        const hasSuggestion = surfaces.some(s => s.container.matches('[data-uia="search-suggestion-item"]'));

        expect(hasGallery).toBe(true);
        expect(hasSuggestion).toBe(false);
    });

    it('should extract non-empty string titles from each search card', () => {
        const surfaces = surfaceManager.discover(document.body);
        surfaces.forEach(s => {
            expect(s.title).toBeTruthy();
            expect(typeof s.title).toBe('string');
        });
    });

    it('should set fadeable to true for search surface cards', () => {
        const surfaces = surfaceManager.discover(document.body);
        surfaces.forEach(s => {
            expect(s.fadeable).toBe(true);
        });
    });

    it('should inject a rating overlay on a search card', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container } = surfaces[0];

        overlayRenderer.injectOverlay(container, {
            rating: 7.4,
            imdbUrl: 'https://www.imdb.com/title/tt9876543/',
            imdbId: 'tt9876543',
        });

        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.textContent).toContain('7.4');
    });
});
