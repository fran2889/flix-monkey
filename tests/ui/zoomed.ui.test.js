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
import { FadeManager } from '../../src/core/fade-manager.js';
import { createMockAdapter } from '../mocks/adapter.js';

describe('Zoomed UI Surface', () => {
    let surfaceManager, _overlayRenderer;

    beforeAll(() => {
        // Override the fixture load to inject a minimal bob-container structure
        // Since the actual hover fixture captured too much non-UI cruft.
        document.body.innerHTML = `
      <div class="bob-container">
        <div class="bob-title">Hover Title Test</div>
      </div>
    `;
    });

    beforeEach(() => {
        surfaceManager = new SurfaceManager();
        _overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    });

    it('should discover the active bob-container', () => {
        const surfaces = surfaceManager.discover(document.body);
        const bob = surfaces.find(s => s.container.classList.contains('bob-container'));

        expect(bob).toBeDefined();
        expect(bob.fadeable).toBe(false);
    });

    it('should not apply fading to zoomed cards even with low ratings', () => {
        const surfaces = surfaceManager.discover(document.body);
        const bob = surfaces.find(s => s.container.classList.contains('bob-container'));

        const fade = new FadeManager(createMockAdapter(), new ConfigManager(createMockAdapter()));
        _overlayRenderer.applyFade(bob.container, fade.shouldFade(null, 1.0, bob.fadeable));
        expect(bob.container.classList.contains('fm-faded')).toBe(false);
    });
});
