# Cache and Storage Payload Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate cache and platform storage payloads at their boundaries so corrupt data becomes a cache miss or an ignored setting instead of an exception or a partially built entry.

**Architecture:** Move the generic throwing readers to `src/core/parse-utils.ts`, add a shared `isStorageValue` guard, rebuild cached title payloads as typed `TitleData` the same way API responses are parsed, and narrow WebExtension storage, background, and content-script payloads with guards.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-05-cache-storage-validation-design.md`

## Revision: cache entry parser alignment (2026-11-05)

The first pass validated the cached title payload in place: it called the
readers for their side effects, rejected unknown keys, kept the raw payload, and
cast it in `Title.fromCacheJSON`. Review replaced that with the API parser shape.
Task 3 is kept as the record of the first pass; Tasks 6 to 8 supersede it. The
Review Focus and Final Checklist describe the merged result.

## Revision: corrupt cache diagnostics (2026-11-05)

The cache parser now reports why an entry was rejected. `CacheEntry.fromJSON`
throws the parse failure instead of swallowing it, and `CacheManager.read`
logs the error, deletes the key, and returns a miss. Task 9 supersedes the
`CacheEntry.fromJSON` return contract and the warning payload recorded in
Tasks 3, 6, and 8. The Review Focus and Final Checklist describe the merged
result.

## Global Constraints

- `strict` and `exactOptionalPropertyTypes` are enabled.
- ESLint complexity is capped at 10 and `max-params` at 4. Do not add disable comments.
- Every exported declaration needs JSDoc with `@param` and `@returns` where applicable. Every `{src,tests}/**/*.ts` file starts with the SPDX header.
- Shared parser helpers live at `src/core/parse-utils.ts`; no module outside `src/core/api/` may import from `src/core/api/`.
- No new dependencies, no schema library, and no cache migration.
- Legacy literal `null` values for optional cache fields remain normalized to `undefined`.
- ASCII only, no em-dashes, sorted imports, and Conventional Commits.
- Unit tests use adapter mocks and make no live API calls.
- Final state: the four boundary files have no `@typescript-eslint/no-unsafe-type-assertion` findings.

## Review Focus

- A cache value that is valid JSON but not an object, such as `null`, `[]`, or `"text"`, must be a miss rather than a `TypeError`.
- A cached `Title` field with the wrong type, such as a string rating, must be a miss rather than a silently normalized hit.
- An entry with unknown keys and valid known keys must read back with only the known keys, and `getTitle()` must always return a `Title` using the envelope `displayTitle`.
- A failed delete of a corrupt entry must still leave the read resolving to `undefined`.
- The corrupt-entry warning must carry the parser failure that rejected the entry.
- A wrong-typed `storage.onChanged` value must not leave stale config in the snapshot and must not throw.

---

### Task 1: Move the shared parser helpers to the core

**Files:**

- Move: `src/core/api/parse-utils.ts` to `src/core/parse-utils.ts`
- Move: `tests/unit/core/api/parse-utils.test.ts` to `tests/unit/core/parse-utils.test.ts`
- Modify: `src/core/api/agregarr-api-client.ts`
- Modify: `src/core/api/base-api-client.ts`
- Modify: `src/core/api/omdb-api-client.ts`
- Modify: `src/core/api/xmdb-api-client.ts`
- Modify: `tests/unit/core/api/base-api-client.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `ParseError`, `assertRecord`, `requiredString`, `optionalString`, `optionalNumber`, `optionalArray`, `parseValidItems`, and `parseRequiredItems`, all exported from `src/core/parse-utils.ts`. `optionalNumber` now rejects non-finite numbers.

- [x] **Step 1: Move the module and its test**

```bash
git mv src/core/api/parse-utils.ts src/core/parse-utils.ts
git mv tests/unit/core/api/parse-utils.test.ts tests/unit/core/parse-utils.test.ts
```

- [x] **Step 2: Update imports**

