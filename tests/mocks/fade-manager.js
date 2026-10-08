/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * A partial FadeManager whose methods are vitest mocks.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/fade-manager.js').FadeManager> & {
 *   getOverride: import('vitest').Mock,
 *   setOverride: import('vitest').Mock,
 *   shouldFade: import('vitest').Mock
 * }} MockFadeManager
 */

/**
 * Builds a mock FadeManager for testing.
 */
function buildMockFadeManager() {
    /** @type {MockFadeManager} */
    const mock = {
        getOverride: vi.fn().mockResolvedValue(null),
        setOverride: vi.fn().mockResolvedValue(undefined),
        shouldFade: vi.fn().mockReturnValue(false),
    };

    return {
        /**
         * Set the shouldFade mock to return a specific value.
         * @param {boolean} value
         */
        withShouldFadeReturning(value) {
            mock.shouldFade.mockReturnValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/fade-manager.js').FadeManager} Mock FadeManager
         */
        build() {
            return /** @type {import('../../src/core/fade-manager.js').FadeManager} */ (/** @type {unknown} */ (mock));
        },
    };
}

export { buildMockFadeManager };
