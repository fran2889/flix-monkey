/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { OverlayRenderer } from '../../../src/core/overlay.js';
import { buildConfig } from '../../mocks/config.js';
import { buildTitle } from '../../mocks/title.js';

describe('OverlayRenderer', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    /** Injects an overlay with the action handlers and display title the signature requires. */
    const injectOverlay = (renderer, container, title) =>
        renderer.injectOverlay(
            container,
            title,
            null,
            null,
            () => {},
            () => {},
            title.displayTitle ?? 'Test Title'
        );

    describe('style injection', () => {
        it('injects styles into document head', () => {
            const renderer = new OverlayRenderer(buildConfig().build());

            renderer.injectStyles();

            const style = document.head.querySelector('style');
            expect(style).not.toBeNull();
            expect(style.id).toBe('fm-overlay-styles');
        });

        it('injects styles only once per instance', () => {
            const renderer = new OverlayRenderer(buildConfig().build());

            renderer.injectStyles();
            renderer.injectStyles();

            expect(document.head.querySelectorAll('style')).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles')).not.toBeNull();
        });

        it('updates the existing style tag when injectStyles is called again', () => {
            const rendererA = new OverlayRenderer(buildConfig().withOverlayCorner('top-left').build());
            const rendererB = new OverlayRenderer(buildConfig().withOverlayCorner('top-right').build());

            rendererA.injectStyles();
            const existingStyle = document.head.querySelector('#fm-overlay-styles');
            const originalCssText = existingStyle.textContent;
            rendererB.injectStyles();

            expect(document.head.querySelectorAll('style')).toHaveLength(1);
            expect(document.head.querySelector('#fm-overlay-styles')).toBe(existingStyle);
            expect(existingStyle.textContent).not.toBe(originalCssText);
        });
    });

    describe('overlay lifecycle', () => {
        it('replaces an existing overlay and marks the container as injected', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');

            injectOverlay(renderer, container, buildTitle().withImdbId('tt1').withImdbRating(7).build());
            const firstOverlay = container.querySelector('.fm-rating-overlay');
            injectOverlay(renderer, container, buildTitle().withImdbId('tt2').withImdbRating(8).build());

            expect(container.querySelectorAll('.fm-rating-overlay')).toHaveLength(1);
            expect(container.querySelector('.fm-rating-overlay')).not.toBe(firstOverlay);
            expect(renderer.hasOverlay(container)).toBe(true);
        });

        it('replaces a loading overlay with a completed overlay', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');

            renderer.injectLoadingOverlay(container, 'The Matrix');
            injectOverlay(renderer, container, buildTitle().withImdbId('tt1234567').withImdbRating(8.5).build());

            expect(container.querySelector('.fm-loading')).toBeNull();
            expect(renderer.isLoading(container)).toBe(false);
            expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
            expect(renderer.hasOverlay(container)).toBe(true);
        });
    });

    describe('loading lifecycle', () => {
        it('tracks a loading overlay after injection', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');

            renderer.injectLoadingOverlay(container, 'The Matrix');

            expect(container.querySelector('.fm-loading')).not.toBeNull();
            expect(renderer.isLoading(container)).toBe(true);
        });

        it('links the loading overlay to an IMDb search for the display title', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');

            renderer.injectLoadingOverlay(container, 'The Matrix');

            expect(container.querySelector('.fm-loading a').href).toBe('https://www.imdb.com/find/?q=The%20Matrix');
        });

        it('removes a loading overlay', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');

            renderer.injectLoadingOverlay(container, 'The Matrix');
            renderer.removeLoadingOverlay(container);

            expect(container.querySelector('.fm-loading')).toBeNull();
            expect(renderer.isLoading(container)).toBe(false);
        });
    });

    describe('fade', () => {
        it('adds fm-faded class when shouldFade is true', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');

            renderer.applyFade(container, true);

            expect(container.classList.contains('fm-faded')).toBe(true);
        });

        it('removes fm-faded class when shouldFade is false', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');
            container.classList.add('fm-faded');

            renderer.applyFade(container, false);

            expect(container.classList.contains('fm-faded')).toBe(false);
        });
    });

    describe('container positioning', () => {
        it('ensures container has non-static position', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');
            container.style.position = 'static';

            renderer.ensureRelative(container);

            expect(container.style.position).toBe('relative');
        });

        it('does not change position if already non-static', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');
            container.style.position = 'absolute';

            renderer.ensureRelative(container);

            expect(container.style.position).toBe('absolute');
        });
    });

    describe('clear overlays', () => {
        it('removes all overlay elements from the document', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            document.body.innerHTML =
                '<div class="fm-rating-overlay"></div>' +
                '<div class="fm-rating-overlay"></div>' +
                '<div class="other"></div>';

            renderer.clearAllOverlays();

            expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(0);
            expect(document.querySelectorAll('.other')).toHaveLength(1);
        });

        it('removes the injected marker from overlay parents', () => {
            const renderer = new OverlayRenderer(buildConfig().build());
            const container = document.createElement('div');
            document.body.appendChild(container);
            injectOverlay(renderer, container, buildTitle().withApiTitle('Test').withImdbRating(7.5).build());

            renderer.clearAllOverlays();

            expect(renderer.hasOverlay(container)).toBe(false);
        });
    });
});