In the four API clients and `src/core/api/base-api-client.ts`, change `'./parse-utils'` to `'../parse-utils'`.

In `tests/unit/core/api/base-api-client.test.ts`, change `'../../../../src/core/api/parse-utils'` to `'../../../../src/core/parse-utils'`.

In the moved test, change the import to `'../../../src/core/parse-utils'`.

- [x] **Step 3: Broaden the parser wording**

In `src/core/parse-utils.ts`, change the `ParseError` description from "untrusted API response" to "untrusted input". Keep the reader behavior unchanged except for the finite-number check below.

- [x] **Step 4: Write the failing non-finite number test**

Add to the `optionalNumber` block in `tests/unit/core/parse-utils.test.ts`:

```ts
it.each([Infinity, -Infinity, NaN])('throws for the non-finite number %s', value => {
    expect(() => optionalNumber({ number: value }, 'number')).toThrow('expected number at "number"');
});
```

- [x] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/unit/core/parse-utils.test.ts`

Expected: FAIL because `optionalNumber` currently accepts non-finite numbers.

- [x] **Step 6: Implement the finite-number check**

Change the wrong-type condition in `optionalNumber` to:

```ts
if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ParseError(`expected number at "${key}"`);
}
```

Update its JSDoc to say it throws for a wrong type or a non-finite number.

- [x] **Step 7: Run the parser and API tests**

Run: `npx vitest run tests/unit/core/parse-utils.test.ts tests/unit/core/api`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/core/parse-utils.ts src/core/api tests/unit/core/parse-utils.test.ts tests/unit/core/api
git commit -m "refactor(core): share untrusted input parser helpers"
```

---

### Task 2: Validate WebExtension storage and background responses

**Files:**

- Modify: `src/platform/adapter.ts`
- Modify: `src/platform/webextension.ts`
- Test: `tests/unit/platform/webextension.test.ts`

**Interfaces:**

- Consumes: `StorageValue` from `src/platform/adapter.ts`.
- Produces:

    ```ts
    export function isStorageValue(value: unknown): value is StorageValue;
    ```

- Internal to `webextension.ts`: `isRecord(value: unknown): value is Record<string, unknown>` and `isFetchResponse(value: unknown): value is FetchResponse`.

- [x] **Step 1: Write the failing storage tests**

Add to `tests/unit/platform/webextension.test.ts`:

```ts
it('storageGet should return a boolean value', async () => {
    mockedBrowser.storage.local.get.mockResolvedValue({ key: true });
    await expect(adapter.storageGet('key')).resolves.toBe(true);
});

it.each([
    ['a number', 42],
    ['null', null],
    ['an object', { nested: true }],
    ['an array', ['value']],
])('storageGet should return undefined for %s', async (_label, value) => {
    mockedBrowser.storage.local.get.mockResolvedValue({ key: value });
    await expect(adapter.storageGet('key')).resolves.toBeUndefined();
});

it('storageGetAll should omit values that are not storage values', async () => {
    mockedBrowser.storage.local.get.mockResolvedValue({
        validString: 'value',
        validBoolean: false,
        invalidNumber: 42,
        invalidNull: null,
        invalidObject: { nested: true },
    });

    await expect(adapter.storageGetAll()).resolves.toEqual({
        validString: 'value',
        validBoolean: false,
    });
});

it('storageGetAll should return an empty record when storage is not an object', async () => {
    mockedBrowser.storage.local.get.mockResolvedValue(null as unknown as Record<string, unknown>);
    await expect(adapter.storageGetAll()).resolves.toEqual({});
});

it('httpFetch should reject a non-object background response', async () => {
    mockedBrowser.runtime.sendMessage.mockResolvedValue([]);
    await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('empty background response');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/platform/webextension.test.ts`

Expected: FAIL because wrong-typed values are currently returned and arrays are asserted to `FetchResponse`.

- [x] **Step 3: Add the shared storage guard**

