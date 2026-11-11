# Provider Miss Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log every HTTP-200 miss or in-body provider error once across the OMDb, Agregarr, and XMDb clients, with one message convention and the provider message preserved.

**Architecture:** XMDb details becomes a discriminated union on `status`; OMDb failure responses carry an optional `Error`. Clients log one `info` line per miss while parsers stay pure, `fetchParsed` stays the only malformed logger, and `ApiClientManager` stays the only HTTP-status logger.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Prettier, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-07-provider-miss-logging-design.md`

## Global Constraints

- `strict` and `exactOptionalPropertyTypes` are enabled. Optional fields written by parsers use `| undefined`.
- Parsers never call the logger.
- `fetchParsed` is the only malformed-body logger; `ApiClientManager` is the only HTTP-status logger.
- Misses log once at `info`; never at `warn` or `error`.
- Search miss: `No search results found in <label> for "<displayTitle>"`.
- Unsupported type: `No supported title-type results found in <label> for "<displayTitle>"`.
- Details miss: `No <provider> <noun> found for "<displayTitle>" (ID: <id>)`.
- Append `: <message>` only when the body carries a non-empty provider message.
- `undefined` from `fetchParsed` means malformed only, never not-found.
- ASCII only, SPDX headers, sorted imports, and JSDoc on exported declarations.
- No new dependencies.
- Preserve the untracked `docs/reviews/` directory.
- Conventional Commits, one commit per task.

## Review Focus

- A body with both `error` and `title: null` logs once with the provider message, not the bare line. Task 1 pins this with a test.
- A miss with no provider message does not append `: undefined`, `null`, or a trailing separator. Task 2 pins this with a test.
- A non-string provider message is malformed and warns once, not a miss. Tasks 1 and 2 pin this with tests.
- A found response with no rating stays a found title and logs no miss. Existing `should keep a valid details response that has no rating` and OMDb success tests cover this; no new test.
- HTTP 4xx and 5xx still log through `ApiClientManager` and emit no client miss line. Existing `should disable client on 4xx HTTP error` and `should NOT disable client on 5xx HTTP error` tests cover this; no new test.

---

### Task 1: XMDb details union and miss logging

**Files:**

- Modify: `src/core/api/xmdb-api-client.ts:34-43`, `:89`, `:102-116`, `:151-182`
- Test: `tests/unit/core/api/xmdb-api-client.test.ts:62-88`, `:153-170`, `:215-224`

**Interfaces:**

- Consumes: `fetchParsed`, `assertRecord`, `optionalString`, `optionalNumber`, `requiredString`, `Title`.
- Produces (internal to the client):

    ```ts
    interface XmdbDetailsFound {
        status: 'found';
        id: string;
        title: string;
        rating?: number | undefined;
        release_year?: number | undefined;
        metascore?: number | undefined;
        title_type?: string | undefined;
        vote_count?: number | undefined;
    }

    interface XmdbDetailsNotFound {
        status: 'not-found';
        error?: string | undefined;
    }

    type XmdbDetailsResponse = XmdbDetailsFound | XmdbDetailsNotFound;

    function parseXmdbDetailsResponse(raw: unknown): XmdbDetailsResponse;
    function titleFromDetailsResponse(searchTitle: Title, details: XmdbDetailsFound): Title;
    ```

- [x] **Step 1: Write the failing tests**

In `tests/unit/core/api/xmdb-api-client.test.ts`, change the two search info assertions to the exact convention lines.

In `should log info when no search results found`:

```ts
expect(mockLoggerForTest.info).toHaveBeenCalledWith('No search results found in XMDb for "Movie 1"');
```

In `should log info when search results have no titles`:

```ts
expect(mockLoggerForTest.info).toHaveBeenCalledWith('No supported title-type results found in XMDb for "Movie 1"');
```

Replace `should return undefined without a warning when the details response has a null title` with:

```ts
it('should log info when the details response has a null title', async () => {
    const adapter = buildMockAdapter()
        .withHttpFetchResolvingToOnce({
            id: 'tt0000000',
            title: null,
            title_type: null,
            release_year: null,
            rating: null,
        })
        .build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });
    const result = await client.getDetails(
        buildTitle().withImdbId('tt0000000').withDisplayTitle('nonexistent').build()
    );
    expect(result).toBeUndefined();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('No XMDb details found for "nonexistent" (ID: tt0000000)');
    expect(logger.warn).not.toHaveBeenCalled();
});
```

Replace `should return undefined without a warning for an error payload` with:

```ts
it('should log info with the provider message for an error payload', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ error: 'Movie not found' }).build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });

    const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

    expect(result).toBeUndefined();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('No XMDb details found for "Test" (ID: tt1): Movie not found');
    expect(logger.warn).not.toHaveBeenCalled();
});
```

Add after that test:

```ts
it('should prefer the provider message when the details response has an error and a null title', async () => {
    const adapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ id: 'tt1', title: null, error: 'Movie not found' })
        .build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });

    await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('No XMDb details found for "Test" (ID: tt1): Movie not found');
    expect(logger.warn).not.toHaveBeenCalled();
});

