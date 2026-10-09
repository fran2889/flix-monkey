/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Mock, vi } from 'vitest';

import { type HttpFetchOptions, PlatformAdapter, type StorageValue } from '../../src/platform/adapter.js';

// Type for mockable storage methods - compatible with both PlatformAdapter and vi.Mock
type MockableFn<T extends (..._args: never[]) => unknown> = T & Mock;

// Type for mockable storage methods
interface MockStorageMethods {
    storageGet: MockableFn<(_key: string) => Promise<StorageValue | null>>;
    storageGetAll: MockableFn<() => Promise<Record<string, StorageValue>>>;
    storageSet: MockableFn<(_key: string, _value: StorageValue) => Promise<void>>;
    storageSetMany: MockableFn<(_values: Record<string, StorageValue>) => Promise<void>>;
    storageDelete: MockableFn<(_key: string) => Promise<void>>;
    storageGetKeys: MockableFn<(_prefix: string) => Promise<string[]>>;
    httpFetch: MockableFn<(_url: string, _options?: HttpFetchOptions) => Promise<unknown>>;
    configGet: MockableFn<(_key: string) => string | boolean | undefined>;
}

class MockPlatformAdapter extends PlatformAdapter {
    // Override abstract methods with mockable implementations
    storageGet: MockableFn<(_key: string) => Promise<StorageValue | null>>;
    storageGetAll: MockableFn<() => Promise<Record<string, StorageValue>>>;
    storageSet: MockableFn<(_key: string, _value: StorageValue) => Promise<void>>;
    storageSetMany: MockableFn<(_values: Record<string, StorageValue>) => Promise<void>>;
    storageDelete: MockableFn<(_key: string) => Promise<void>>;
    storageGetKeys: MockableFn<(_prefix: string) => Promise<string[]>>;
    httpFetch: MockableFn<(_url: string, _options?: HttpFetchOptions) => Promise<unknown>>;
    configGet: MockableFn<(_key: string) => string | boolean | undefined>;

    constructor({ ...rest }: Partial<MockStorageMethods> = {}) {
        super();
        // Initialize with default mock implementations
        this.storageGet = vi.fn().mockResolvedValue(null);
        this.storageGetAll = vi.fn().mockResolvedValue({});
        this.storageSet = vi.fn().mockResolvedValue(undefined);
        this.storageSetMany = vi.fn().mockResolvedValue(undefined);
        this.storageDelete = vi.fn().mockResolvedValue(undefined);
        this.storageGetKeys = vi.fn().mockResolvedValue([]);
        this.httpFetch = vi.fn().mockResolvedValue({});
        this.configGet = vi.fn(() => undefined);

        // Apply overrides
        Object.assign(this, rest);
    }
}

