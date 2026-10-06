/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Builds a mock IdOverrideManager for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockIdOverrideManager() {
    /** @type {import('../../src/core/id-override-manager.js').IdOverrideManager} */
    const mock = {
        getImdbId: vi.fn().mockResolvedValue(null),
        setImdbId: vi.fn().mockResolvedValue(undefined),
    };

    return {
        /**
         * Set the getImdbId mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withGetImdbId(impl) {
            mock.getImdbId.mockImplementation(impl);
            return this;
        },

        /**
         * Set the getImdbId mock to resolve with a specific value.
         * @param {string|null} value - The IMDb ID or null
         * @returns {Object} Builder for chaining
         */
        withGetImdbIdResolving(value) {
            mock.getImdbId.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the setImdbId mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withSetImdbId(impl) {
            mock.setImdbId.mockImplementation(impl);
            return this;
        },

        /**
         * Set the setImdbId mock to resolve with a specific value.
         * @param {*} value
         * @returns {Object} Builder for chaining
         */
        withSetImdbIdResolving(value) {
            mock.setImdbId.mockResolvedValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/id-override-manager.js').IdOverrideManager} Mock IdOverrideManager
         */
        build() {
            return mock;
        },
    };
}

// Static presets
buildMockIdOverrideManager.empty = () => {
    return buildMockIdOverrideManager().build();
};

buildMockIdOverrideManager.withOverride = (displayTitle, imdbId) => {
    return buildMockIdOverrideManager().withGetImdbIdResolving(imdbId).build();
};

buildMockIdOverrideManager.noOverride = () => {
    return buildMockIdOverrideManager().withGetImdbIdResolving(null).build();
};

export { buildMockIdOverrideManager };