In `src/platform/adapter.ts`, after the `StorageValue` type, add:

```ts
/**
 * Narrows an untrusted value to a value the platform storage contract allows.
 *
 * @param value - Value read from platform storage or a storage change event.
 * @returns True when the value is a string or boolean.
 */
export function isStorageValue(value: unknown): value is StorageValue {
    return typeof value === 'string' || typeof value === 'boolean';
}
```

- [x] **Step 4: Narrow the adapter reads and the background response**

In `src/platform/webextension.ts`:

- Import `isStorageValue`.
- `storageGet` assigns the storage result to `const result: unknown`, returns `undefined` when `isRecord(result)` rejects it, reads `const value: unknown = result[key]`, and returns it only when `isStorageValue(value)` accepts it.
- `storageGetAll` treats a non-record result as `{}` and copies only values accepted by `isStorageValue`.
- `httpFetch` assigns the race result to `const response: unknown` and checks `isFetchResponse(response)` before reading its fields. Keep the existing `empty background response` error for absent or invalid responses.

Add these module-level helpers after the class:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFetchResponse(value: unknown): value is FetchResponse {
    if (!isRecord(value)) return false;
    const error = value['error'];
    const status = value['status'];
    const body = value['body'];
    return (
        (error === undefined || typeof error === 'string') &&
        (status === undefined || typeof status === 'number') &&
        (body === undefined || typeof body === 'string')
    );
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/platform/webextension.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/platform/adapter.ts src/platform/webextension.ts tests/unit/platform/webextension.test.ts
git commit -m "refactor(platform): validate storage and background payloads"
```

---

### Task 3: Validate cache entries and delete corrupt reads

> Superseded by Task 6. This task records the first pass, which validated the
> payload in place and kept the late cast. Its commit stays in history.

**Files:**

- Modify: `src/core/cache/cache-entry.ts`
- Modify: `src/core/cache/cache-manager.ts`
- Test: `tests/unit/core/cache/cache.test.ts`

**Interfaces:**

- Consumes: `ParseError`, `assertRecord`, `requiredString`, `optionalString`, and `optionalNumber` from `src/core/parse-utils.ts`.
- Produces:

    ```ts
    static fromJSON(raw: unknown): CacheEntry | undefined
    ```

- Internal to `cache-entry.ts`: `parseCacheEntry(value: unknown): CacheEntry` and `assertOnlyKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void`.

- [x] **Step 1: Update the existing cache tests**

In `tests/unit/core/cache/cache.test.ts`:

- Rename "should return cache entry even without title data" to "should treat an entry without title data as a cache miss" and assert `undefined`, one warning, and a delete of `fmc:missing_data`.
- Change the string `imdbRating` values in "should return CacheEntry with getTitle for valid entry" and "should identify expired entry" to finite numbers so those tests keep covering successful reads.

- [x] **Step 2: Write the failing validation tests**

Add to `tests/unit/core/cache/cache.test.ts`:

```ts
it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"value"'],
    ['a number', '42'],
])('should treat %s JSON as a cache miss', async (_label, raw) => {
    adapter.storageGet.mockResolvedValue(raw);

    await expect(cacheManager.read('Corrupt Title')).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
        key: 'fmc:corrupt_title',
        displayTitle: 'Corrupt Title',
    });
    expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:corrupt_title');
});

it.each([
    ['a missing display title', { data: {} }],
    ['a non-string display title', { displayTitle: 42, data: {} }],
    ['a non-string IMDb ID', { displayTitle: 'Corrupt', imdbId: 42, data: {} }],
    ['a non-number expiry', { displayTitle: 'Corrupt', expires: 'soon', data: {} }],
    ['a missing data payload', { displayTitle: 'Corrupt' }],
    ['a non-object data payload', { displayTitle: 'Corrupt', data: null }],
    ['a string rating', { displayTitle: 'Corrupt', data: { imdbRating: '7.5' } }],
    ['a legacy rating field', { displayTitle: 'Corrupt', data: { rating: 7.5 } }],
])('should treat an entry with %s as a cache miss', async (_label, entry) => {
    adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

    await expect(cacheManager.read('Corrupt Title')).resolves.toBeUndefined();
    expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:corrupt_title');
});

