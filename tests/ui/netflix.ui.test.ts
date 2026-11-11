/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index';
import { OverlayRenderer } from '../../src/core/overlay';
import { NetflixService } from '../../src/core/services/index';
import { NetflixSurfaceManager } from '../../src/core/surfaces/index';
import { Title } from '../../src/core/title';
import type { DiscoveredSurface } from '../../src/types/surfaces';
import fixtures, { NETFLIX_MORE_LIKE_THIS_SECTION } from '../fixtures/netflix-surfaces';
import { testSurfaceFixtures } from '../helpers/surface-tests';
import { buildMockAdapter } from '../mocks/adapter';
import { buildLogger } from '../mocks/logger';

describe('Netflix surfaces', () => {
    let surfaceManager: NetflixSurfaceManager;
    let overlayRenderer: OverlayRenderer;

    beforeEach(() => {
        surfaceManager = new NetflixSurfaceManager(buildLogger().build());
        overlayRenderer = new OverlayRenderer(
            new ConfigManager(buildMockAdapter().build(), buildLogger().build()),
            new NetflixService().constants
        );
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all Netflix surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });

    function attachOverlay(surface: DiscoveredSurface): void {
        if (overlayRenderer.hasOverlay(surface.container as HTMLElement)) return;
        overlayRenderer.injectOverlay(
            surface.container as HTMLElement,
            new Title({ displayTitle: surface.title, imdbRating: 8.5, imdbId: 'tt1234567' }),
            {
                displayTitle: surface.title,
                onEditClick: () => {},
                onRefreshClick: () => {},
                fadeToggleState: undefined,
                onFadeToggleClick: undefined,
            }
        );
    }

    it('should decorate collapsed and expanded More Like This tiles once', () => {
        document.body.innerHTML = NETFLIX_MORE_LIKE_THIS_SECTION.collapsedHtml;

        let surfaces = surfaceManager.discover(document.body);
        expect(surfaces).toHaveLength(2);
        expect(surfaces.map(surface => surface.title)).toEqual(['Caramelo', 'The Crown']);
        surfaces.forEach(surface => {
            expect(surface.fadeable).toBe(true);
            expect(surface.showFadeToggle).toBe(false);
            expect(surface.container).toHaveClass('titleCard-imageWrapper');
            attachOverlay(surface);
        });

        const wrapper = document.querySelector('.moreLikeThis--wrapper');
        if (!wrapper) throw new Error('More Like This wrapper missing');
        wrapper.insertAdjacentHTML('beforeend', NETFLIX_MORE_LIKE_THIS_SECTION.expandedHtml);

        surfaces = surfaceManager.discover(document.body);
        expect(surfaces).toHaveLength(4);
        expect(surfaces.map(surface => surface.title)).toEqual([
            'Caramelo',
            'The Crown',
            'Alt Only Title',
            'No Artwork Label',
        ]);
        surfaces.forEach(attachOverlay);

        document.querySelectorAll('.titleCard-imageWrapper').forEach(container => {
            expect(container.querySelectorAll('.fm-rating-overlay')).toHaveLength(1);
        });

        surfaces.forEach(attachOverlay);
        expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(4);
    });
});
