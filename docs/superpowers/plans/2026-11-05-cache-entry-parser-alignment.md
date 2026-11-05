# Cache Entry Parser Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Parse stored cache entries the same way API responses are parsed: rebuild a fresh, typed `TitleData` from the known keys instead of validating in place and casting during hydration.

**Architecture:** `parseCacheEntry` reads the envelope and delegates the title payload to a new `parseTitleData(raw): TitleData`, which uses the reader return values. `CacheEntry` stores `TitleData`, `getTitle()` constructs `Title` directly, and the now-unused `Title.fromCacheJSON` is deleted.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-05-cache-storage-validation-design.md`

## Global Constraints

- `strict` and `exactOptionalPropertyTypes` are enabled.
- ESLint complexity is capped at 10 and `max-params` at 4. Do not add disable comments.
- Every exported declaration needs JSDoc with `@param` and `@returns` where applicable. Every `{src,tests}/**/*.ts` file starts with the SPDX header.
- No new dependencies and no cache migration.
- Unknown entry and title keys are dropped, matching the API parsers. Wrong-typed known keys and missing required fields remain cache misses.
- `Title` normalization and `Title.toCacheJSON` stay unchanged.
- ASCII only, no em-dashes, sorted imports, and Conventional Commits.
- Shared parser helpers stay in `src/core/parse-utils.ts`. Do not import from `src/core/api/` outside that directory.

## Review Focus

- A cached payload with an unknown key and valid known keys must read back with only the known keys, not as a miss and not as a partially built `Title`.
- A wrong-typed known key, such as a string rating, must still be a miss.
- A missing or non-object `data` must still be a miss.
- `getTitle()` must always return a `Title` for any `CacheEntry` read from storage, using the envelope `displayTitle`.
- An entry with empty `TitleData` must keep working through the cache mock and `ApiClientManager`.

---

### Task 1: Commit the revised design and plan

**Files:**

- Modify: `docs/superpowers/specs/2026-11-05-cache-storage-validation-design.md`
- Create: `docs/superpowers/plans/2026-11-05-cache-entry-parser-alignment.md`

**Interfaces:**

- Consumes: nothing.
- Produces: the approved design revision and this plan in history.

- [x] **Step 1: Commit the documents**

```bash
git add docs/superpowers/specs/2026-11-05-cache-storage-validation-design.md \
  docs/superpowers/plans/2026-11-05-cache-entry-parser-alignment.md
git commit -m "docs(cache): align cache parser with API response parsing"
```

---

### Task 2: Rebuild cached title payloads as `TitleData`

**Files:**

- Modify: `src/core/cache/cache-entry.ts`
- Modify: `src/core/api-manager.ts:39`
- Modify: `tests/mocks/cache.ts`
- Test: `tests/unit/core/cache/cache.test.ts`
- Test: `tests/unit/core/api-manager.test.ts`

**Interfaces:**

- Consumes: `assertRecord`, `optionalNumber`, `optionalString`, `requiredString`, and `ParseError` from `src/core/parse-utils.ts`; `Title` and `TitleData` from `src/core/title.ts`.
- Produces:
    - `CacheEntry(displayTitle: string, imdbId: string | undefined, data: TitleData, expires: number | undefined)`
    - `CacheEntry.getTitle(): Title`
    - `CacheEntry.toJSON(): { displayTitle: string; imdbId: string | undefined; data: TitleData; expires: number | undefined }`
    - Module-private `parseTitleData(raw: unknown): TitleData`

- [x] **Step 1: Write the failing cache tests**

In `tests/unit/core/cache/cache.test.ts`, add after the miss-table tests:

```ts
it('ignores unknown entry and title fields', async () => {
    adapter.storageGet.mockResolvedValue(
        JSON.stringify({
            displayTitle: 'Cached Movie',
            imdbId: 'tt456',
            data: { apiTitle: 'Cached Movie', imdbRating: 7.5, rating: 9.9, extra: true },
            expires: Date.now() + 10000,
            unknownEntryField: 'ignored',
        })
    );

    const entry = await cacheManager.read('Cached Movie');

    expect(entry).toBeInstanceOf(CacheEntry);
    expect(entry!.getTitle().imdbRating).toBe(7.5);
    expect(entry!.toJSON().data).not.toHaveProperty('rating');
    expect(entry!.toJSON().data).not.toHaveProperty('extra');
});

