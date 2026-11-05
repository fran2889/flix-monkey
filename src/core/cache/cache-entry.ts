/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { assertRecord, optionalNumber, optionalString, ParseError, requiredString } from '../parse-utils';
import { Title, type TitleData } from '../title';

/**
 * Cache entry encapsulating both metadata and API data.
 * Provides clean separation between search keys (displayTitle, imdbId)
 * and API-returned data (Title fields).
 */
export class CacheEntry {
    readonly #displayTitle: string;
    readonly #imdbId: string | undefined;
    readonly #data: TitleData;
    readonly #expires: number | undefined;

    /**
     * Creates an entry from its search keys, serialized data, and expiry.
     *
     * @param displayTitle - Netflix display title (search key)
     * @param imdbId - IMDb ID for short-circuit optimization
     * @param data - Validated title data without displayTitle, as produced by
     *   `Title.toCacheJSON()` or the storage parser.
     * @param expires - Expiry timestamp or undefined for never expires
     */
    constructor(displayTitle: string, imdbId: string | undefined, data: TitleData, expires: number | undefined) {
        this.#displayTitle = displayTitle;
        this.#imdbId = imdbId;
        this.#data = data;
        this.#expires = expires;
    }

    /**
     * Parses a JSON string from storage and returns a validated CacheEntry.
     * Literal nulls from entries written before the null to undefined
     * migration are normalized to undefined. Truncated JSON, non-object JSON,
     * missing required fields, and wrong-typed fields return undefined instead
     * of throwing or producing a partial entry. Unknown fields are dropped like
     * the API response parsers do.
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
     * @returns Hydrated Title.
     */
    getTitle(): Title {
        return new Title({ ...this.#data, displayTitle: this.#displayTitle });
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
        data: TitleData;
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
    return new CacheEntry(
        requiredString(value, 'displayTitle'),
        optionalString(value, 'imdbId'),
        parseTitleData(value['data']),
        optionalNumber(value, 'expires')
    );
}

function parseTitleData(raw: unknown): TitleData {
    assertRecord(raw);
    return {
        apiTitle: optionalString(raw, 'apiTitle'),
        imdbId: optionalString(raw, 'imdbId'),
        year: optionalNumber(raw, 'year'),
        imdbRating: optionalNumber(raw, 'imdbRating'),
        imdbVotes: optionalNumber(raw, 'imdbVotes'),
        rtRating: optionalNumber(raw, 'rtRating'),
        mcRating: optionalNumber(raw, 'mcRating'),
        source: optionalString(raw, 'source'),
        type: optionalString(raw, 'type'),
    };
}
