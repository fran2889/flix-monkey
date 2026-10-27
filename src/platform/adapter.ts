/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type StorageValue = string | boolean;

/** Options for a platform HTTP fetch. */
export interface HttpFetchOptions {
    responseType?: 'json' | 'text';
    timeout?: number;
}

/**
 * Abstract base class for platform adapters.
 *
 * Subclasses must implement every abstract member. Optional methods default to
 * no-ops and may be overridden where the platform supports them.
 */
export abstract class PlatformAdapter {
    /**
     * Retrieves a single value from platform storage.
     *
     * @param key - Storage key.
     * @returns The stored value, or `undefined` if the key does not exist.
     */
    abstract storageGet(key: string): Promise<StorageValue | undefined>;

    /**
     * Retrieves all key/value pairs from platform storage.
     *
     * @returns All stored entries.
     */
    abstract storageGetAll(): Promise<Record<string, StorageValue>>;

    /**
     * Stores a single key/value pair in platform storage.
     *
     * @param key - Storage key.
     * @param value - Value to store.
     * @returns Resolves when the value is stored.
     */
    abstract storageSet(key: string, value: StorageValue): Promise<void>;

    /**
     * Stores multiple key/value pairs atomically in platform storage.
     *
     * @param values - Object of key/value pairs to store.
     * @returns Resolves when all values are stored.
     */
    abstract storageSetMany(values: Record<string, StorageValue>): Promise<void>;

    /**
     * Removes a single key from platform storage.
     *
     * @param key - Storage key to delete.
     * @returns Resolves when the value is removed.
     */
    abstract storageDelete(key: string): Promise<void>;

    /**
     * Returns all storage keys that start with the given prefix.
     *
     * @param prefix - Key prefix to match.
     * @returns Matching keys.
     */
    abstract storageGetKeys(prefix: string): Promise<string[]>;

    /**
     * Makes an HTTP request through the platform's CORS-capable transport.
     * Platform HTTP failures reported by implementations reject with a
     * `FlixMonkeyError` that includes request failure details.
     *
     * @param url - Request URL.
     * @param options - Fetch options.
     * @returns Parsed response body (JSON object or string, depending on `responseType`).
     */
    abstract httpFetch(url: string, options?: HttpFetchOptions): Promise<unknown>;

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
     * @param key - Config key (one of the keys defined in `CONFIG_FIELDS`).
     * @returns The current config value, or `undefined` if absent.
     */
    abstract configGet(key: string): string | boolean | undefined;

    /**
     * Registers a platform menu command. UserscriptAdapter overrides this; other adapters do nothing.
     *
     * @param _label - Menu label shown to the user.
     * @param _fn - Callback invoked when the command is selected.
     */
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
