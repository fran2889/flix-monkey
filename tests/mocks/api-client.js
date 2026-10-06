/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

import { ApiSource } from '../../src/core/constants.js';

/**
 * Builds a mock API client for testing.
 * @returns {Object} Builder with chainable methods
 */
function buildMockApiClient() {
    /** @type {import('../../src/core/api/base-api-client.js').BaseApiClient} */
    const mock = {
        source: ApiSource.AGREGARR,
        getStatus: vi.fn(),
        fetch: vi.fn(),
        disable: vi.fn(),
    };

    return {
        /**
         * Set the source for this client.
         * @param {import('../../src/core/constants.js').ApiSourceValue} value
         * @returns {Object} Builder for chaining
         */
        withSource(value) {
            mock.source = value;
            return this;
        },

        /**
         * Set the getStatus mock to resolve with a specific value.
         * @param {import('../../src/types/api.js').ClientStatus} value
         * @returns {Object} Builder for chaining
         */
        withStatusResolving(value) {
            mock.getStatus.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the fetch mock to resolve with a specific value.
         * @param {import('../../src/core/title.js').Title|null} value
         * @returns {Object} Builder for chaining
         */
        withFetchResolving(value) {
            mock.fetch.mockResolvedValue(value);
            return this;
        },

        /**
         * Set the fetch mock to reject with a specific error.
         * @param {Error} error
         * @returns {Object} Builder for chaining
         */
        withFetchRejecting(error) {
            mock.fetch.mockRejectedValue(error);
            return this;
        },

        /**
         * Set the disable mock to resolve.
         * @returns {Object} Builder for chaining
         */
        withDisableResolving() {
            mock.disable.mockResolvedValue(undefined);
            return this;
        },

        /**
         * @returns {import('../../src/core/api/base-api-client.js').BaseApiClient} Mock API client
         */
        build() {
            return mock;
        },
    };
}

// Static presets
buildMockApiClient.healthy = () => {
    return buildMockApiClient()
        .withSource(ApiSource.AGREGARR)
        .withStatusResolving({ healthy: true })
        .withDisableResolving()
        .build();
};

buildMockApiClient.unhealthy = () => {
    return buildMockApiClient()
        .withSource(ApiSource.AGREGARR)
        .withStatusResolving({ healthy: false, reason: 'Temporarily disabled' })
        .withDisableResolving()
        .build();
};

buildMockApiClient.withFetchResult = result => {
    return buildMockApiClient()
        .withSource(ApiSource.AGREGARR)
        .withStatusResolving({ healthy: true })
        .withFetchResolving(result)
        .withDisableResolving()
        .build();
};

buildMockApiClient.withFetchError = error => {
    return buildMockApiClient()
        .withSource(ApiSource.AGREGARR)
        .withStatusResolving({ healthy: true })
        .withFetchRejecting(error)
        .withDisableResolving()
        .build();
};

// Presets for specific sources
buildMockApiClient.xmdb = () => {
    return buildMockApiClient().withSource(ApiSource.XMDB).withStatusResolving({ healthy: true }).build();
};

buildMockApiClient.omdb = () => {
    return buildMockApiClient().withSource(ApiSource.OMDB).withStatusResolving({ healthy: true }).build();
};

buildMockApiClient.agregarr = () => {
    return buildMockApiClient().withSource(ApiSource.AGREGARR).withStatusResolving({ healthy: true }).build();
};

export { buildMockApiClient };
