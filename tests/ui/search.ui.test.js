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

describe('Search UI Surface', () => {
    let surfaceManager, _overlayRenderer, _fixtureHtml;

    beforeAll(() => {
        _fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/netflix-search.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = _fixtureHtml;
        surfaceManager = new SurfaceManager();
        _overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    });

    it('should discover gallery cards but ignore suggestion items', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.length).toBeGreaterThan(0);

        // Find at least one gallery card
        const hasGallery = surfaces.some(s => s.container.matches('[data-uia="standard-card"]'));
        // Find at least one suggestion item (or parent container)
        const hasSuggestion = surfaces.some(s => s.container.matches('[data-uia="search-suggestion-item"]'));

        expect(hasGallery).toBe(true);
        expect(hasSuggestion).toBe(false); // All suggestions (text links) should be ignored
    });

    it('should extract titles from search attributes', () => {
        const surfaces = surfaceManager.discover(document.body);
        surfaces.forEach(s => {
            expect(s.title).toBeTruthy();
            expect(typeof s.title).toBe('string');
        });
    });
});
