/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { expect } from 'vitest';

import { Title } from '../../src/core/title.js';

/**
 * Tests surface discovery and overlay injection for a set of fixtures.
 * Each fixture must represent exactly one surface.
 *
 * @param {import('../../src/core/surfaces/index.js').SurfaceManager} surfaceManager
 * @param {import('../../src/core/overlay.js').OverlayRenderer} overlayRenderer
 * @param {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean}}>} fixtures
 */
export function testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures) {
    fixtures.forEach(entry => {
        document.body.innerHTML = `<html><body>${entry.html}</body></html>`;
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces, `Expected exactly one surface for ${entry.name}`).toHaveLength(1);
        const surface = surfaces[0];
        expect(surface.title).toBe(entry.expected.title);
        expect(surface.fadeable).toBe(entry.expected.fadeable);
        expect(surface.showFadeToggle).toBe(entry.expected.showFadeToggle);
        overlayRenderer.injectOverlay(
            surface.container,
            new Title({ imdbRating: 8.5, imdbId: 'tt1234567' }),
            null,
            null,
            null,
            null,
            surface.title
        );
        expect(surface.container.querySelector('.fm-rating-overlay')).not.toBeNull();
    });
}
