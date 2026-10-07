/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * A partial SurfaceManager whose methods are vitest mocks.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/surfaces/surface-manager.js').SurfaceManager> & {
 *   discover: import('vitest').Mock
 * }} MockSurfaceManager
 */

/**
 * Builds a mock SurfaceManager for testing.
 */
function buildMockSurfaceManager() {
    /** @type {MockSurfaceManager} */
    const mock = {
        discover: vi.fn().mockReturnValue([]),
    };

    return {
        /**
         * Set the discover mock implementation.
         * @param {(root: Element|Document) => import('../../src/types/surfaces.js').DiscoveredSurface[]} impl
         */
        withDiscover(impl) {
            mock.discover.mockImplementation(impl);
            return this;
        },

        /**
         * Set the discover mock to return a specific value.
         * @param {import('../../src/types/surfaces.js').DiscoveredSurface[]} value
         */
        withDiscoverReturning(value) {
            mock.discover.mockReturnValue(value);
            return this;
        },

        /**
         * Set the discover mock to return an empty array.
         */
        withDiscoverReturningEmpty() {
            mock.discover.mockReturnValue([]);
            return this;
        },

        /**
         * @returns {import('../../src/core/surfaces/surface-manager.js').SurfaceManager} Mock SurfaceManager
         */
        build() {
            return /** @type {import('../../src/core/surfaces/surface-manager.js').SurfaceManager} */ (
                /** @type {unknown} */ (mock)
            );
        },
    };
}

// Static presets
buildMockSurfaceManager.empty = () => {
    return buildMockSurfaceManager().withDiscoverReturningEmpty().build();
};

/**
 * @param {import('../../src/types/surfaces.js').DiscoveredSurface} [surface] - Surface the manager should discover.
 */
buildMockSurfaceManager.withSingleSurface = (
    surface = { container: document.createElement('div'), title: 'Test Title', fadeable: false, showFadeToggle: false }
) => {
    return buildMockSurfaceManager().withDiscoverReturning([surface]).build();
};

/**
 * @param {import('../../src/types/surfaces.js').DiscoveredSurface[]} surfaces - Surfaces the manager should discover.
 */
buildMockSurfaceManager.withMultipleSurfaces = surfaces => {
    return buildMockSurfaceManager().withDiscoverReturning(surfaces).build();
};

export { buildMockSurfaceManager };
