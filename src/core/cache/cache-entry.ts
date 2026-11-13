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
     * migration are normalized to undefined. Unknown fields are dropped like
     * the API response parsers do.
     *
     * @param raw - Untrusted value read from storage
     * @returns New CacheEntry instance
     * @throws ParseError when the value is not a string or the payload has an
     *   invalid shape
     * @throws SyntaxError when the value is not valid JSON
     */
    static fromJSON(raw: unknown): CacheEntry {
        if (typeof raw !== 'string') throw new ParseError('expected serialized JSON string');
        return parseCacheEntry(JSON.parse(raw));
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
     * Returns a copy that keeps the display title and cached IMDb ID but
     * removes every rating field and the expiry. A retained entry is never a
     * rating cache hit, so the next lookup still fetches fresh data, while its
     * IMDb ID lets that fetch skip the title search.
     *
     * @returns Rating-free entry, or undefined when there is no IMDb ID to keep.
     */
    withoutRatings(): CacheEntry | undefined {
        if (!this.#imdbId) return undefined;
        return new CacheEntry(this.#displayTitle, this.#imdbId, emptyTitleData(), undefined);
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

function emptyTitleData(): TitleData {
    return {
        apiTitle: undefined,
        imdbId: undefined,
        year: undefined,
        imdbRating: undefined,
        imdbVotes: undefined,
        rtRating: undefined,
        mcRating: undefined,
        source: undefined,
        type: undefined,
    };
}

function parseTitleData(raw: unknown): TitleData {
    assertRecord(raw, 'data');
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
