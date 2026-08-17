/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import fs from 'fs';
import path from 'path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { NetflixSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('Preview Detail-Modal UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/preview-detail.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new NetflixSurfaceManager(createMockLogger());
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
            imdbRating: 6.6,
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
