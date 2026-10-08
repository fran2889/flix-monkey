/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

import { ApiSource } from '../../src/core/constants.js';

/**
 * A BaseApiClient double whose methods are vitest mocks.
 *
 * Every public method is provided even though no suite calls queuedFetch,
 * search or getDetails on the double: the mock-completeness suite fails if one
 * goes missing.
 *
 * @typedef {import('./mock-types.js').MockOf<import('../../src/core/api/base-api-client.js').BaseApiClient>} MockApiClient
 */

/**
 * Builds a mock API client for testing.
 */
function buildMockApiClient() {
    /** @type {MockApiClient} */
    const mock = {
        source: ApiSource.AGREGARR,
        getStatus: vi.fn(),
        fetch: vi.fn(),
        disable: vi.fn(),
        queuedFetch: vi.fn(),
        search: vi.fn(),
        getDetails: vi.fn(),
    };

    return {
        /**
         * Set the source for this client.
         * @param {import('../../src/types/title.js').ApiSourceValue} value
         */
        withSource(value) {
            mock.source = value;
            return this;
        },

        /**
         * Set the getStatus mock to resolve with a specific value.
         * @param {import('../../src/types/api.js').ClientStatus} value
         */
        withStatusResolving(value) {
            mock.getStatus.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the fetch mock to resolve with a specific value.
         * @param {import('../../src/core/title.js').Title|null} value
         */
        withFetchResolving(value) {
            mock.fetch.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the fetch mock to reject with a specific error.
         * @param {Error} error
         */
        withFetchRejecting(error) {
            mock.fetch.mockRejectedValue(error);
            return this;
        },

        /**
         * Set the disable mock to resolve.
         */
        withDisableResolving() {
            mock.disable.mockResolvedValue(undefined);
            return this;
        },

        /**
         * @returns {import('../../src/core/api/base-api-client.js').BaseApiClient} Mock API client
         */
        build() {
            return /** @type {import('../../src/core/api/base-api-client.js').BaseApiClient} */ (
                /** @type {unknown} */ (mock)
            );
        },
    };
}
export { buildMockApiClient };
