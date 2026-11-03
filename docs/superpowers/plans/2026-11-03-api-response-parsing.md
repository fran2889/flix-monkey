# API Response Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Decoded<T>` with throwing `ParseError` parsers and route every API client request through one `fetchParsed` entry point.

**Architecture:** `parse-utils.ts` provides throwing field readers plus `parseValidItems` and `parseRequiredItems`. `BaseApiClient.fetchParsed` fetches through the queue, runs a parser, catches only `ParseError`, logs one warning, and returns `undefined`; anything else rethrows. Each client moves to `parse*` functions and keeps only its no-results logging.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-03-api-response-parsing-design.md`

## Global Constraints

- `strict` and `exactOptionalPropertyTypes` are enabled. Optional fields written by parsers use `| undefined`.
- ESLint complexity is capped at 10 and `max-params` at 4. Do not add disable comments.
- Private members use `#`. Do not introduce `protected`.
- Every exported declaration needs JSDoc with `@param` and `@returns` where applicable. Every `{src,tests}/**/*.ts` file starts with the SPDX header.
- Imports are sorted, output is ASCII only, and prose uses no em-dashes.
- No new dependencies.
- Unit tests use adapter mocks. No live API calls.
- `ParseError` extends `Error`, not `FlixMonkeyError`.
- Final state: `fetchParsed` public, `#queuedFetch` private, no `queuedFetch`, no `decode-utils.ts`.
- Use Conventional Commits, one commit per task.

## Review Focus

- A non-record body (null, array, string) at the response or item level is logged or dropped, never an uncaught `TypeError`.
- A non-`ParseError` thrown by a parser propagates to `ApiClientManager` instead of being swallowed as malformed.
- A valid not-found payload (`Response: 'False'`, an XMDb `error` field, empty results) returns `undefined` without a malformed warning.
- A malformed array item is dropped while valid siblings survive.
- An absent or null optional field becomes `undefined`; a wrong-typed optional field fails the response.

---

### Task 1: Add throwing parsers in `parse-utils.ts`

**Files:**

- Create: `src/core/api/parse-utils.ts`
- Test: `tests/unit/core/api/parse-utils.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:

    ```ts
    export class ParseError extends Error
    export function assertRecord(value: unknown): asserts value is Record<string, unknown>
    export function requiredString(record: Record<string, unknown>, key: string): string
    export function optionalString(record: Record<string, unknown>, key: string): string | undefined
    export function optionalNumber(record: Record<string, unknown>, key: string): number | undefined
    export function optionalArray(record: Record<string, unknown>, key: string): unknown[] | undefined
    export function parseValidItems<T>(values: unknown[], parseItem: (_value: unknown) => T): T[]
    export function parseRequiredItems<T>(values: unknown[], parseItem: (_value: unknown) => T, label: string): T[]
    ```

- [x] **Step 1: Write the failing tests**

Create `tests/unit/core/api/parse-utils.test.ts` with the SPDX header and these tests:

```ts
import { describe, expect, it } from 'vitest';

import {
    assertRecord,
    optionalArray,
    optionalNumber,
    optionalString,
    parseValidItems,
    ParseError,
    requiredString,
} from '../../../../src/core/api/parse-utils';

function parseTitle(raw: unknown): string {
    assertRecord(raw);
    return requiredString(raw, 'title');
}

describe('ParseError', () => {
    it('is an Error named ParseError', () => {
        const error = new ParseError('expected an object');
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('ParseError');
        expect(error.message).toBe('expected an object');
    });
});

describe('assertRecord', () => {
    it('accepts a plain object', () => {
        expect(() => assertRecord({ id: 'tt1' })).not.toThrow();
    });

    it.each([
        ['null', null],
        ['an array', []],
        ['a string', 'x'],
        ['a number', 1],
    ])('throws for %s', (_label, value) => {
        expect(() => assertRecord(value)).toThrow(ParseError);
        expect(() => assertRecord(value)).toThrow('expected an object');
    });
});

describe('requiredString', () => {
    it('returns a non-empty string', () => {
        expect(requiredString({ id: 'tt1' }, 'id')).toBe('tt1');
    });

    it.each([
        ['a missing field', {}],
        ['an empty string', { id: '' }],
        ['a whitespace string', { id: '   ' }],
        ['a number', { id: 1 }],
        ['null', { id: null }],
    ])('throws for %s', (_label, record) => {
        expect(() => requiredString(record, 'id')).toThrow('expected string at "id"');
    });
});

