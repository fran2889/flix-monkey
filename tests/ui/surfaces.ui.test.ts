/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/core/config/index';
import { OverlayRenderer } from '../../src/core/overlay';
import { DisneyPlusService, HboMaxService, NetflixService, type StreamingService } from '../../src/core/services/index';
import {
    DISNEY_PLUS_SURFACES,
    HBO_MAX_SURFACES,
    NETFLIX_SURFACES,
    SurfaceManager,
} from '../../src/core/surfaces/index';
import { Title } from '../../src/core/title';
import type { DiscoveredSurface, SurfaceDefinition } from '../../src/types/surfaces';
import disneyPlusFixtures from '../fixtures/disneyplus-surfaces';
import hboMaxFixtures from '../fixtures/hbomax-surfaces';
import netflixFixtures, { NETFLIX_MORE_LIKE_THIS_SECTION } from '../fixtures/netflix-surfaces';
import { type SurfaceFixture, testSurfaceFixtures } from '../helpers/surface-tests';
import { buildMockAdapter } from '../mocks/adapter';
import { buildLogger } from '../mocks/logger';

const serviceCases = [
    {
        name: 'Netflix',
        createService: () => new NetflixService(),
        surfaces: NETFLIX_SURFACES,
        fixtures: netflixFixtures,
    },
    {
        name: 'HBO Max',
        createService: () => new HboMaxService(),
        surfaces: HBO_MAX_SURFACES,
        fixtures: hboMaxFixtures,
    },
    {
        name: 'Disney+',
        createService: () => new DisneyPlusService(),
        surfaces: DISNEY_PLUS_SURFACES,
        fixtures: disneyPlusFixtures,
    },
] satisfies Array<{
    name: string;
    createService: () => StreamingService;
    surfaces: Readonly<Record<string, SurfaceDefinition>>;
    fixtures: SurfaceFixture[];
}>;

function buildRenderer(service: StreamingService): OverlayRenderer {
    const renderer = new OverlayRenderer(
        new ConfigManager(buildMockAdapter().build(), buildLogger().build()),
        service.constants
    );
    renderer.injectStyles();
    return renderer;
}

describe('surface fixtures', () => {
    describe('service matrix', () => {
        describe.each(serviceCases)('$name surfaces', ({ createService, surfaces, fixtures }) => {
            let surfaceManager: SurfaceManager;
            let overlayRenderer: OverlayRenderer;

            beforeEach(() => {
                surfaceManager = new SurfaceManager(buildLogger().build(), surfaces);
                overlayRenderer = buildRenderer(createService());
            });

            it('discovers and injects an overlay on every surface fixture', () => {
                testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
            });
        });
    });

    describe('Netflix More Like This surfaces', () => {
        let surfaceManager: SurfaceManager;
        let overlayRenderer: OverlayRenderer;

        beforeEach(() => {
            surfaceManager = new SurfaceManager(buildLogger().build(), NETFLIX_SURFACES);
            overlayRenderer = buildRenderer(new NetflixService());
        });

        function attachOverlay(surface: DiscoveredSurface): void {
            if (overlayRenderer.hasOverlay(surface.container)) return;
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
        }

        it('decorates collapsed and expanded More Like This tiles once', () => {
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
});
