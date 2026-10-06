/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Builds a mock CacheManager for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockCacheManager() {
    /** @type {import('../../src/core/cache/cache-manager.js').CacheManager} */
    const mock = {
        read: vi.fn(),
        write: vi.fn(),
    };

    return {
        /**
         * Set the read mock to resolve with a specific value.
         * @param {import('../../src/core/cache/cache-entry.js').CacheEntry|null} value
         * @returns {Object} Builder for chaining
         */
        withReadResolving(value) {
            mock.read.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the write mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withWriteMock(impl) {
            mock.write.mockImplementation(impl);
            return this;
        },

        /**
         * @returns {import('../../src/core/cache/cache-manager.js').CacheManager} Mock CacheManager
         */
        build() {
            return mock;
        },
    };
}

// Static presets
buildMockCacheManager.empty = () => {
    return buildMockCacheManager().withReadResolving(null).build();
};

buildMockCacheManager.withEntry = entry => {
    return buildMockCacheManager().withReadResolving(entry).build();
};

export { buildMockCacheManager };