describe('optionalString', () => {
    it('returns the string', () => expect(optionalString({ id: 'tt1' }, 'id')).toBe('tt1'));
    it('returns undefined for a missing field', () => expect(optionalString({}, 'id')).toBeUndefined());
    it('returns undefined for null', () => expect(optionalString({ id: null }, 'id')).toBeUndefined());
    it('throws for a number', () => expect(() => optionalString({ id: 1 }, 'id')).toThrow('expected string at "id"'));
});

describe('optionalNumber', () => {
    it('returns the number', () => expect(optionalNumber({ year: 2020 }, 'year')).toBe(2020));
    it('returns undefined for a missing field', () => expect(optionalNumber({}, 'year')).toBeUndefined());
    it('returns undefined for null', () => expect(optionalNumber({ year: null }, 'year')).toBeUndefined());
    it('throws for a string', () =>
        expect(() => optionalNumber({ year: '2020' }, 'year')).toThrow('expected number at "year"'));
});

describe('optionalArray', () => {
    it('returns the array', () => expect(optionalArray({ values: [1] }, 'values')).toEqual([1]));
    it('returns undefined for a missing field', () => expect(optionalArray({}, 'values')).toBeUndefined());
    it('returns undefined for null', () => expect(optionalArray({ values: null }, 'values')).toBeUndefined());
    it('throws for a string', () =>
        expect(() => optionalArray({ values: 'x' }, 'values')).toThrow('expected array at "values"'));
});

describe('parseValidItems', () => {
    it('keeps parsed items and drops items whose parser throws ParseError', () => {
        expect(parseValidItems([{ title: 'A' }, null, { title: '' }, { title: 'B' }], parseTitle)).toEqual(['A', 'B']);
    });

    it('rethrows a non-ParseError', () => {
        const boom = new Error('boom');
        expect(() =>
            parseValidItems([1], () => {
                throw boom;
            })
        ).toThrow(boom);
    });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/parse-utils.test.ts`

Expected: FAIL because `src/core/api/parse-utils.ts` does not exist.

- [x] **Step 3: Implement `parse-utils.ts`**

Add the SPDX header, then the declarations above. `ParseError` sets `this.name = 'ParseError'`, `assertRecord` rejects null, arrays, and non-objects, and `parseValidItems` catches only `ParseError`:

```ts
export function assertRecord(value: unknown): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ParseError('expected an object');
    }
}

export function parseValidItems<T>(values: unknown[], parseItem: (_value: unknown) => T): T[] {
    const parsed: T[] = [];
    for (const value of values) {
        try {
            parsed.push(parseItem(value));
        } catch (error: unknown) {
            if (!(error instanceof ParseError)) throw error;
        }
    }
    return parsed;
}

export function parseRequiredItems<T>(values: unknown[], parseItem: (_value: unknown) => T, label: string): T[] {
    const parsed = parseValidItems(values, parseItem);
    if (values.length > 0 && parsed.length === 0) {
        throw new ParseError(`no valid items in ${label}`);
    }
    return parsed;
}
```

`parseValidItems` returns an empty array when every item is invalid. `parseRequiredItems` delegates to it and throws `ParseError` with the label only when the input is non-empty and every item is invalid. Primary result arrays use `parseRequiredItems`; optional secondary arrays keep the lenient `parseValidItems` behavior. Add tests for items dropped, empty input, all-invalid input, and non-`ParseError` propagation. `requiredString` throws `ParseError('expected string at "<key>"')` for a non-string or `value.trim() === ''`. Each optional reader returns `undefined` for `undefined` or `null`, then throws `ParseError('expected <type> at "<key>"')` for a wrong type.

Add JSDoc to every exported declaration. Document that `optional*` treat absent and null as `undefined` and throw only on a wrong type.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/parse-utils.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/api/parse-utils.ts tests/unit/core/api/parse-utils.test.ts
git commit -m "refactor(api): add throwing response parsers"
```

---

### Task 2: Add `fetchParsed` and private `#queuedFetch`

**Files:**

- Modify: `src/core/api/base-api-client.ts`
- Test: `tests/unit/core/api/base-api-client.test.ts`

**Interfaces:**

- Consumes: `ParseError` from `./parse-utils`.
- Produces:

    ```ts
    public async fetchParsed<T>(
        url: string,
        priority: number,
        parse: (raw: unknown) => T,
        label: string
    ): Promise<T | undefined>
    #queuedFetch(url: string, priority: number): Promise<unknown>
    ```

