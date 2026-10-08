/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * A partial DisabledClientsManager whose methods are vitest mocks.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/disabled-clients.js').DisabledClientsManager> & {
 *   isDisabled: import('vitest').Mock,
 *   disable: import('vitest').Mock,
 *   resetAll: import('vitest').Mock
 * }} MockDisabledClientsManager
 */

/**
 * Builds a mock DisabledClientsManager for testing.
 */
function buildMockDisabledClientsManager() {
    /** @type {MockDisabledClientsManager} */
    const mock = {
        // Left bare so notDisabled() is the single way to ask for a client that
        // is not locked out, rather than one spelling sharing a hidden default.
        isDisabled: vi.fn(),
        disable: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue([]),
    };

    return {
        /**
         * Set the isDisabled mock to resolve with a specific value.
         * @param {boolean} value
         */
        withIsDisabledResolving(value) {
            mock.isDisabled.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the disable mock to resolve with a specific value.
         * @param {void} value
         */
        withDisableResolving(value) {
            mock.disable.mockResolvedValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/disabled-clients.js').DisabledClientsManager} Mock DisabledClientsManager
         */
        build() {
            return /** @type {import('../../src/core/disabled-clients.js').DisabledClientsManager} */ (
                /** @type {unknown} */ (mock)
            );
        },
    };
}

// Static presets
buildMockDisabledClientsManager.notDisabled = () => {
    return buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
};

export { buildMockDisabledClientsManager };