it('should log a malformed warning when the details error field is not a string', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ error: 42 }).build();
    const logger = buildLogger().build();
    const client = new XmdbApiClient({ ...deps, adapter, logger });

    await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Test').build());

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Malformed XMDb details for "Test"'),
        expect.anything()
    );
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/xmdb-api-client.test.ts`

Expected: FAIL. The null-title and error-payload tests see no `info` call, and the unsupported-type test sees the old wording.

- [x] **Step 3: Implement the union, parser, and logging**

Replace the `XmdbDetailsResponse` interface with the two interfaces and the union shown in the Interfaces block. Add the `status: 'found'` field to the object the parser returns.

Change `parseXmdbDetailsResponse` to return `XmdbDetailsResponse` (never `undefined`):

```ts
function parseXmdbDetailsResponse(raw: unknown): XmdbDetailsResponse {
    assertRecord(raw);
    const error = optionalString(raw, 'error');
    if (error) return { status: 'not-found', error };
    // The details endpoint keeps id and sends title: null for a missing title.
    if (raw['title'] === null) return { status: 'not-found' };
    return {
        status: 'found',
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

In `getDetails`, after the `if (!details) return undefined;` guard, narrow on the union:

```ts
if (details.status === 'not-found') {
    const message = details.error ? `: ${details.error}` : '';
    this.logger.info(`No XMDb details found for "${searchTitle.displayTitle}" (ID: ${id})${message}`);
    return undefined;
}
return titleFromDetailsResponse(searchTitle, details);
```

Change `titleFromDetailsResponse` to accept `XmdbDetailsFound`.

Change the unsupported-type line in `search` to:

```ts
this.logger.info(`No supported title-type results found in XMDb for "${displayTitle}"`);
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/xmdb-api-client.test.ts`

Expected: PASS.

- [x] **Step 5: Run the type checker**

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/api/xmdb-api-client.ts tests/unit/core/api/xmdb-api-client.test.ts
git commit -m "fix(api): log XMDb details misses"
```

---

### Task 2: OMDb failure message and wording

**Files:**

- Modify: `src/core/api/omdb-api-client.ts:45-48`, `:96-99`, `:115`, `:123-126`, `:133-141`
- Test: `tests/unit/core/api/omdb-api-client.test.ts:241-249`, `:441-449`

**Interfaces:**

- Consumes: `optionalString`, `fetchParsed`.
- Produces (internal to the client):

    ```ts
    interface OmdbFailureResponse {
        Response: typeof OMDB_FAILURE;
        Error?: string | undefined;
    }
    ```

- [x] **Step 1: Write the failing tests**

Replace `should log warn with error message on OMDB False response` with:

```ts
it('should log info with the provider error message on an OMDb False response', async () => {
    const mockAdapterForTest = buildMockAdapter()
        .withHttpFetchResolvingTo({ Response: 'False', Error: 'Movie not found!' })
        .build();
    const mockLoggerForTest = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter: mockAdapterForTest, logger: mockLoggerForTest });
    await client.search('Unknown');
    expect(mockLoggerForTest.info).toHaveBeenCalledTimes(1);
    expect(mockLoggerForTest.info).toHaveBeenCalledWith(
        'No search results found in OMDb for "Unknown": Movie not found!'
    );
    expect(mockLoggerForTest.warn).not.toHaveBeenCalled();
});
```

Replace `should log info and not warn for a Response "False" payload` with:

```ts
it('should log info and not warn for a Response "False" payload', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False' }).build();
    const logger = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter, logger });

    expect(await client.search('Movie 1')).toBeUndefined();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('No search results found in OMDb for "Movie 1"');
    expect(logger.warn).not.toHaveBeenCalled();
});
```

Add after that test:

```ts
it('should log info with the display title, IMDb ID, and provider message on a details miss', async () => {
    const adapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ Response: 'False', Error: 'Incorrect IMDb ID.' })
        .build();
    const logger = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter, logger });

    const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Movie 1').build());

    expect(result).toBeUndefined();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('No OMDb results found for "Movie 1" (ID: tt1): Incorrect IMDb ID.');
    expect(logger.warn).not.toHaveBeenCalled();
});