- [x] **Step 1: Write the failing tests**

In `tests/unit/core/api/base-api-client.test.ts`, import `ParseError` from the new module. Extend the local `StubClient` constructor with an adapter parameter defaulted to `mockAdapter`:

```ts
constructor(
    queue: RequestQueue,
    source: 'xmdb' | 'omdb' | 'agregarr',
    logger: Logger,
    adapter: PlatformAdapter = mockAdapter
) {
    super({ ...deps, adapter, logger }, queue, source);
}
```

Extend `buildQueue` so `enqueue` runs the supplied fetch function:

```ts
function buildQueue(clearedCount: number): RequestQueue {
    return {
        clear: vi.fn().mockReturnValue(clearedCount),
        enqueue: vi.fn((url: string, _priority: number, fetchFn: (requestUrl: string) => Promise<unknown>) =>
            fetchFn(url)
        ),
    } as unknown as RequestQueue;
}
```

Add these tests inside `describe('BaseApiClient surface')`:

```ts
it('returns the parser result', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ id: 'tt1' }).build();
    const client = new StubClient(buildQueue(0), 'xmdb', buildLogger().build(), adapter);

    const result = await client.fetchParsed(
        'https://example.test',
        0,
        raw => ({ id: (raw as { id: string }).id }),
        'test'
    );

    expect(result).toEqual({ id: 'tt1' });
});

it('logs one warning and returns undefined for ParseError', async () => {
    const logger = buildLogger().build();
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ id: 42 }).build();
    const client = new StubClient(buildQueue(0), 'xmdb', logger, adapter);

    const result = await client.fetchParsed(
        'https://example.test',
        0,
        () => {
            throw new ParseError('expected string at "id"');
        },
        'XMDb search for "Test"'
    );

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith('Malformed XMDb search for "Test"', {
        response: { id: 42 },
        error: 'expected string at "id"',
    });
});

it('rethrows a non-ParseError', async () => {
    const logger = buildLogger().build();
    const client = new StubClient(buildQueue(0), 'xmdb', logger, mockAdapter);
    const boom = new Error('boom');

    await expect(
        client.fetchParsed(
            'https://example.test',
            0,
            () => {
                throw boom;
            },
            'test'
        )
    ).rejects.toThrow('boom');

    expect(logger.warn).not.toHaveBeenCalled();
});

it('does not catch a queue error', async () => {
    const logger = buildLogger().build();
    const adapter = buildMockAdapter().withHttpFetchRejectingWith(new Error('network')).build();
    const client = new StubClient(buildQueue(0), 'xmdb', logger, adapter);

    await expect(client.fetchParsed('https://example.test', 0, raw => raw, 'test')).rejects.toThrow('network');

    expect(logger.warn).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/base-api-client.test.ts`

Expected: FAIL because `fetchParsed` does not exist.

- [x] **Step 3: Implement the request path**

Add `import { ParseError } from './parse-utils';`.

Rename the existing `queuedFetch` body to `#queuedFetch`. Add `fetchParsed` before it:

```ts
async fetchParsed<T>(
    url: string,
    priority: number,
    parse: (raw: unknown) => T,
    label: string
): Promise<T | undefined> {
    const raw = await this.#queuedFetch(url, priority);
    try {
        return parse(raw);
    } catch (error: unknown) {
        if (!(error instanceof ParseError)) throw error;
        this.logger.warn(`Malformed ${label}`, { response: raw, error: error.message });
        return undefined;
    }
}

#queuedFetch(url: string, priority: number): Promise<unknown> {
    return this.#queue.enqueue(url, priority, async (requestUrl: string) => this.#adapter.httpFetch(requestUrl));
}
```

Add a temporary public wrapper so existing clients keep working until their tasks:

```ts
/**
 * @deprecated Use fetchParsed. Removed when every client has migrated.
 */
async queuedFetch(url: string, priority: number): Promise<unknown> {
    return this.#queuedFetch(url, priority);
}
```

Add JSDoc to `fetchParsed` describing the `ParseError` catch, the warning, and the rethrow.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/base-api-client.test.ts`

Expected: PASS.

Run: `npx vitest run tests/unit/core/api/omdb-api-client.test.ts`

Expected: PASS. The temporary `queuedFetch` wrapper keeps the current OMDb stubs working.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/api/base-api-client.ts tests/unit/core/api/base-api-client.test.ts
git commit -m "refactor(api): add fetchParsed request path"
```