it('returns a Title for an entry with empty title data', async () => {
    adapter.storageGet.mockResolvedValue(
        JSON.stringify({ displayTitle: 'Empty Movie', data: {}, expires: Date.now() + 10000 })
    );

    const entry = await cacheManager.read('Empty Movie');

    expect(entry!.getTitle()).toBeInstanceOf(Title);
    expect(entry!.getTitle().displayTitle).toBe('Empty Movie');
});

it('keeps every known title field', async () => {
    adapter.storageGet.mockResolvedValue(
        JSON.stringify({
            displayTitle: 'Full Movie',
            imdbId: 'tt1',
            data: {
                apiTitle: 'Full Movie',
                imdbId: 'tt1',
                year: 2020,
                imdbRating: 7.5,
                imdbVotes: 1000,
                rtRating: 90,
                mcRating: 80,
                source: 'omdb',
                type: 'movie',
            },
            expires: Date.now() + 10000,
        })
    );

    const title = (await cacheManager.read('Full Movie'))!.getTitle();

    expect(title).toMatchObject({
        apiTitle: 'Full Movie',
        imdbId: 'tt1',
        year: 2020,
        imdbRating: 7.5,
        imdbVotes: 1000,
        rtRating: 90,
        mcRating: 80,
        source: 'omdb',
        type: 'movie',
    });
});
```

Remove `['a legacy rating field', { displayTitle: 'Corrupt', data: { rating: 7.5 } }]` from the miss table. Keep the string-rating, missing-data, and null-data cases. Add array, string, and number data cases:

```ts
['an array data payload', { displayTitle: 'Corrupt', data: [] }],
['a string data payload', { displayTitle: 'Corrupt', data: 'text' }],
['a number data payload', { displayTitle: 'Corrupt', data: 42 }],
```

- [x] **Step 2: Run the cache tests to verify they fail**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: the unknown-key test fails because the current parser rejects unknown keys. The empty-data test passes and stays as a regression pin.

- [x] **Step 3: Implement the payload parser and tighten the entry type**

In `src/core/cache/cache-entry.ts`:

- Remove `CACHE_ENTRY_KEYS`, `TITLE_STRING_KEYS`, `TITLE_NUMBER_KEYS`, `TITLE_DATA_KEYS`, and `assertOnlyKeys`.
- Import `type TitleData` alongside `Title`.
- Change the constructor and `#data` to `TitleData`, and update their JSDoc to say the payload is a validated title without `displayTitle`.
- Change `toJSON()` to return `data: TitleData`.
- Replace `getTitle()` with:

```ts
getTitle(): Title {
    return new Title({ ...this.#data, displayTitle: this.#displayTitle });
}
```

- Replace `parseCacheEntry` with:

```ts
function parseCacheEntry(value: unknown): CacheEntry {
    assertRecord(value);
    return new CacheEntry(
        requiredString(value, 'displayTitle'),
        optionalString(value, 'imdbId'),
        parseTitleData(value['data']),
        optionalNumber(value, 'expires')
    );
}
```

- Add:

```ts
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
```

- Update the `fromJSON` JSDoc: unknown fields are dropped, and missing required or wrong-typed fields return `undefined`.

- [x] **Step 4: Run the cache tests to verify they pass**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: PASS.

- [x] **Step 5: Fix the type ripple**

- `src/core/api-manager.ts`: change `const titleObj: Title | undefined = entry.getTitle();` to `const titleObj: Title = entry.getTitle();` and drop `titleObj &&` from the cache-hit condition.
- `tests/mocks/cache.ts`: make `withData` and the stored `data` field required `TitleData`. Initialize `data` as `{}` in a typed props object, and change the `.withData(undefined)` presets to `.withData({})`.
- `tests/unit/core/api-manager.test.ts`: change `.withData(undefined)` to `.withData({})`. Change the local `expiredEntry` and `invalidEntry` objects from `data: undefined` to `data: {}`, and rename `invalidEntry` to `emptyEntry`. Rename the test "should use short-circuit fetch for non-expired entry with imdbId but invalid data" to "... but empty title data".
- `tests/unit/core/cache/cache.test.ts`: rewrite "should treat an entry without title data as a cache miss" to pass raw JSON without a `data` key instead of building an entry with `withData(undefined)`:

```ts
adapter.storageGet.mockResolvedValue(JSON.stringify({ displayTitle: 'Missing Data', expires: Date.now() + 10000 }));
```

- [x] **Step 6: Run type-check and the affected tests**

Run: `npm run type-check`

Expected: PASS.

Run: `npx vitest run tests/unit/core/cache tests/unit/core/api-manager.test.ts`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/cache/cache-entry.ts src/core/api-manager.ts \
  tests/mocks/cache.ts tests/unit/core/cache/cache.test.ts \
  tests/unit/core/api-manager.test.ts
git commit -m "refactor(cache): rebuild cached title payloads as typed data"
```

---

### Task 3: Remove `Title.fromCacheJSON`

**Files:**

- Modify: `src/core/title.ts:72-84`
- Modify: `tests/unit/core/title.test.ts`
- Modify: `tests/unit/core/api/omdb-api-client.test.ts:422-425`

**Interfaces:**

- Consumes: the `CacheEntry` changes from Task 2, which remove the last production caller.
- Produces: no `fromCacheJSON` symbol and no assertion in the cache path.

- [x] **Step 1: Replace the remaining test caller**

In `tests/unit/core/api/omdb-api-client.test.ts`, replace:

```ts
const legacyCachedTitle = Title.fromCacheJSON(
    { apiTitle: null, imdbId: 'tt123', year: null } as unknown as TitleData,
    'Test'
)!;
```

with:

```ts
const legacyCachedTitle = new Title({ imdbId: 'tt123' });
```

Rename the test to "should fetch details for a cached title without an apiTitle". Remove `TitleData` from the `title` import if it is no longer used.

- [x] **Step 2: Delete the method**

In `src/core/title.ts`, delete `static fromCacheJSON` and its JSDoc. Leave `toCacheJSON`, `TitleData`, and constructor normalization unchanged.

- [x] **Step 3: Delete its tests**

In `tests/unit/core/title.test.ts`:

- Delete the `describe('fromCacheJSON creation', ...)` block.
- Delete `it('should round-trip through fromCacheJSON', ...)` inside `describe('type field')`.
- Delete `it('should reconstruct Title with displayTitle from fromCacheJSON', ...)` near the end.
- Delete the `emptyTitleData` constant and the `TitleData` import if they become unused. Keep `TitleOptions`.

- [x] **Step 4: Verify the symbol is gone**

Run: `rg "fromCacheJSON" src tests`

Expected: no output.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Run the affected tests**

Run: `npx vitest run tests/unit/core/title.test.ts tests/unit/core/api/omdb-api-client.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/title.ts tests/unit/core/title.test.ts tests/unit/core/api/omdb-api-client.test.ts
git commit -m "refactor(cache): remove the unused cache JSON hydration helper"
```

---

### Task 4: Verify the full change

**Files:**

- Modify: `docs/superpowers/plans/2026-11-05-cache-entry-parser-alignment.md` only to tick completed steps.

**Interfaces:**

- Consumes: Tasks 2 and 3.
- Produces: a verified branch.

- [x] **Step 1: Verify no removed symbols remain**

Run: `rg "fromCacheJSON|core/api/parse-utils|api/parse-utils" src tests`

Expected: no output.

- [x] **Step 2: Verify the cache files are assertion-free**

Run:

```bash
npx eslint src/core/cache/cache-entry.ts src/core/cache/cache-manager.ts \
  --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'
```

Expected: no findings.

- [x] **Step 3: Run the full local check**

Run:

```bash
npm run type-check && npm run lint && npm run format:check && npm run audit && npm run build && npm run test:coverage
```

Expected: all commands pass and coverage stays at or above the configured thresholds.

- [x] **Step 4: Review the diff**

Run: `git diff origin/main --stat && git diff origin/main -- src/core/cache src/core/title.ts src/core/api-manager.ts tests`

Expected: only the parser, the entry type, `api-manager`, the removed helper, mocks, and affected tests. No `dist/` or `coverage/` changes.

- [x] **Step 5: Commit the plan ticks**

```bash
git add docs/superpowers/plans/2026-11-05-cache-entry-parser-alignment.md
git commit -m "docs(cache): tick the parser alignment plan"
```