it('should treat a legacy nested entry as a cache miss', async () => {
    adapter.storageGet.mockResolvedValue(
        JSON.stringify({
            data: { displayTitle: 'Legacy Movie', imdbId: 'tt1', rating: 8.1 },
            expires: null,
        })
    );

    await expect(cacheManager.read('Legacy Movie')).resolves.toBeUndefined();
    expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:legacy_movie');
});

it('should resolve a miss when deleting a corrupt entry fails', async () => {
    adapter.storageGet.mockResolvedValue('invalid-json{');
    adapter.storageDelete.mockRejectedValue(new Error('delete failed'));

    await expect(cacheManager.read('Some Title')).resolves.toBeUndefined();

    expect(mockLogger.debug).toHaveBeenCalledWith('Failed to delete corrupt cache entry', {
        key: 'fmc:some_title',
        error: expect.any(Error),
    });
});
```

Keep the existing legacy null test as the accepted legacy case.

- [x] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: FAIL because malformed entries are still returned and invalid keys are not deleted.

- [x] **Step 4: Implement the cache parser**

In `src/core/cache/cache-entry.ts`:

- Import the parser helpers from `../parse-utils`.
- Add module-level key sets:

```ts
const CACHE_ENTRY_KEYS = new Set(['displayTitle', 'imdbId', 'data', 'expires']);
const TITLE_STRING_KEYS = ['apiTitle', 'imdbId', 'source', 'type'] as const;
const TITLE_NUMBER_KEYS = ['year', 'imdbRating', 'imdbVotes', 'rtRating', 'mcRating'] as const;
const TITLE_DATA_KEYS = new Set([...TITLE_STRING_KEYS, ...TITLE_NUMBER_KEYS]);
```

- Change `fromJSON` to accept `unknown` and return `CacheEntry | undefined`. Return `undefined` for a non-string, catch `JSON.parse` failures, then call `parseCacheEntry` and catch only `ParseError`.
- Implement `parseCacheEntry` with `assertRecord`, `assertOnlyKeys`, `requiredString(value, 'displayTitle')`, `optionalString(value, 'imdbId')`, and `optionalNumber(value, 'expires')`.
- Require `data` to be present and pass `assertRecord(data)`, then `assertOnlyKeys(data, TITLE_DATA_KEYS, 'title payload')`.
- Call `optionalString` for every `TITLE_STRING_KEYS` entry and `optionalNumber` for every `TITLE_NUMBER_KEYS` entry to validate types.
- Implement `assertOnlyKeys` to throw `ParseError('unexpected field "<key>" in <label>')` for the first unknown key.
- Update the JSDoc to say corrupt or legacy data returns `undefined` and that only `ParseError` is converted to a miss.

- [x] **Step 5: Implement best-effort deletion in the cache manager**

In `src/core/cache/cache-manager.ts`:

- Replace the `try`/`catch` around `CacheEntry.fromJSON` with:

```ts
const raw = await this.#adapter.storageGet(key);
if (raw === undefined) return undefined;

const entry = CacheEntry.fromJSON(raw);
if (entry) return entry;