---

### Task 3: Parse Agregarr responses

**Files:**

- Modify: `src/core/api/agregarr-api-client.ts`
- Test: `tests/unit/core/api/agregarr-api-client.test.ts`

**Interfaces:**

- Consumes: `fetchParsed`, `ParseError`, `assertRecord`, `requiredString`, `optionalNumber`, `optionalArray`, `parseRequiredItems`.
- Produces (internal to the client):

    ```ts
    function parseImdbSuggestionsResponse(raw: unknown): ImdbSuggestionsResponse;
    function parseImdbSuggestionsResult(raw: unknown): ImdbSuggestionsResult;
    function parseAgregarrRatingsResponse(raw: unknown): AgregarrRatingEntry[];
    function parseAgregarrRatingEntry(raw: unknown): AgregarrRatingEntry;
    ```

- [x] **Step 1: Update the failing tests**

In `tests/unit/core/api/agregarr-api-client.test.ts`:

Replace the assertion in "should return undefined when the Agregarr response carries no ratings array" with the new single warning from `fetchParsed`:

```ts
expect(await client.getDetails(searchResult)).toBeUndefined();
expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Malformed Agregarr details for "Movie 1"'), {
    response: undefined,
    error: 'expected an array',
});
```

In the two existing no-results tests ("should log info when no results found" and "should log info when IMDb Suggestions response has no d array"), add `expect(mockLogger.warn).not.toHaveBeenCalled();` after the info assertion.

Add:

```ts
it('should drop invalid IMDb Suggestions results and keep valid ones', async () => {
    const mockAdapter = buildMockAdapter()
        .withHttpFetchResolvingTo({
            d: [
                { id: '', l: 'Bad', qid: 'movie' },
                { id: 'tt2', l: 'Good', qid: 'movie', y: 2021 },
            ],
        })
        .build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

    const result = await client.search('Good');

    expect(result!.imdbId).toBe('tt2');
    expect(result!.apiTitle).toBe('Good');
});

it('should warn once when the IMDb Suggestions body is not an object', async () => {
    const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo([]).build();
    const mockLogger = buildLogger().build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });

    expect(await client.search('Movie 1')).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Malformed IMDb Suggestions search for "Movie 1"'),
        { response: [], error: 'expected an object' }
    );
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/agregarr-api-client.test.ts`

Expected: FAIL because the client still imports `decode-utils` and logs the old message.

- [x] **Step 3: Implement the parsers and call sites**

Replace the `decode-utils` import with `parse-utils`. Rename the four functions and use the throwing readers:

```ts
function parseImdbSuggestionsResponse(raw: unknown): ImdbSuggestionsResponse {
    assertRecord(raw);
    const results = optionalArray(raw, 'd');
    if (!results) return {};
    return { d: parseRequiredItems(results, parseImdbSuggestionsResult, 'the "d" array') };
}

function parseAgregarrRatingsResponse(raw: unknown): AgregarrRatingEntry[] {
    if (!Array.isArray(raw)) throw new ParseError('expected an array');
    return parseRequiredItems(raw, parseAgregarrRatingEntry, 'the ratings array');
}
```

`parseImdbSuggestionsResult` calls `assertRecord` and returns `{ qid: requiredString(raw, 'qid'), id: requiredString(raw, 'id'), l: requiredString(raw, 'l'), y: optionalNumber(raw, 'y') }`. `parseAgregarrRatingEntry` does the same for `imdbId`, `rating`, and `votes`.

In `search`, replace the fetch and decode block with:

