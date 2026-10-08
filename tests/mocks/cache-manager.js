/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * A partial CacheManager whose methods are vitest mocks.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/cache/cache-manager.js').CacheManager> & {
 *   read: import('vitest').Mock,
 *   write: import('vitest').Mock,
 *   delete: import('vitest').Mock,
 *   clear: import('vitest').Mock
 * }} MockCacheManager
 */

/**
 * Builds a mock CacheManager for testing.
 */
function buildMockCacheManager() {
    /** @type {MockCacheManager} */
    const mock = {
        read: vi.fn(),
        write: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
    };

    return {
        /**
         * Set the read mock to resolve with a specific value.
         * @param {import('../../src/core/cache/cache-entry.js').CacheEntry|null} value
         */
        withReadResolving(value) {
            mock.read.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the delete mock to resolve with a specific value.
         * @param {void} value
         */
        withDeleteResolving(value) {
            mock.delete.mockResolvedValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/cache/cache-manager.js').CacheManager} Mock CacheManager
         */
        build() {
            return /** @type {import('../../src/core/cache/cache-manager.js').CacheManager} */ (
                /** @type {unknown} */ (mock)
            );
        },
    };
}
export { buildMockCacheManager };
