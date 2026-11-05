/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { assertRecord, optionalNumber, optionalString, ParseError, requiredString } from '../parse-utils';
import { Title } from '../title';

const CACHE_ENTRY_KEYS: ReadonlySet<string> = new Set(['displayTitle', 'imdbId', 'data', 'expires']);
const TITLE_STRING_KEYS = ['apiTitle', 'imdbId', 'source', 'type'] as const;
const TITLE_NUMBER_KEYS = ['year', 'imdbRating', 'imdbVotes', 'rtRating', 'mcRating'] as const;
const TITLE_DATA_KEYS: ReadonlySet<string> = new Set([...TITLE_STRING_KEYS, ...TITLE_NUMBER_KEYS]);

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
     * Creates an entry from its search keys, serialized data, and expiry.
     *
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
     * Parses a JSON string from storage and returns a validated CacheEntry.
     * Literal nulls from entries written before the null to undefined
     * migration are normalized to undefined. Truncated JSON, non-object JSON,
     * missing fields, wrong-typed fields, and legacy shapes return undefined
     * instead of throwing or producing a partial entry.
     *
     * @param raw - Untrusted value read from storage
     * @returns New CacheEntry instance, or undefined when the payload is invalid
     */
    static fromJSON(raw: unknown): CacheEntry | undefined {
        if (typeof raw !== 'string') return undefined;

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return undefined;
        }

        try {
            return parseCacheEntry(parsed);
        } catch (error: unknown) {
            if (!(error instanceof ParseError)) throw error;
            return undefined;
        }
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

    get imdbId(): string | undefined {
        return this.#imdbId;
    }

    get isExpired(): boolean {
        return this.#expires !== undefined && Date.now() > this.#expires;
    }
}

function parseCacheEntry(value: unknown): CacheEntry {
    assertRecord(value);
    assertOnlyKeys(value, CACHE_ENTRY_KEYS, 'cache entry');

    const displayTitle = requiredString(value, 'displayTitle');
    const imdbId = optionalString(value, 'imdbId');
    const expires = optionalNumber(value, 'expires');
    const data = value['data'];

    assertRecord(data);
    assertOnlyKeys(data, TITLE_DATA_KEYS, 'title payload');
    for (const key of TITLE_STRING_KEYS) optionalString(data, key);
    for (const key of TITLE_NUMBER_KEYS) optionalNumber(data, key);

    return new CacheEntry(displayTitle, imdbId, data, expires);
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
    const unknownKey = Object.keys(record).find(key => !allowed.has(key));
    if (unknownKey !== undefined) {
        throw new ParseError(`unexpected field "${unknownKey}" in ${label}`);
    }
}
