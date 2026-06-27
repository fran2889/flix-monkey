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

describe('Info UI Surface (Mini-Modal)', () => {
    let surfaceManager, overlayRenderer;

    beforeAll(() => {
        document.body.innerHTML = `
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img class="previewModal--boxart" alt="Beef">
                </div>
            </div>
        `;
    });

    beforeEach(() => {
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    });

    it('should discover title in the preview modal', () => {
        const surfaces = surfaceManager.discover(document.body);
        const modal = surfaces.find(s => s.container.classList.contains('previewModal--player_container'));

        expect(modal).toBeDefined();
        expect(modal.title).toBe('Beef');
        expect(modal.fadeable).toBe(false);
    });

    it('should inject overlay into modal container', () => {
        const surfaces = surfaceManager.discover(document.body);
        const modal = surfaces.find(s => s.container.classList.contains('previewModal--player_container'));

        overlayRenderer.injectOverlay(modal.container, { rating: 7.8, imdbUrl: 'https://www.imdb.com/title/tt789/' });
        expect(modal.container.querySelector('.fm-rating-overlay')).not.toBeNull();
    });
});
