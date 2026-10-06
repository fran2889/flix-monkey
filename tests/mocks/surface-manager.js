/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Builds a mock SurfaceManager for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockSurfaceManager() {
    /** @type {import('../../src/core/surfaces/surface-manager.js').SurfaceManager} */
    const mock = {
        discover: vi.fn().mockReturnValue([]),
    };

    return {
        /**
         * Set the discover mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withDiscover(impl) {
            mock.discover.mockImplementation(impl);
            return this;
        },

        /**
         * Set the discover mock to return a specific value.
         * @param {import('../../src/types/surfaces.js').DiscoveredSurface[]} value
         * @returns {Object} Builder for chaining
         */
        withDiscoverReturning(value) {
            mock.discover.mockReturnValue(value);
            return this;
        },

        /**
         * Set the discover mock to return an empty array.
         * @returns {Object} Builder for chaining
         */
        withDiscoverReturningEmpty() {
            mock.discover.mockReturnValue([]);
            return this;
        },

        /**
         * @returns {import('../../src/core/surfaces/surface-manager.js').SurfaceManager} Mock SurfaceManager
         */
        build() {
            return mock;
        },
    };
}

// Static presets
buildMockSurfaceManager.empty = () => {
    return buildMockSurfaceManager().withDiscoverReturningEmpty().build();
};

buildMockSurfaceManager.withSingleSurface = (
    surface = { container: document.createElement('div'), title: 'Test Title', fadeable: false, showFadeToggle: false }
) => {
    return buildMockSurfaceManager().withDiscoverReturning([surface]).build();
};

buildMockSurfaceManager.withMultipleSurfaces = surfaces => {
    return buildMockSurfaceManager().withDiscoverReturning(surfaces).build();
};

export { buildMockSurfaceManager };