function buildMockAdapter() {
    // Store configuration instead of applying directly to adapter
    const overrides: Partial<MockStorageMethods> = {};

    return {
        withStorageGetResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.storageGet = value as MockableFn<(_key: string) => Promise<StorageValue | null>>;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.storageGet = mockFn;
            }
            return this;
        },

        withStorageGetRejectingWith(error: unknown) {
            const mockFn = vi.fn().mockRejectedValue(error);
            overrides.storageGet = mockFn;
            return this;
        },

        withStorageSetResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.storageSet = value as MockableFn<(_key: string, _value: StorageValue) => Promise<void>>;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.storageSet = mockFn;
            }
            return this;
        },

        withStorageSetRejectingWith(error: unknown) {
            const mockFn = vi.fn().mockRejectedValue(error);
            overrides.storageSet = mockFn;
            return this;
        },

        withStorageDeleteResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.storageDelete = value as MockableFn<(_key: string) => Promise<void>>;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.storageDelete = mockFn;
            }
            return this;
        },

        withStorageDeleteRejectingWith(error: unknown) {
            const mockFn = vi.fn().mockRejectedValue(error);
            overrides.storageDelete = mockFn;
            return this;
        },

        withStorageGetKeysResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.storageGetKeys = value as MockableFn<(_prefix: string) => Promise<string[]>>;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.storageGetKeys = mockFn;
            }
            return this;
        },

        withStorageGetAllResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.storageGetAll = value as MockableFn<() => Promise<Record<string, StorageValue>>>;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.storageGetAll = mockFn;
            }
            return this;
        },

        withStorageSetManyResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.storageSetMany = value as MockableFn<
                    (_values: Record<string, StorageValue>) => Promise<void>
                >;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.storageSetMany = mockFn;
            }
            return this;
        },

        withHttpFetchResolvingTo(value: unknown) {
            const mockFn = vi.fn();
            if (typeof value === 'function') {
                overrides.httpFetch = value as MockableFn<
                    (_url: string, _options?: HttpFetchOptions) => Promise<unknown>
                >;
            } else {
                mockFn.mockResolvedValue(value);
                overrides.httpFetch = mockFn;
            }
            return this;
        },

        withHttpFetchResolvingToOnce(value: unknown) {
            overrides.httpFetch = overrides.httpFetch || vi.fn();
            (overrides.httpFetch as Mock).mockResolvedValueOnce(value);
            return this;
        },

        withHttpFetchRejectingWith(error: unknown) {
            const mockFn = vi.fn().mockRejectedValue(error);
            overrides.httpFetch = mockFn;
            return this;
        },

        withConfigGetReturning(valueOrFn: unknown) {
            const mockFn = vi.fn();
            if (typeof valueOrFn === 'function') {
                mockFn.mockImplementation(valueOrFn as (_key: string) => string | boolean | undefined);
            } else {
                mockFn.mockReturnValue(valueOrFn);
            }
            overrides.configGet = mockFn;
            return this;
        },

        build(): MockPlatformAdapter {
            const adapter = new MockPlatformAdapter();

            // Apply all stored overrides to the adapter
            Object.assign(adapter, overrides);

            return adapter;
        },
    };
}

// Static presets
buildMockAdapter.cacheMiss = (): MockPlatformAdapter => {
    return buildMockAdapter()
        .withStorageGetResolvingTo(null)
        .withStorageGetAllResolvingTo({})
        .withStorageGetKeysResolvingTo([])
        .build();
};

buildMockAdapter.storageSuccess = (): MockPlatformAdapter => {
    return buildMockAdapter()
        .withStorageGetResolvingTo(null)
        .withStorageSetResolvingTo(undefined)
        .withStorageDeleteResolvingTo(undefined)
        .withStorageGetKeysResolvingTo([])
        .withStorageGetAllResolvingTo({})
        .withStorageSetManyResolvingTo(undefined)
        .build();
};

buildMockAdapter.httpSuccess = (response: unknown): MockPlatformAdapter => {
    return buildMockAdapter().withHttpFetchResolvingTo(response).build();
};

buildMockAdapter.httpRateLimited = (): MockPlatformAdapter => {
    const error = new Error('Rate limited');
    (error as { status?: number }).status = 429;
    return buildMockAdapter().withHttpFetchRejectingWith(error).build();
};

buildMockAdapter.httpNetworkError = (): MockPlatformAdapter => {
    return buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();
};

// Parametrized presets
buildMockAdapter.withHttpError = (status: number, message: string): MockPlatformAdapter => {
    const error = new Error(message);
    (error as { status?: number }).status = status;
    return buildMockAdapter().withHttpFetchRejectingWith(error).build();
};

buildMockAdapter.withStorageError = (): MockPlatformAdapter => {
    return buildMockAdapter()
        .withStorageGetRejectingWith(new Error('Storage error'))
        .withStorageSetRejectingWith(new Error('Storage error'))
        .withStorageDeleteRejectingWith(new Error('Storage error'))
        .build();
};

export { buildMockAdapter };

export type { MockPlatformAdapter };
