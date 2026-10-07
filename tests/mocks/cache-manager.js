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
         * Set the write mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withWriteMock(impl) {
            mock.write.mockImplementation(impl);
            return this;
        },

        /**
         * Set the delete mock to resolve with a specific value.
         * @param {*} value
         */
        withDeleteResolving(value) {
            mock.delete.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the delete mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withDeleteMock(impl) {
            mock.delete.mockImplementation(impl);
            return this;
        },

        /**
         * Set the clear mock to resolve with a specific value.
         * @param {*} value
         */
        withClearResolving(value) {
            mock.clear.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the clear mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withClearMock(impl) {
            mock.clear.mockImplementation(impl);
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

// Static presets
buildMockCacheManager.empty = () => {
    return buildMockCacheManager().withReadResolving(null).build();
};

/**
 * @param {import('../../src/core/cache/cache-entry.js').CacheEntry|null} entry
 */
buildMockCacheManager.withEntry = entry => {
    return buildMockCacheManager().withReadResolving(entry).build();
};

export { buildMockCacheManager };