this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle });
await this.#deleteInvalid(key);
return undefined;
```

- Add a private `#deleteInvalid(key: string): Promise<void>` that awaits `storageDelete` and catches any error, logging `Failed to delete corrupt cache entry` at debug level with `{ key, error }`.
- Remove the now-unused `string` assertion.

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/cache/cache-entry.ts src/core/cache/cache-manager.ts tests/unit/core/cache/cache.test.ts
git commit -m "refactor(cache): validate stored cache entries"
```

---

### Task 4: Validate the extension content storage boundaries

**Files:**

- Modify: `src/targets/extension/content.ts`
- Test: `tests/unit/targets/extension/content.test.ts`

**Interfaces:**

- Consumes: `WebExtensionAdapter.storageGetAll()` and `isStorageValue` from the platform layer.
- Produces: a config snapshot that contains only `StorageValue` entries.

- [x] **Step 1: Update and extend the content tests**

In `tests/unit/targets/extension/content.test.ts`:

- Change the `fadeRatingThreshold` value in "should call redecorate when fadeRatingThreshold changes" from `50` to `'50'`.
- Add:

```ts
it('seeds the config snapshot with only valid storage values', async () => {
    storedObject = { overlayCorner: 42, showRtRating: true };
    await startAfterMigrations();

    const adapter = startAppSpy.mock.calls[0][0] as { configGet: (_key: string) => unknown };
    expect(adapter.configGet('overlayCorner')).toBeUndefined();
    expect(adapter.configGet('showRtRating')).toBe(true);
});

it('removes a setting from the snapshot when the new value has the wrong type', async () => {
    await startAfterMigrations();

    onChangedListener({ overlayCorner: { newValue: 42 } });

    expect(storedObject).not.toHaveProperty('overlayCorner');
    expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
});

