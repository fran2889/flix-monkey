/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

import { PlatformAdapter } from '../../src/platform/adapter.js';

class MockPlatformAdapter extends PlatformAdapter {
    constructor({ ...rest } = {}) {
        super();
        Object.assign(this, rest);
    }
}

function buildMockAdapter() {
    // Store configuration instead of applying directly to adapter
    const overrides = {};

    return {
        withStorageGetResolvingTo(value) {
            overrides.storageGet = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withStorageGetRejectingWith(error) {
            overrides.storageGet = vi.fn().mockRejectedValue(error);
            return this;
        },

        withStorageSetResolvingTo(value) {
            overrides.storageSet = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withStorageSetRejectingWith(error) {
            overrides.storageSet = vi.fn().mockRejectedValue(error);
            return this;
        },

        withStorageDeleteResolvingTo(value) {
            overrides.storageDelete = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withStorageDeleteRejectingWith(error) {
            overrides.storageDelete = vi.fn().mockRejectedValue(error);
            return this;
        },

        withStorageGetKeysResolvingTo(value) {
            overrides.storageGetKeys = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withStorageGetAllResolvingTo(value) {
            overrides.storageGetAll = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withStorageSetManyResolvingTo(value) {
            overrides.storageSetMany = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withHttpFetchResolvingTo(value) {
            overrides.httpFetch = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
            return this;
        },

        withHttpFetchResolvingToOnce(value) {
            overrides.httpFetch = overrides.httpFetch || vi.fn();
            overrides.httpFetch.mockResolvedValueOnce(value);
            return this;
        },

        withHttpFetchRejectingWith(error) {
            overrides.httpFetch = vi.fn().mockRejectedValue(error);
            return this;
        },

        withConfigGetReturning(valueOrFn) {
            if (typeof valueOrFn === 'function') {
                overrides.configGet = vi.fn().mockImplementation(valueOrFn);
            } else {
                overrides.configGet = vi.fn().mockReturnValue(valueOrFn);
            }
            return this;
        },

        build() {
            const adapter = new MockPlatformAdapter();

            // Apply all stored overrides to the adapter
            Object.assign(adapter, {
                httpFetch: vi.fn().mockResolvedValue({}),
                storageGet: vi.fn().mockResolvedValue(null),
                storageSet: vi.fn().mockResolvedValue(undefined),
                storageDelete: vi.fn().mockResolvedValue(undefined),
                storageGetKeys: vi.fn().mockResolvedValue([]),
                storageGetAll: vi.fn().mockResolvedValue({}),
                storageSetMany: vi.fn().mockResolvedValue(undefined),
                configGet: vi.fn(() => undefined),
                ...overrides,
            });

            return adapter;
        },
    };
}

// Static presets
buildMockAdapter.cacheMiss = () => {
    return buildMockAdapter()
        .withStorageGetResolvingTo(null)
        .withStorageGetAllResolvingTo({})
        .withStorageGetKeysResolvingTo([])
        .build();
};

buildMockAdapter.storageSuccess = () => {
    return buildMockAdapter()
        .withStorageGetResolvingTo(null)
        .withStorageSetResolvingTo(undefined)
        .withStorageDeleteResolvingTo(undefined)
        .withStorageGetKeysResolvingTo([])
        .withStorageGetAllResolvingTo({})
        .withStorageSetManyResolvingTo(undefined)
        .build();
};

buildMockAdapter.httpSuccess = response => {
    return buildMockAdapter().withHttpFetchResolvingTo(response).build();
};

buildMockAdapter.httpRateLimited = () => {
    const error = new Error('Rate limited');
    error.status = 429;
    return buildMockAdapter().withHttpFetchRejectingWith(error).build();
};

buildMockAdapter.httpNetworkError = () => {
    return buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();
};

// Parametrized presets
buildMockAdapter.withHttpError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return buildMockAdapter().withHttpFetchRejectingWith(error).build();
};

buildMockAdapter.withStorageError = () => {
    return buildMockAdapter()
        .withStorageGetRejectingWith(new Error('Storage error'))
        .withStorageSetRejectingWith(new Error('Storage error'))
        .withStorageDeleteRejectingWith(new Error('Storage error'))
        .build();
};

export { buildMockAdapter };
