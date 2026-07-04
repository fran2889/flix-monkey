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
import { SurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';

describe('Preview Detail-Modal UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/surfaces/preview-detail.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    });

    it('should discover exactly one surface from the detail-modal fixture', () => {
        const results = surfaceManager.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe("It's Complicated");
        expect(results[0].container.classList.contains('previewModal--player_container')).toBe(true);
    });

    it('should extract a non-empty title from the boxart alt attribute', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.title).toBeTruthy();
            expect(typeof r.title).toBe('string');
        });
    });

    it('should set fadeable to false for the detail-modal surface', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.fadeable).toBe(false);
        });
    });

    it('should set showFadeToggle to false for the detail-modal surface', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.showFadeToggle).toBe(false);
        });
    });

    it('should inject a rating overlay into the detail-modal container', () => {
        const results = surfaceManager.discover(document.body);
        const { container } = results[0];

        overlayRenderer.injectOverlay(container, {
            rating: 6.6,
            imdbUrl: 'https://www.imdb.com/title/tt0762107/',
            imdbId: 'tt0762107',
        });

        expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
        expect(container.querySelector('.fm-rating-overlay').textContent).toContain('6.6');
    });

    it('should not apply fading to the detail-modal container', () => {
        const results = surfaceManager.discover(document.body);
        const { container } = results[0];

        overlayRenderer.applyFade(container, false);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });
});
