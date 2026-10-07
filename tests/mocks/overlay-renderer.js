/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * A partial OverlayRenderer whose methods are vitest mocks.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/overlay.js').OverlayRenderer> & {
 *   injectStyles: import('vitest').Mock,
 *   hasOverlay: import('vitest').Mock,
 *   isLoading: import('vitest').Mock,
 *   ensureRelative: import('vitest').Mock,
 *   injectLoadingOverlay: import('vitest').Mock,
 *   injectOverlay: import('vitest').Mock,
 *   removeLoadingOverlay: import('vitest').Mock,
 *   applyFade: import('vitest').Mock,
 *   clearAllOverlays: import('vitest').Mock
 * }} MockOverlayRenderer
 */

/**
 * Builds a mock OverlayRenderer for testing.
 */
function buildMockOverlayRenderer() {
    /** @type {MockOverlayRenderer} */
    const mock = {
        injectStyles: vi.fn(),
        hasOverlay: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
        ensureRelative: vi.fn(),
        injectLoadingOverlay: vi.fn(),
        injectOverlay: vi.fn(),
        removeLoadingOverlay: vi.fn(),
        applyFade: vi.fn(),
        clearAllOverlays: vi.fn(),
    };

    return {
        /**
         * Set the hasOverlay mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withHasOverlay(impl) {
            mock.hasOverlay.mockImplementation(impl);
            return this;
        },

        /**
         * Set the hasOverlay mock to return a specific value.
         * @param {boolean} value
         */
        withHasOverlayReturning(value) {
            mock.hasOverlay.mockReturnValue(value);
            return this;
        },

        /**
         * Set the isLoading mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withIsLoading(impl) {
            mock.isLoading.mockImplementation(impl);
            return this;
        },

        /**
         * Set the isLoading mock to return a specific value.
         * @param {boolean} value
         */
        withIsLoadingReturning(value) {
            mock.isLoading.mockReturnValue(value);
            return this;
        },

        /**
         * Set the injectOverlay mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withInjectOverlay(impl) {
            mock.injectOverlay.mockImplementation(impl);
            return this;
        },

        /**
         * Set the removeLoadingOverlay mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withRemoveLoadingOverlay(impl) {
            mock.removeLoadingOverlay.mockImplementation(impl);
            return this;
        },

        /**
         * Set the applyFade mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withApplyFade(impl) {
            mock.applyFade.mockImplementation(impl);
            return this;
        },

        /**
         * Set the clearAllOverlays mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withClearAllOverlays(impl) {
            mock.clearAllOverlays.mockImplementation(impl);
            return this;
        },

        /**
         * @returns {import('../../src/core/overlay.js').OverlayRenderer} Mock OverlayRenderer
         */
        build() {
            return /** @type {import('../../src/core/overlay.js').OverlayRenderer} */ (/** @type {unknown} */ (mock));
        },
    };
}

// Static presets
buildMockOverlayRenderer.empty = () => {
    return buildMockOverlayRenderer().build();
};

buildMockOverlayRenderer.withNoOverlays = () => {
    return buildMockOverlayRenderer().withHasOverlayReturning(false).withIsLoadingReturning(false).build();
};

export { buildMockOverlayRenderer };
