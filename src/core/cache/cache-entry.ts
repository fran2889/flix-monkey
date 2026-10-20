/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from '../title';

/**
 * Cache entry encapsulating both metadata and API data.
 * Provides clean separation between search keys (displayTitle, imdbId)
 * and API-returned data (Title fields).
 */
export class CacheEntry {
    readonly #displayTitle: string;
    readonly #imdbId: string | undefined;
    readonly #data: unknown;
    readonly #expires: number | undefined;

    /**
     * @param displayTitle - Netflix display title (search key)
     * @param imdbId - IMDb ID for short-circuit optimization
     * @param data - Title data without displayTitle. `CacheManager.write` stores
     *   `Title.toCacheJSON()` output here; entries parsed from storage carry untrusted JSON,
     *   which only {@link CacheEntry.getTitle} may read.
     * @param expires - Expiry timestamp or undefined for never expires
     */
    constructor(displayTitle: string, imdbId: string | undefined, data: unknown, expires: number | undefined) {
        this.#displayTitle = displayTitle;
        this.#imdbId = imdbId;
        this.#data = data;
        this.#expires = expires;
    }

    /**
     * Parses a JSON string from storage and returns a CacheEntry instance.
     * Literal nulls from entries written before the null to undefined
     * migration are normalized to undefined. The payload is stored unvalidated:
     * {@link CacheEntry.getTitle} hands it to `Title.fromCacheJSON`, which owns
     * the check for a well-formed title object.
     *
     * @param raw - Raw JSON string from storage
     * @returns New CacheEntry instance
     */
    static fromJSON(raw: string): CacheEntry {
        const obj = JSON.parse(raw) as {
            displayTitle: string;
            imdbId?: string | null;
            data?: unknown;
            expires?: number | null;
        };
        return new CacheEntry(
            obj.displayTitle,
            obj.imdbId ?? undefined,
            obj.data ?? undefined,
            obj.expires ?? undefined
        );
    }

    /**
     * Combines cached data with entry metadata to create a complete Title object.
     *
     * @returns Hydrated Title, or undefined if data is missing or invalid
     */
    getTitle(): Title | undefined {
        return Title.fromCacheJSON(this.#data, this.#displayTitle);
    }

    /**
     * Converts the cache entry to a plain object suitable for JSON storage.
     * Absent fields are omitted by `JSON.stringify` rather than written as null.
     *
     * @returns Plain object for JSON serialization
     */
    toJSON(): {
        displayTitle: string;
        imdbId: string | undefined;
        data: unknown;
        expires: number | undefined;
    } {
        return {
            displayTitle: this.#displayTitle,
            imdbId: this.#imdbId,
            data: this.#data,
            expires: this.#expires,
        };
    }

    /**
     * @returns The IMDb ID for this cache entry
     */
    get imdbId(): string | undefined {
        return this.#imdbId;
    }

    /**
     * @returns Whether this cache entry has expired
     */
    get isExpired(): boolean {
        return this.#expires !== undefined && Date.now() > this.#expires;
    }
}