it('should log info without a provider message on a details miss that has no Error', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False' }).build();
    const logger = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter, logger });

    const result = await client.getDetails(buildTitle().withImdbId('tt1').withDisplayTitle('Movie 1').build());

    expect(result).toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('No OMDb results found for "Movie 1" (ID: tt1)');
    expect(logger.warn).not.toHaveBeenCalled();
});

it('should log a malformed warning when a False response has a non-string Error', async () => {
    const adapter = buildMockAdapter().withHttpFetchResolvingTo({ Response: 'False', Error: 42 }).build();
    const logger = buildLogger().build();
    const client = new OmdbApiClient({ ...deps, adapter, logger });

    expect(await client.search('Movie 1')).toBeUndefined();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Malformed OMDb search for "Movie 1"'), {
        response: { Response: 'False', Error: 42 },
        error: 'expected string at "Error"',
    });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/api/omdb-api-client.test.ts`

Expected: FAIL. The old wording is still logged and the `Error` field is not parsed.

- [x] **Step 3: Implement the failure message and wording**

Add `Error?: string | undefined` to `OmdbFailureResponse`. In `parseOmdbResponse`, return the message with the failure member:

```ts
if (response === OMDB_FAILURE) return { Response: response, Error: optionalString(raw, 'Error') };
```

Change the search failure log to:

```ts
if (response.Response === OMDB_FAILURE) {
    const message = response.Error ? `: ${response.Error}` : '';
    this.logger.info(`No search results found in OMDb for "${displayTitle}"${message}`);
    return undefined;
}
```

Change the details failure log to:

```ts
if (response.Response === OMDB_FAILURE) {
    const message = response.Error ? `: ${response.Error}` : '';
    this.logger.info(`No OMDb results found for "${searchTitle.displayTitle}" (ID: ${id})${message}`);
    return undefined;
}
```

Change the details debug line to:

```ts
this.logger.debug(`Fetching OMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/api/omdb-api-client.test.ts`

Expected: PASS.

- [x] **Step 5: Run the type checker**

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/api/omdb-api-client.ts tests/unit/core/api/omdb-api-client.test.ts
git commit -m "fix(api): log OMDb provider messages on misses"
```

---

### Task 3: Update the parsing design document and run the full check

**Files:**

- Modify: `docs/superpowers/specs/2026-11-03-api-response-parsing-design.md:155-168`, `:181-186`, `:208-219`

**Interfaces:**

- Consumes: the behavior and types from Tasks 1 and 2.
- Produces: documentation that matches the shipped convention.

- [x] **Step 1: Update the logging split bullet**

Replace the `Logging split` bullet with:

```markdown
- **Logging split.** `fetchParsed` logs malformed payloads only. Clients log
  every HTTP-200 miss or in-body error once at `info` for decoded empty or
  not-found results such as `Response: 'False'`, an empty search results
  array, an empty Agregarr ratings array, an XMDb `error` field, or an XMDb
  `title` of `null`. Clients do not log when `fetchParsed` returns `undefined`,
  because the helper already logged the malformed case. Details misses name
  the display title and the IMDb ID; search misses name the display title.
  Provider-supplied messages are appended as `: <message>`. The Agregarr
  details empty-array case logs at `info` ("No Agregarr ratings found"), not
  at `warn`.
```

- [x] **Step 2: Update the XMDb and OMDb type bullets**

Replace the `Collapse the XMDb split` bullet with:

```markdown
- **Model XMDb not-found.** `XmdbDetailsResponse` is a discriminated union on
  `status`: `XmdbDetailsFound` carries `status: 'found'`, required `id` and
  `title`, then optional `rating`, `release_year`, `metascore`, `title_type`,
  and `vote_count`; `XmdbDetailsNotFound` carries `status: 'not-found'` and an
  optional `error`. `parseXmdbDetailsResponse` always returns a member, so
  `undefined` from `fetchParsed` means malformed only.
```

Replace the `OMDb response union` bullet with:

```markdown
- **OMDb response union.** Model `OmdbResponse` as a discriminated union on
  `Response`. `OmdbSuccessResponse` carries required `Title` and `imdbID`
  fields; `OmdbFailureResponse` carries `Response: 'False'` and an optional
  `Error`. This makes the invariant explicit, keeps the provider message for
  logging, and removes the optional identity fields from the success path.
  Build the `Title` in a module-level `titleFromOmdbSuccessResponse` function
  so the name cannot shadow the module-level parser.
```

- [x] **Step 3: Update the verification section**

Add this bullet after the malformed-response bullet:

```markdown
- Every HTTP-200 miss logs one `info` line with the provider context and no
  `warn` or `error`.
```

- [x] **Step 4: Run the full local check**

Run: `npm run type-check && npm run lint && npm run format:check && npm test`

Expected: PASS for every command.

- [x] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-03-api-response-parsing-design.md
git commit -m "docs: document provider miss logging convention"
```
