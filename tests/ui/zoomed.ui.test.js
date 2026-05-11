import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import fs from 'fs';
import path from 'path';

describe('Zoomed UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

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
        overlayRenderer = new OverlayRenderer();
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

        overlayRenderer.applyFade(bob.container, { rating: 1.0 }, bob.fadeable);
        expect(bob.container.classList.contains('fm-faded')).toBe(false);
    });
});
