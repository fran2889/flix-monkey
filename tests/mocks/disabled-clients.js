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
        isDisabled: vi.fn().mockResolvedValue(false),
        disable: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue([]),
    };

    return {
        /**
         * Set the isDisabled mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withIsDisabled(impl) {
            mock.isDisabled.mockImplementation(impl);
            return this;
        },

        /**
         * Set the isDisabled mock to resolve with a specific value.
         * @param {boolean} value
         */
        withIsDisabledResolving(value) {
            mock.isDisabled.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the disable mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withDisable(impl) {
            mock.disable.mockImplementation(impl);
            return this;
        },

        /**
         * Set the disable mock to resolve with a specific value.
         * @param {*} value
         */
        withDisableResolving(value) {
            mock.disable.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the resetAll mock implementation.
         * @param {(...args: any[]) => any} impl
         */
        withResetAll(impl) {
            mock.resetAll.mockImplementation(impl);
            return this;
        },

        /**
         * Set the resetAll mock to resolve with a specific value.
         * @param {import('../../src/types/title.js').ApiSourceValue[]} value
         */
        withResetAllResolving(value) {
            mock.resetAll.mockResolvedValue(value);
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
buildMockDisabledClientsManager.disabled = () => {
    return buildMockDisabledClientsManager().withIsDisabledResolving(true).build();
};

buildMockDisabledClientsManager.notDisabled = () => {
    return buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
};

export { buildMockDisabledClientsManager };
