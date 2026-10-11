/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { FlixMonkeyError } from '../core/utils/index';

export type StorageValue = string | boolean;

export interface HttpFetchOptions {
    responseType?: 'json' | 'text';
    timeout?: number;
}

/**
 * Abstract base class for platform adapters.
 *
 * Subclasses must implement all methods. Optional methods default to
 * no-ops and may be overridden where the platform supports them.
 *
 * In JavaScript this was a concrete class with throwing methods.
 * In TypeScript we maintain the same behavior for backward compatibility
 * with existing tests.
 */
export class PlatformAdapter {
    /**
     * Retrieves a single value from platform storage.
     *
     * @param _key - Storage key.
     * @returns The stored value, or `null` if the key does not exist.
     */
    async storageGet(_key: string): Promise<StorageValue | null> {
        throw new FlixMonkeyError('PlatformAdapter: storageGet() must be implemented by subclass');
    }

    /**
     * Retrieves all key/value pairs from platform storage.
     *
     * @returns All stored entries.
     */
    async storageGetAll(): Promise<Record<string, StorageValue>> {
        throw new FlixMonkeyError('PlatformAdapter: storageGetAll() must be implemented by subclass');
    }

    /**
     * Stores a single key/value pair in platform storage.
     *
     * @param _key - Storage key.
     * @param _value - Value to store.
     * @returns {Promise<void>}
     */
    async storageSet(_key: string, _value: StorageValue): Promise<void> {
        throw new FlixMonkeyError('PlatformAdapter: storageSet() must be implemented by subclass');
    }

    /**
     * Stores multiple key/value pairs atomically in platform storage.
     *
     * @param _values - Object of key/value pairs to store.
     * @returns {Promise<void>}
     */
    async storageSetMany(_values: Record<string, StorageValue>): Promise<void> {
        throw new FlixMonkeyError('PlatformAdapter: storageSetMany() must be implemented by subclass');
    }

    /**
     * Removes a single key from platform storage.
     *
     * @param _key - Storage key to delete.
     * @returns {Promise<void>}
     */
    async storageDelete(_key: string): Promise<void> {
        throw new FlixMonkeyError('PlatformAdapter: storageDelete() must be implemented by subclass');
    }

    /**
     * Returns all storage keys that start with the given prefix.
     *
     * @param _prefix - Key prefix to match.
     * @returns Matching keys.
     */
    async storageGetKeys(_prefix: string): Promise<string[]> {
        throw new FlixMonkeyError('PlatformAdapter: storageGetKeys() must be implemented by subclass');
    }

    /**
     * Makes an HTTP request through the platform's CORS-capable transport.
     * Platform HTTP failures reported by implementations reject with a
     * {@link FlixMonkeyError} that includes request failure details.
     *
     * @param _url - Request URL.
     * @param _options - Fetch options.
     * @returns Parsed response body (JSON object or string, depending on `responseType`).
     */
    async httpFetch(_url: string, _options?: HttpFetchOptions): Promise<unknown> {
        throw new FlixMonkeyError('PlatformAdapter: httpFetch() must be implemented by subclass');
    }

    /**
     * Synchronously reads a configuration value.
     *
     * Two reading models are supported by the framework:
     * - **Live reads** (`UserscriptAdapter`): calls storage directly (`GM_getValue`) on every
     *   invocation, so the returned value is always the current persisted value.
     * - **Snapshot reads** (`WebExtensionAdapter`): reads from an in-memory cache seeded by
     *   `setConfigData()` and kept current by a `storage.onChanged` listener. The returned
     *   value is current as of the last storage-change event.
     *
     * `ConfigManager` treats `undefined` as "key absent" and falls back to
     * `CONFIG_DEFAULTS`.
     *
     * @param _key - Config key (one of the keys defined in `CONFIG_FIELDS`).
     * @returns The current config value, or `undefined` if absent.
     */
    configGet(_key: string): string | boolean | undefined {
        throw new FlixMonkeyError('PlatformAdapter: configGet() must be implemented by subclass');
    }

    /** Registers a platform menu command. UserscriptAdapter overrides this; other adapters do nothing. */
    registerMenuCommand(_label: string, _fn: () => void): void {
        // No-op by default
    }

    /**
     * Seeds data for snapshot-based adapters before application startup. Live-read
     * adapters leave this as a no-op.
     *
     * @param _data - Config key/value pairs.
     */
    setConfigData(_data: Record<string, StorageValue>): void {
        // overridden in webextension.ts
    }
}
