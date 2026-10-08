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
         * Set the getImdbId mock to resolve with a specific value.
         * @param {string|null} value - The IMDb ID or null
         */
        withGetImdbIdResolving(value) {
            mock.getImdbId.mockResolvedValue(value);
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

export { buildMockIdOverrideManager };
