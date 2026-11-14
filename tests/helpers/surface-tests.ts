/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { expect } from 'vitest';

import type { OverlayRenderer } from '../../src/core/overlay';
import type { SurfaceManager } from '../../src/core/surfaces/index';
import { Title } from '../../src/core/title';

/**
 * Fixture entry for surface testing.
 */
export interface SurfaceFixture {
    name: string;
    html: string;
    expected: {
        title: string;
        fadeable: boolean;
        showFadeToggle: boolean;
    };
}

/**
 * Tests surface discovery and overlay injection for a set of fixtures.
 * Each fixture must represent exactly one surface.
 *
 * @param surfaceManager - The surface manager to test
 * @param overlayRenderer - The overlay renderer to test
 * @param fixtures - Array of surface fixtures to test against
 */
export function testSurfaceFixtures(
    surfaceManager: SurfaceManager,
    overlayRenderer: OverlayRenderer,
    fixtures: SurfaceFixture[]
): void {
    fixtures.forEach(entry => {
        document.body.innerHTML = `<html><body>${entry.html}</body></html>`;
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces, `Expected exactly one surface for ${entry.name}`).toHaveLength(1);
        const [surface] = surfaces;
        if (surface === undefined) throw new Error(`Expected a surface for ${entry.name}`);
        expect(surface.title).toBe(entry.expected.title);
        expect(surface.fadeable).toBe(entry.expected.fadeable);
        expect(surface.showFadeToggle).toBe(entry.expected.showFadeToggle);
        overlayRenderer.injectOverlay(
            surface.container,
            new Title({ displayTitle: surface.title, imdbRating: 8.5, imdbId: 'tt1234567' }),
            {
                displayTitle: surface.title,
                onEditClick: () => {},
                onRefreshClick: () => {},
                fadeToggleState: undefined,
                onFadeToggleClick: undefined,
            }
        );
        expect(surface.container.querySelector('.fm-rating-overlay')).not.toBeNull();
    });
}
