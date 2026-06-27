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

describe('Mini-Modal (Hover) UI Surface', () => {
    let surfaceManager, overlayRenderer;

    beforeAll(() => {
        document.body.innerHTML = `
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img class="previewModal--boxart" alt="Hover Title Test">
                </div>
            </div>
        `;
    });

    beforeEach(() => {
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    });

    it('should discover the hover mini-modal container', () => {
        const surfaces = surfaceManager.discover(document.body);
        const mini = surfaces.find(s => s.container.classList.contains('previewModal--player_container'));

        expect(mini).toBeDefined();
        expect(mini.title).toBe('Hover Title Test');
        expect(mini.fadeable).toBe(false);
    });

    it('should not apply fading to hover cards even with low ratings', () => {
        const surfaces = surfaceManager.discover(document.body);
        const mini = surfaces.find(s => s.container.classList.contains('previewModal--player_container'));

        overlayRenderer.applyFade(mini.container, { rating: 1.0 }, mini.fadeable);
        expect(mini.container.classList.contains('fm-faded')).toBe(false);
    });
});