```ts
const data = await this.fetchParsed(
    `https://v3.sg.media-imdb.com/suggestion/titles/x/${encoded}.json`,
    0,
    parseImdbSuggestionsResponse,
    `IMDb Suggestions search for "${displayTitle}"`
);
if (!data) return undefined;
```

Keep the existing `results` checks and info logs after `data.d`.

In `getDetails`, replace the fetch and decode block with:

```ts
const ratings = await this.fetchParsed(
    `https://api.agregarr.org/api/ratings?id=${encodedId}`,
    1,
    parseAgregarrRatingsResponse,
    `Agregarr details for "${searchTitle.displayTitle}" (ID: ${id})`
);
if (!ratings) return undefined;
```

Then keep the existing first-entry check and build the Title from the search
metadata plus the details ratings. Use `entry.imdbId` for the resulting
`imdbId`; the details response is the canonical source for that identity field.
The empty-array warning stays:

```ts
const entry = ratings[0];
if (!entry) {
    this.logger.warn(`Agregarr details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
        response: ratings,
    });
    return undefined;
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/agregarr-api-client.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/api/agregarr-api-client.ts tests/unit/core/api/agregarr-api-client.test.ts
git commit -m "refactor(api): parse Agregarr responses with ParseError"
```

---

### Task 4: Parse OMDb responses

**Files:**

- Modify: `src/core/api/omdb-api-client.ts`
- Test: `tests/unit/core/api/omdb-api-client.test.ts`

**Interfaces:**

- Consumes: `fetchParsed`, `ParseError`, `assertRecord`, `requiredString`, `optionalString`, `optionalArray`, `parseValidItems`.
- Produces (internal to the client):

    ```ts
    function parseOmdbResponse(raw: unknown): OmdbResponse;
    function parseOmdbSuccessResponse(raw: Record<string, unknown>): OmdbResponse;
    function parseOmdbRatings(ratings: unknown[] | undefined): OmdbRatingEntry[] | undefined;
    function parseOmdbRating(raw: unknown): OmdbRatingEntry;
    ```

- [x] **Step 1: Update the failing tests**

Rewrite the three tests that assign `client.queuedFetch` to use the adapter.

"should use ID endpoint when searchTitle has imdbId":

```ts
const adapter = buildMockAdapter().withHttpFetchResolvingTo(mockResponse).build();
const client = new OmdbApiClient({ ...deps, adapter });
const minimalTitle = buildTitle().withDisplayTitle('Test').withImdbId('tt1234567').build();
const result = await client.getDetails(minimalTitle);

expect(result).not.toBeUndefined();
expect(result!.imdbId).toBe('tt1234567');
expect(result!.imdbRating).toBe(8.5);
expect(result!.apiTitle).toBe('Test Movie');
expect(adapter.httpFetch).toHaveBeenCalledWith('https://www.omdbapi.com/?apikey=key&i=tt1234567');
```

Do the same adapter substitution in "should update apiTitle from OMDb response when fallback has no apiTitle" and "should fetch details for a cached title that still carries a null apiTitle". In the cached-title test, assert `adapter.httpFetch` was called with `https://www.omdbapi.com/?apikey=key&i=tt123`.

Add:

```ts
it('should warn once when the OMDb response is not an object', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo([]).build();
    const logger = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter, logger });

    expect(await client.search('Movie 1')).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Malformed OMDb search for "Movie 1"'), {
        response: [],
        error: 'expected an object',
    });
});

it('should log info and not warn for a Response "False" payload', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False' }).build();
    const logger = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter, logger });

    expect(await client.search('Movie 1')).toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No OMDb results found'));
    expect(logger.warn).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/omdb-api-client.test.ts`

Expected: FAIL because the client still imports `decode-utils`, and the `queuedFetch` stubs no longer match the new seam.

- [x] **Step 3: Implement the parsers and call sites**

Replace the `decode-utils` import with `parse-utils`. Keep the `OMDB_SUCCESS` and `OMDB_FAILURE` constants. Rename the functions and use the throwing readers:

```ts
function parseOmdbResponse(raw: unknown): OmdbResponse {
    assertRecord(raw);
    const response = requiredString(raw, 'Response');
    if (response === OMDB_FAILURE) return { Response: response };
    if (response !== OMDB_SUCCESS) {
        throw new ParseError(`expected Response "True" or "False", got "${response}"`);
    }
    return parseOmdbSuccessResponse(raw);
}

function parseOmdbRating(raw: unknown): OmdbRatingEntry {
    assertRecord(raw);
    return {
        source: requiredString(raw, 'Source'),
        value: requiredString(raw, 'Value'),
    };
}
```

`parseOmdbSuccessResponse` returns an `OmdbSuccessResponse` containing `{ Response: OMDB_SUCCESS, imdbRating: optionalString(raw, 'imdbRating'), Ratings: parseOmdbRatings(optionalArray(raw, 'Ratings')), imdbID: requiredString(raw, 'imdbID'), Year: optionalString(raw, 'Year'), Title: requiredString(raw, 'Title'), Type: optionalString(raw, 'Type'), imdbVotes: optionalString(raw, 'imdbVotes') }`. `parseOmdbRatings` returns `undefined` for an absent array and otherwise returns `parseValidItems(ratings, parseOmdbRating)`.

`OmdbResponse` is a discriminated union on `Response`: `OmdbSuccessResponse` requires `Title` and `imdbID`, while `OmdbFailureResponse` carries only `Response: 'False'`. Name the private Title builder `#titleFromOmdbResponse` so it does not shadow the module-level parser.

In `search`, replace the fetch and decode block with:

```ts
const json = await this.fetchParsed(
    `https://www.omdbapi.com/?${params}`,
    1,
    parseOmdbResponse,
    `OMDb search for "${displayTitle}"`
);
if (!json) return undefined;
```

Keep the existing `json.Response === OMDB_FAILURE` info log and the response parsing that follows.

In `getDetails`, do the same with:

```ts
const json = await this.fetchParsed(
    `https://www.omdbapi.com/?${params}`,
    1,
    parseOmdbResponse,
    `OMDb details for "${searchTitle.displayTitle}" (ID: ${id})`
);
if (!json) return undefined;
```

Keep the existing failure check and merge logic.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/omdb-api-client.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/api/omdb-api-client.ts tests/unit/core/api/omdb-api-client.test.ts
git commit -m "refactor(api): parse OMDb responses with ParseError"
```

---

### Task 5: Parse XMDb responses

**Files:**

- Modify: `src/core/api/xmdb-api-client.ts`
- Test: `tests/unit/core/api/xmdb-api-client.test.ts`

**Interfaces:**

- Consumes: `fetchParsed`, `assertRecord`, `requiredString`, `optionalString`, `optionalNumber`, `optionalArray`, `parseRequiredItems`.
- Produces (internal to the client):

    ```ts
    function parseXmdbSearchResponse(raw: unknown): XmdbSearchResponse
    function parseXmdbSearchResult(raw: unknown): XmdbSearchResult
    function parseXmdbDetailsResponse(raw: unknown): XmdbDetailsResponse | undefined
    interface XmdbDetailsResponse
    ```

- [x] **Step 1: Update the failing tests**

In the two existing no-results info tests ("should log info when no search results found" and "should log info when search results have no titles"), add `expect(mockLoggerForTest.warn).not.toHaveBeenCalled();` after the info assertion.

Replace "should log warn when details response has error field" with:

```ts
it('should not warn when the details response is a not-found payload', async () => {
    const adapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ id: 'm1', title: 'Movie 1', error: 'not found' })
        .build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });

    await client.getDetails(buildTitle().withImdbId('m1').withDisplayTitle('Movie 1').build());

    expect(logger.warn).not.toHaveBeenCalled();
});
```

Replace the `it.each` test "should return undefined when the details response has %s" with two tests:

```ts
it('should return undefined without a warning for a not-found payload', async () => {
    const adapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ id: 'tt1', title: 'Movie 1', error: 'Movie not found' })
        .build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });

    const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

    expect(result).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
});

it.each([
    ['a missing title', { id: 'tt1', rating: 8.8 }],
    ['a null response', null],
    ['an undefined response', undefined],
])('should log a malformed warning when the details response has %s', async (_label, response) => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo(response).build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });

    const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Malformed XMDb details for "Test"'),
        expect.anything()
    );
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/xmdb-api-client.test.ts`

Expected: FAIL because the client still imports `decode-utils` and logs the old details warning.

- [x] **Step 3: Implement the parsers, the merged interface, and call sites**

Replace the `decode-utils` import with `parse-utils`. Rename the parsers:

```ts
function parseXmdbSearchResponse(raw: unknown): XmdbSearchResponse {
    assertRecord(raw);
    const results = optionalArray(raw, 'results');
    if (!results) return {};
    return { results: parseRequiredItems(results, parseXmdbSearchResult, 'the "results" array') };
}

function parseXmdbDetailsResponse(raw: unknown): XmdbDetailsResponse | undefined {
    assertRecord(raw);
    const error = optionalString(raw, 'error');
    if (error) return undefined;
    // The details endpoint keeps id and sends title: null for a missing title.
    if (raw['title'] === null) return undefined;
    return {
        id: requiredString(raw, 'id'),
        title: requiredString(raw, 'title'),
        rating: optionalNumber(raw, 'rating'),
        release_year: optionalNumber(raw, 'release_year'),
        metascore: optionalNumber(raw, 'metascore'),
        title_type: optionalString(raw, 'title_type'),
        vote_count: optionalNumber(raw, 'vote_count'),
    };
}
```

`parseXmdbSearchResult` calls `assertRecord` and returns `{ type: requiredString(raw, 'type'), id: requiredString(raw, 'id'), name: requiredString(raw, 'name'), year: optionalNumber(raw, 'year') }`.

Delete `decodeXmdbDetailsFields`. Merge `XmdbDetailsFields` into one interface, required fields first:

```ts
interface XmdbDetailsResponse {
    id: string;
    title: string;
    rating?: number | undefined;
    release_year?: number | undefined;
    metascore?: number | undefined;
    title_type?: string | undefined;
    vote_count?: number | undefined;
}
```

In `search`, replace the fetch and decode block with:

```ts
const data = await this.fetchParsed(
    `https://xmdbapi.com/api/v1/search?${searchParams}`,
    0,
    parseXmdbSearchResponse,
    `XMDb search for "${displayTitle}"`
);
if (!data) return undefined;
```

Keep the existing `results` checks and Title construction after `data.results`.

In `getDetails`, replace the fetch and decode block with:

```ts
const details = await this.fetchParsed(
    `https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`,
    1,
    parseXmdbDetailsResponse,
    `XMDb details for "${searchTitle.displayTitle}" (ID: ${id})`
);
if (!details) return undefined;
return this.#titleFromDetails(searchTitle, details);
```

`#titleFromDetails` uses `details.id` for the resulting `imdbId`; the details response is the canonical source for that identity field. The normalized optional fields are passed through directly instead of adding `?? undefined` fallbacks.

