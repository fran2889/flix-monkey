/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Builds a mock DisabledClientsManager for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockDisabledClientsManager() {
    /** @type {import('../../src/core/disabled-clients.js').DisabledClientsManager} */
    const mock = {
        isDisabled: vi.fn().mockResolvedValue(false),
        disable: vi.fn().mockResolvedValue(undefined),
        enable: vi.fn().mockResolvedValue(undefined),
        markDisabled: vi.fn().mockResolvedValue(undefined),
    };

    return {
        /**
         * Set the isDisabled mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withIsDisabled(impl) {
            mock.isDisabled.mockImplementation(impl);
            return this;
        },

        /**
         * Set the isDisabled mock to resolve with a specific value.
         * @param {boolean} value
         * @returns {Object} Builder for chaining
         */
        withIsDisabledResolving(value) {
            mock.isDisabled.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the disable mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withDisable(impl) {
            mock.disable.mockImplementation(impl);
            return this;
        },

        /**
         * Set the disable mock to resolve with a specific value.
         * @param {*} value
         * @returns {Object} Builder for chaining
         */
        withDisableResolving(value) {
            mock.disable.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the enable mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withEnable(impl) {
            mock.enable.mockImplementation(impl);
            return this;
        },

        /**
         * Set the enable mock to resolve with a specific value.
         * @param {*} value
         * @returns {Object} Builder for chaining
         */
        withEnableResolving(value) {
            mock.enable.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the markDisabled mock implementation.
         * @param {Function} impl
         * @returns {Object} Builder for chaining
         */
        withMarkDisabled(impl) {
            mock.markDisabled.mockImplementation(impl);
            return this;
        },

        /**
         * Set the markDisabled mock to resolve with a specific value.
         * @param {*} value
         * @returns {Object} Builder for chaining
         */
        withMarkDisabledResolving(value) {
            mock.markDisabled.mockResolvedValue(value);
            return this;
        },

        /**
         * @returns {import('../../src/core/disabled-clients.js').DisabledClientsManager} Mock DisabledClientsManager
         */
        build() {
            return mock;
        },
    };
}

// Static presets
buildMockDisabledClientsManager.empty = () => {
    return buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
};

buildMockDisabledClientsManager.disabled = () => {
    return buildMockDisabledClientsManager().withIsDisabledResolving(true).build();
};

buildMockDisabledClientsManager.notDisabled = () => {
    return buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
};

export { buildMockDisabledClientsManager };
