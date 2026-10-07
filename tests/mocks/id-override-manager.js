/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * A partial IdOverrideManager whose methods are vitest mocks.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/id-override-manager.js').IdOverrideManager> & {
 *   getImdbId: import('vitest').Mock,
 *   setImdbId: import('vitest').Mock
 * }} MockIdOverrideManager
 */

/**
 * Builds a mock IdOverrideManager for testing.
 */
function buildMockIdOverrideManager() {
    /** @type {MockIdOverrideManager} */
    const mock = {
        getImdbId: vi.fn().mockResolvedValue(null),
        setImdbId: vi.fn().mockResolvedValue(undefined),
    };

    return {
        /**
         * Set the getImdbId mock implementation.
         * @param {(displayTitle: string) => Promise<string|null>} impl
         */
        withGetImdbId(impl) {
            mock.getImdbId.mockImplementation(impl);
            return this;
        },

        /**
         * Set the getImdbId mock to resolve with a specific value.
         * @param {string|null} value - The IMDb ID or null
         */
        withGetImdbIdResolving(value) {
            mock.getImdbId.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the setImdbId mock implementation.
         * @param {(displayTitle: string, imdbId: string) => Promise<void>} impl
         */
        withSetImdbId(impl) {
            mock.setImdbId.mockImplementation(impl);
            return this;
        },

        /**
         * Set the setImdbId mock to resolve with a specific value.
         * @param {void} value
         */
        withSetImdbIdResolving(value) {
            mock.setImdbId.mockResolvedValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/id-override-manager.js').IdOverrideManager} Mock IdOverrideManager
         */
        build() {
            return /** @type {import('../../src/core/id-override-manager.js').IdOverrideManager} */ (
                /** @type {unknown} */ (mock)
            );
        },
    };
}

// Static presets
buildMockIdOverrideManager.empty = () => {
    return buildMockIdOverrideManager().build();
};

/**
 * Builds a manager that returns `imdbId` only for the given display title.
 *
 * @param {string} displayTitle - Title the override applies to.
 * @param {string|null} imdbId - IMDb ID returned for that title.
 */
buildMockIdOverrideManager.withOverride = (displayTitle, imdbId) => {
    return buildMockIdOverrideManager()
        .withGetImdbId(title => (title === displayTitle ? imdbId : null))
        .build();
};

buildMockIdOverrideManager.noOverride = () => {
    return buildMockIdOverrideManager().withGetImdbIdResolving(null).build();
};

export { buildMockIdOverrideManager };