Remove the old "XMDb details request failed" warning.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/xmdb-api-client.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/api/xmdb-api-client.ts tests/unit/core/api/xmdb-api-client.test.ts
git commit -m "refactor(api): parse XMDb responses with ParseError"
```

---

### Task 6: Remove the raw request path and old helpers

**Files:**

- Modify: `src/core/api/base-api-client.ts`
- Delete: `src/core/api/decode-utils.ts`
- Test: `tests/unit/core/api/base-api-client.test.ts` if it still references the temporary wrapper

**Interfaces:**

- Consumes: all earlier tasks.
- Produces: final state with `fetchParsed` public and `#queuedFetch` private.

- [x] **Step 1: Remove the temporary wrapper**

Delete the temporary `queuedFetch` method from `BaseApiClient`. No client should call it now.

- [x] **Step 2: Delete the old module**

Delete `src/core/api/decode-utils.ts`.

- [x] **Step 3: Verify no stale names remain**

Run:

```bash
rg "decode-utils|Decoded<|readRequiredString|readOptional|decodeValidItems|fetchDecoded" src tests
```

Expected: no output.

Run:

```bash
rg "queuedFetch" src tests
```

Expected: only `#queuedFetch` in `src/core/api/base-api-client.ts`, and no test references.

- [x] **Step 4: Run the full test suite**

