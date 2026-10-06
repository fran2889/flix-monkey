/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Builds a mock FadeManager for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockFadeManager() {
    /** @type {import('../../src/core/fade-manager.js').FadeManager} */
    const mock = {
        getOverride: vi.fn().mockResolvedValue(null),
        setOverride: vi.fn().mockResolvedValue(undefined),
        shouldFade: vi.fn().mockReturnValue(false),
    };

    return {
        /**
         * Set the getOverride mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withGetOverride(impl) {
            mock.getOverride.mockImplementation(impl);
            return this;
        },

        /**
         * Set the getOverride mock to resolve with a specific value.
         * @param {'always'|'never'|null} value
         * @returns {Object} Builder for chaining
         */
        withGetOverrideResolving(value) {
            mock.getOverride.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the setOverride mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withSetOverride(impl) {
            mock.setOverride.mockImplementation(impl);
            return this;
        },

        /**
         * Set the setOverride mock to resolve with a specific value.
         * @param {*} value
         * @returns {Object} Builder for chaining
         */
        withSetOverrideResolving(value) {
            mock.setOverride.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the shouldFade mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withShouldFade(impl) {
            mock.shouldFade.mockImplementation(impl);
            return this;
        },

        /**
         * Set the shouldFade mock to return a specific value.
         * @param {boolean} value
         * @returns {Object} Builder for chaining
         */
        withShouldFadeReturning(value) {
            mock.shouldFade.mockReturnValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/fade-manager.js').FadeManager} Mock FadeManager
         */
        build() {
            return mock;
        },
    };
}

// Static presets
buildMockFadeManager.empty = () => {
    return buildMockFadeManager().build();
};

buildMockFadeManager.alwaysFade = () => {
    return buildMockFadeManager().withGetOverrideResolving('always').withShouldFadeReturning(true).build();
};

buildMockFadeManager.neverFade = () => {
    return buildMockFadeManager().withGetOverrideResolving('never').withShouldFadeReturning(false).build();
};

buildMockFadeManager.autoFade = () => {
    return buildMockFadeManager().withGetOverrideResolving(null).withShouldFadeReturning(false).build();
};

export { buildMockFadeManager };