it('removes a setting from the snapshot when the key is deleted', async () => {
    storedObject = { showRtRating: true };
    await startAfterMigrations();

    onChangedListener({ showRtRating: { newValue: undefined } });

    expect(storedObject).not.toHaveProperty('showRtRating');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/targets/extension/content.test.ts`

Expected: FAIL because the content script still asserts storage values and keeps stale values.

- [x] **Step 3: Narrow the content bootstrap and listener**

In `src/targets/extension/content.ts`:

- Import `isStorageValue` from `../../platform/adapter`.
- Construct the adapter first, then seed it with `const stored = await adapter.storageGetAll()`.
- Remove the direct `browser.storage.local.get(null)` call and its assertion.
- In the listener, assign `v.newValue` only when `isStorageValue` accepts it; otherwise `delete stored[k]`. Keep the visual-settings redecorate check unchanged.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/targets/extension/content.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/targets/extension/content.ts tests/unit/targets/extension/content.test.ts
git commit -m "refactor(extension): validate content storage boundaries"
```

---

### Task 5: Verify the full change

**Files:**

- Modify: `docs/superpowers/plans/2026-11-05-cache-storage-validation.md` only to tick completed steps.

**Interfaces:**

- Consumes: all earlier tasks.
- Produces: a verified branch ready for review.

- [x] **Step 1: Verify no old parser imports remain**

Run: `rg "core/api/parse-utils|api/parse-utils" src tests`

Expected: no output.

- [x] **Step 2: Verify the boundary files satisfy the disabled rule**

Run:

```bash
npx eslint src/core/cache/cache-entry.ts src/core/cache/cache-manager.ts src/platform/webextension.ts src/targets/extension/content.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'
```

Expected: no findings.

- [x] **Step 3: Run the full local check**

Run:

```bash
npm run type-check && npm run lint && npm run format:check && npm run audit && npm run build && npm run test:coverage
```

Expected: all commands pass and coverage stays at or above the configured thresholds.

- [x] **Step 4: Review the final diff**

Run: `git diff origin/main --stat && git diff origin/main`

Expected: only the four boundary files, `src/platform/adapter.ts`, `src/core/parse-utils.ts`, the moved test, and the affected tests and docs. No `dist/` or `coverage/` changes.

- [x] **Step 5: Commit any remaining documentation updates**

If ticking this plan changed the file, commit it:

```bash
git add docs/superpowers/plans/2026-11-05-cache-storage-validation.md
git commit -m "docs(cache): tick the storage validation plan"
```

---

### Task 6: Rebuild cached title payloads as `TitleData`

> Supersedes the in-place parser in Task 3.

**Files:**

- Modify: `src/core/cache/cache-entry.ts`
- Modify: `src/core/api-manager.ts:39`
- Modify: `tests/mocks/cache.ts`
- Modify: `tests/mocks/title.ts`
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
- `tests/mocks/title.ts`: add `const emptyTitleData = buildTitle().build().toCacheJSON();` and export it alongside `buildTitle`.
- `tests/mocks/cache.ts`: import `emptyTitleData`. Make `withData` and the stored `data` field required `TitleData`, initialize the default `data` with `emptyTitleData`, and change the `.withData(undefined)` presets to `.withData(emptyTitleData)`.
- `tests/unit/core/api-manager.test.ts`: import `emptyTitleData`. Change `.withData(undefined)` to `.withData(emptyTitleData)`. Change the local `expiredEntry` and `invalidEntry` objects from `data: undefined` to `data: emptyTitleData`, and rename `invalidEntry` to `emptyEntry`. Rename the test "should use short-circuit fetch for non-expired entry with imdbId but invalid data" to "... but empty title data".
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
  tests/mocks/cache.ts tests/mocks/title.ts \
  tests/unit/core/cache/cache.test.ts tests/unit/core/api-manager.test.ts
git commit -m "refactor(cache): rebuild cached title payloads as typed data"
```

---

### Task 7: Remove `Title.fromCacheJSON`

**Files:**

- Modify: `src/core/title.ts:72-84`
- Modify: `tests/unit/core/title.test.ts`
- Modify: `tests/unit/core/api/omdb-api-client.test.ts:422-425`

**Interfaces:**

- Consumes: the `CacheEntry` changes from Task 6, which remove the last production caller.
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
const cachedTitle = new Title({ displayTitle: 'Test', imdbId: 'tt123' });
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

### Task 8: Verify the revised change

**Files:**

- Modify: `docs/superpowers/plans/2026-11-05-cache-storage-validation.md` only to tick completed steps.
- Delete: `docs/superpowers/plans/2026-11-05-cache-entry-parser-alignment.md`

**Interfaces:**

- Consumes: Tasks 6 and 7.
- Produces: a verified branch with one plan document.

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

- [x] **Step 5: Merge the plans and commit**

Remove the separate parser plan now that its tasks live here:

```bash
git rm docs/superpowers/plans/2026-11-05-cache-entry-parser-alignment.md
git add docs/superpowers/plans/2026-11-05-cache-storage-validation.md
git commit -m "docs(cache): merge the parser alignment into the storage validation plan"
```

### Task 9: Log the parser failure on corrupt cache reads

> Supersedes the `CacheEntry.fromJSON` return contract and warning payload in
> Tasks 3 and 6.

**Files:**

- Modify: `src/core/cache/cache-entry.ts`
- Modify: `src/core/cache/cache-manager.ts`
- Test: `tests/unit/core/cache/cache.test.ts`

**Interfaces:**

- Consumes: `ParseError` from `src/core/parse-utils.ts`.
- Produces:
    - `CacheEntry.fromJSON(raw: unknown): CacheEntry`, throwing `ParseError` for a non-string value and `SyntaxError` or `ParseError` for an invalid payload.
    - `CacheManager.read` logging `{ key, displayTitle, error }` before deleting a corrupt entry.

- [x] **Step 1: Update the failing cache tests**

In `tests/unit/core/cache/cache.test.ts`, extend every warning assertion for a
corrupt read to include the error. Import `ParseError` from
`../../../../src/core/parse-utils`.

```ts
expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
    key: 'fmc:corrupt_title',
    displayTitle: 'Corrupt Title',
    error: expect.any(ParseError),
});
```

Add a case that asserts the parser detail:

```ts
it('logs the failing field when a cache entry is corrupt', async () => {
    adapter.storageGet.mockResolvedValue(JSON.stringify({ displayTitle: 'Bad Expiry', data: {}, expires: 'soon' }));

    await expect(cacheManager.read('Bad Expiry')).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
        key: 'fmc:bad_expiry',
        displayTitle: 'Bad Expiry',
        error: expect.objectContaining({ message: 'expected number at "expires"' }),
    });
    expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:bad_expiry');
});
```

Add a case for truncated JSON:

```ts
it('logs the syntax error when a cache entry is not valid JSON', async () => {
    adapter.storageGet.mockResolvedValue('invalid-json{');

    await expect(cacheManager.read('Some Title')).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
        key: 'fmc:some_title',
        displayTitle: 'Some Title',
        error: expect.any(SyntaxError),
    });
    expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:some_title');
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: FAIL because `read` logs only `key` and `displayTitle`.