Run: `npm test`

Expected: PASS.

- [x] **Step 5: Run the full local check**

Run:

```bash
npm run type-check && npm run lint && npm run format:check && npm run audit && npm run build && npm run test:coverage
```

Expected: all commands pass. Coverage stays at or above the configured thresholds.

- [x] **Step 6: Commit**

```bash
git add src/core/api/base-api-client.ts
git add -u src/core/api/decode-utils.ts
git commit -m "refactor(api): remove the raw request path"
```

---

## Final Review Checklist

- [x] `parse-utils.ts` is the only place that defines `ParseError` and the field readers.
- [x] No client imports `decode-utils` or calls `queuedFetch`.
- [x] `fetchParsed` catches only `ParseError`; a non-`ParseError` propagates.
- [x] Malformed responses log exactly once, with the label, raw body, and message.
- [x] Valid not-found payloads return `undefined` without a malformed warning.
- [x] `parseValidItems` drops one bad item without failing its siblings.
- [x] Primary result arrays use `parseRequiredItems`; optional secondary arrays stay lenient.
- [x] `OmdbResponse` is a discriminated union on `Response`, with required identity fields on success.
- [x] XMDb and Agregarr take the resulting `imdbId` from the details response.
- [x] Normalized optional fields pass through without `?? undefined` fallbacks.
- [x] The XMDb details parser and interface are collapsed into one of each.
- [x] The full local check from `AGENTS.md` passes.
