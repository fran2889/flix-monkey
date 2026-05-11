import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import fs from 'fs';
import path from 'path';

describe('Search UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/netflix-search.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer();
    });

    it('should discover both gallery cards and suggestion items', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.length).toBeGreaterThan(0);

        // Find at least one gallery card
        const hasGallery = surfaces.some(s => s.container.matches('[data-uia="search-gallery-video-card"]'));
        // Find at least one suggestion item (or parent container)
        const hasSuggestion = surfaces.some(s => s.container.matches('[data-uia="search-suggestion-item"]'));

        expect(hasGallery || hasSuggestion).toBe(true);
    });

    it('should extract titles from search attributes', () => {
        const surfaces = surfaceManager.discover(document.body);
        surfaces.forEach(s => {
            expect(s.title).toBeTruthy();
            expect(typeof s.title).toBe('string');
        });
    });
});
