/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import fs from 'fs';
import path from 'path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { NetflixService } from '../../src/core/services.js';
import { NetflixSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';

describe('Browse UI Surface', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = ['title-card.html', 'progress-card.html', 'ranked-card.html']
            .map(file => fs.readFileSync(path.resolve(__dirname, `../fixtures/${file}`), 'utf8'))
            .join('\n');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new NetflixSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()), new NetflixService().constants);
        overlayRenderer.injectStyles();
    });

    it('should discover title cards on the browse grid', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.length).toBeGreaterThan(0);

        const first = surfaces[0];
        expect(first.title).toBeTruthy();
        expect(first.container).toBeInstanceOf(HTMLElement);
        expect(first.fadeable).toBe(true);
    });

    it('should extract non-empty string titles from each browse card', () => {
        const surfaces = surfaceManager.discover(document.body);
        surfaces.forEach(s => {
            expect(s.title).toBeTruthy();
            expect(typeof s.title).toBe('string');
        });
    });

    it('should inject a loading overlay on a browse card', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container, title } = surfaces[0];

        overlayRenderer.injectLoadingOverlay(container, title);

        const loading = container.querySelector('.fm-loading');
        expect(loading).not.toBeNull();
        expect(loading.textContent).toContain('IMDb');
        expect(loading.title).toContain('Fetching ratings');
    });

    it.each([
        ['progress-card', '[data-uia="progress-card"]'],
        ['ranked-card', '[data-uia="ranked-card"]'],
    ])('should discover and inject on %s surfaces', (_name, selector) => {
        const expectedContainer = document.querySelector(selector);
        expect(expectedContainer).not.toBeNull();

        const surface = surfaceManager
            .discover(document.body)
            .find(candidate => candidate.container === expectedContainer);

        expect(surface).toMatchObject({
            title: expectedContainer.getAttribute('aria-label'),
            fadeable: true,
            showFadeToggle: false,
        });

        overlayRenderer.injectLoadingOverlay(surface.container, surface.title);
        expect(surface.container.querySelector('.fm-loading')).not.toBeNull();
    });

    it('should replace loading overlay with rating overlay on a browse card', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container, title } = surfaces[0];

        overlayRenderer.injectLoadingOverlay(container, title);

        const titleObj = {
            imdbRating: 8.5,
            imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        };
        overlayRenderer.injectOverlay(container, titleObj);

        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.classList.contains('fm-loading')).toBe(false);
        expect(overlay.textContent).toContain('8.5');
        const link = overlay.querySelector('a');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe(titleObj.imdbUrl);
    });

    it('should apply fading for low ratings below threshold', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container } = surfaces[0];

        new OverlayRenderer(new ConfigManager(createMockAdapter())).applyFade(container, true);
        expect(container.classList.contains('fm-faded')).toBe(true);
    });

    it('should NOT apply fading for ratings at or above threshold', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container } = surfaces[0];

        new OverlayRenderer(new ConfigManager(createMockAdapter())).applyFade(container, false);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });
});