- [x] **Step 3: Implement the throwing parser**

In `src/core/cache/cache-entry.ts`, change `fromJSON` to:

```ts
static fromJSON(raw: unknown): CacheEntry {
    if (typeof raw !== 'string') throw new ParseError('expected serialized JSON string');
    return parseCacheEntry(JSON.parse(raw));
}
```

Update the JSDoc `@returns` to name the validated entry and add `@throws` for
`ParseError` on an invalid value and `SyntaxError` on invalid JSON.

- [x] **Step 4: Catch and log in the cache manager**

In `src/core/cache/cache-manager.ts`, import `ParseError` from
`../parse-utils` and replace the `fromJSON` call with:

```ts
try {
    return CacheEntry.fromJSON(raw);
} catch (error: unknown) {
    if (!(error instanceof ParseError) && !(error instanceof SyntaxError)) throw error;
    this.#logger.warn('Cache entry corrupt, treating as miss', { key, displayTitle, error });
    await this.#deleteInvalid(key);
    return undefined;
}
```

Keep the `raw === undefined` early return.

- [x] **Step 5: Run the tests and the type check**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [x] **Step 6: Commit the code and tests**

```bash
git add src/core/cache/cache-entry.ts src/core/cache/cache-manager.ts tests/unit/core/cache/cache.test.ts
git commit -m "fix(cache): log the parser failure for corrupt entries"
```

- [x] **Step 7: Commit the design and plan revision**

```bash
git add docs/superpowers/specs/2026-11-05-cache-storage-validation-design.md docs/superpowers/plans/2026-11-05-cache-storage-validation.md
git commit -m "docs(cache): record corrupt cache diagnostics"
```

---

## Final Checklist

- [x] `CacheEntry.fromJSON` accepts `unknown`, returns `CacheEntry`, and throws `ParseError` or `SyntaxError` for corrupt data.
- [x] The corrupt-entry warning includes the parser error.
- [x] Errors that are neither `ParseError` nor `SyntaxError` still propagate.
- [x] A non-string storage value and malformed JSON both become a miss.
- [x] An entry with missing required or wrong-typed fields becomes a miss; unknown fields are dropped.
- [x] The legacy null entry remains accepted.
- [x] A corrupt entry is deleted best-effort; a failed delete does not reject the read.
- [x] `WebExtensionAdapter.storageGet` and `storageGetAll` return only valid `StorageValue` entries.
- [x] `httpFetch` narrows the background response without an assertion.
- [x] The content bootstrap uses `adapter.storageGetAll()` and the listener ignores invalid values.
- [x] `parse-utils.ts` lives at `src/core/parse-utils.ts` and every import points there.
- [x] The full local check and the targeted rule check pass.
- [x] `parseTitleData` rebuilds the title payload from known keys and drops unknown ones.
- [x] `CacheEntry.#data` is `TitleData` and `getTitle()` returns a `Title` with no assertion.
- [x] `Title.fromCacheJSON` is removed and no cache path casts.
- [x] The parser alignment is recorded in this plan; the separate plan file is removed.
- [x] The corrupt cache diagnostics revision is recorded in the design and plan.
