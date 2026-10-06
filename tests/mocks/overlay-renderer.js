/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Builds a mock OverlayRenderer for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockOverlayRenderer() {
    /** @type {import('../../src/core/overlay.js').OverlayRenderer} */
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
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withHasOverlay(impl) {
            mock.hasOverlay.mockImplementation(impl);
            return this;
        },

        /**
         * Set the hasOverlay mock to return a specific value.
         * @param {boolean} value
         * @returns {Object} Builder for chaining
         */
        withHasOverlayReturning(value) {
            mock.hasOverlay.mockReturnValue(value);
            return this;
        },

        /**
         * Set the isLoading mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withIsLoading(impl) {
            mock.isLoading.mockImplementation(impl);
            return this;
        },

        /**
         * Set the isLoading mock to return a specific value.
         * @param {boolean} value
         * @returns {Object} Builder for chaining
         */
        withIsLoadingReturning(value) {
            mock.isLoading.mockReturnValue(value);
            return this;
        },

        /**
         * Set the injectOverlay mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withInjectOverlay(impl) {
            mock.injectOverlay.mockImplementation(impl);
            return this;
        },

        /**
         * Set the removeLoadingOverlay mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withRemoveLoadingOverlay(impl) {
            mock.removeLoadingOverlay.mockImplementation(impl);
            return this;
        },

        /**
         * Set the applyFade mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withApplyFade(impl) {
            mock.applyFade.mockImplementation(impl);
            return this;
        },

        /**
         * Set the clearAllOverlays mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withClearAllOverlays(impl) {
            mock.clearAllOverlays.mockImplementation(impl);
            return this;
        },

        /**
         * @returns {import('../../src/core/overlay.js').OverlayRenderer} Mock OverlayRenderer
         */
        build() {
            return mock;
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
