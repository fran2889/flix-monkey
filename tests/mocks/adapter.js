/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

import { PlatformAdapter } from '../../src/platform/adapter.js';

class MockPlatformAdapter extends PlatformAdapter {
    constructor({ configGet, ...rest } = {}) {
        super();
        this.configGet = vi.fn(configGet ?? (() => undefined));
        Object.assign(this, rest);
    }
}

function buildMockAdapter() {
    const adapter = new MockPlatformAdapter();
    adapter.httpFetch = vi.fn().mockResolvedValue({});
    adapter.storageGet = vi.fn().mockResolvedValue(null);
    adapter.storageSet = vi.fn().mockResolvedValue(undefined);
    adapter.storageDelete = vi.fn().mockResolvedValue(undefined);
    adapter.storageGetKeys = vi.fn().mockResolvedValue([]);
    adapter.storageGetAll = vi.fn().mockResolvedValue({});
    adapter.storageSetMany = vi.fn().mockResolvedValue(undefined);

    adapter.withStorageGetResolvingTo = value => {
        adapter.storageGet = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withStorageGetRejectingWith = error => {
        adapter.storageGet = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withStorageSetResolvingTo = value => {
        adapter.storageSet = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withStorageSetRejectingWith = error => {
        adapter.storageSet = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withStorageDeleteResolvingTo = value => {
        adapter.storageDelete = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withStorageDeleteRejectingWith = error => {
        adapter.storageDelete = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withStorageGetKeysResolvingTo = value => {
        adapter.storageGetKeys = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withStorageGetKeysRejectingWith = error => {
        adapter.storageGetKeys = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withStorageGetAllResolvingTo = value => {
        adapter.storageGetAll = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withStorageGetAllRejectingWith = error => {
        adapter.storageGetAll = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withStorageSetManyResolvingTo = value => {
        adapter.storageSetMany = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withStorageSetManyRejectingWith = error => {
        adapter.storageSetMany = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withHttpFetchResolvingTo = value => {
        adapter.httpFetch = typeof value === 'function' ? value : vi.fn().mockResolvedValue(value);
        return adapter;
    };

    adapter.withHttpFetchResolvingToOnce = value => {
        if (!adapter.httpFetch) {
            adapter.httpFetch = vi.fn();
        }
        adapter.httpFetch.mockResolvedValueOnce(value);
        return adapter;
    };

    adapter.withHttpFetchRejectingWith = error => {
        adapter.httpFetch = vi.fn().mockRejectedValue(error);
        return adapter;
    };

    adapter.withHttpFetchRejectingWithOnce = error => {
        if (!adapter.httpFetch) {
            adapter.httpFetch = vi.fn();
        }
        adapter.httpFetch.mockRejectedValueOnce(error);
        return adapter;
    };

    adapter.withConfigGetReturning = valueOrFn => {
        if (typeof valueOrFn === 'function') {
            adapter.configGet = vi.fn().mockImplementation(valueOrFn);
        } else {
            adapter.configGet = vi.fn().mockReturnValue(valueOrFn);
        }
        return adapter;
    };

    adapter.build = () => adapter;

    return adapter;
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

// Backward compatibility
export function createMockAdapter(overrides = {}) {
    const adapter = buildMockAdapter();
    if (overrides.configGet) {
        adapter.withConfigGetReturning(overrides.configGet);
    }
    if (overrides.httpFetch) {
        adapter.withHttpFetchResolvingTo(overrides.httpFetch);
    }
    if (overrides.storageGet) {
        adapter.withStorageGetResolvingTo(overrides.storageGet);
    }
    if (overrides.storageSet) {
        adapter.withStorageSetResolvingTo(overrides.storageSet);
    }
    if (overrides.storageDelete) {
        adapter.withStorageDeleteResolvingTo(overrides.storageDelete);
    }
    if (overrides.storageGetKeys) {
        adapter.withStorageGetKeysResolvingTo(overrides.storageGetKeys);
    }
    if (overrides.storageGetAll) {
        adapter.withStorageGetAllResolvingTo(overrides.storageGetAll);
    }
    if (overrides.storageSetMany) {
        adapter.withStorageSetManyResolvingTo(overrides.storageSetMany);
    }
    return adapter.build();
}

export { buildMockAdapter };
