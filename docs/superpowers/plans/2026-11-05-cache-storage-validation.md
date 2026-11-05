# Cache and Storage Payload Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate cache and platform storage payloads at their boundaries so corrupt data becomes a cache miss or an ignored setting instead of an exception or a partially built entry.

**Architecture:** Move the generic throwing readers to `src/core/parse-utils.ts`, add a shared `isStorageValue` guard, parse cache entries with those readers while catching only `ParseError`, and narrow WebExtension storage, background, and content-script payloads with guards.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-05-cache-storage-validation-design.md`

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
- A legacy cache shape with a nested `displayTitle` or `rating` field must be a miss rather than a partially populated `Title`.
- A failed delete of a corrupt entry must still leave the read resolving to `undefined`.
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

- [ ] **Step 1: Write the failing storage tests**

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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/platform/webextension.test.ts`

Expected: FAIL because wrong-typed values are currently returned and arrays are asserted to `FetchResponse`.

- [ ] **Step 3: Add the shared storage guard**

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

- [ ] **Step 4: Narrow the adapter reads and the background response**

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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/platform/webextension.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/adapter.ts src/platform/webextension.ts tests/unit/platform/webextension.test.ts
git commit -m "refactor(platform): validate storage and background payloads"
```

---

### Task 3: Validate cache entries and delete corrupt reads

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

- [ ] **Step 1: Update the existing cache tests**

In `tests/unit/core/cache/cache.test.ts`:

- Rename "should return cache entry even without title data" to "should treat an entry without title data as a cache miss" and assert `undefined`, one warning, and a delete of `fmc:missing_data`.
- Change the string `imdbRating` values in "should return CacheEntry with getTitle for valid entry" and "should identify expired entry" to finite numbers so those tests keep covering successful reads.

- [ ] **Step 2: Write the failing validation tests**

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

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: FAIL because malformed entries are still returned and invalid keys are not deleted.

- [ ] **Step 4: Implement the cache parser**

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

- [ ] **Step 5: Implement best-effort deletion in the cache manager**

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

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 7: Commit**

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

- [ ] **Step 1: Update and extend the content tests**

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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/targets/extension/content.test.ts`

Expected: FAIL because the content script still asserts storage values and keeps stale values.

- [ ] **Step 3: Narrow the content bootstrap and listener**

In `src/targets/extension/content.ts`:

- Import `isStorageValue` from `../../platform/adapter`.
- Construct the adapter first, then seed it with `const stored = await adapter.storageGetAll()`.
- Remove the direct `browser.storage.local.get(null)` call and its assertion.
- In the listener, assign `v.newValue` only when `isStorageValue` accepts it; otherwise `delete stored[k]`. Keep the visual-settings redecorate check unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/targets/extension/content.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Verify no old parser imports remain**

Run: `rg "core/api/parse-utils|api/parse-utils" src tests`

Expected: no output.

- [ ] **Step 2: Verify the boundary files satisfy the disabled rule**

Run:

```bash
npx eslint src/core/cache/cache-entry.ts src/core/cache/cache-manager.ts src/platform/webextension.ts src/targets/extension/content.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'
```

Expected: no findings.

- [ ] **Step 3: Run the full local check**

Run:

```bash
npm run type-check && npm run lint && npm run format:check && npm run audit && npm run build && npm run test:coverage
```

Expected: all commands pass and coverage stays at or above the configured thresholds.

- [ ] **Step 4: Review the final diff**

Run: `git diff origin/main --stat && git diff origin/main`

Expected: only the four boundary files, `src/platform/adapter.ts`, `src/core/parse-utils.ts`, the moved test, and the affected tests and docs. No `dist/` or `coverage/` changes.

- [ ] **Step 5: Commit any remaining documentation updates**

If ticking this plan changed the file, commit it:

```bash
git add docs/superpowers/plans/2026-11-05-cache-storage-validation.md
git commit -m "docs(cache): tick the storage validation plan"
```

---

## Final Checklist

- [ ] `CacheEntry.fromJSON` accepts `unknown` and returns `CacheEntry | undefined`.
- [ ] A non-string storage value and malformed JSON both become a miss.
- [ ] An entry with missing, wrong-typed, or legacy fields becomes a miss.
- [ ] The legacy null entry remains accepted.
- [ ] A corrupt entry is deleted best-effort; a failed delete does not reject the read.
- [ ] `WebExtensionAdapter.storageGet` and `storageGetAll` return only valid `StorageValue` entries.
- [ ] `httpFetch` narrows the background response without an assertion.
- [ ] The content bootstrap uses `adapter.storageGetAll()` and the listener ignores invalid values.
- [ ] `parse-utils.ts` lives at `src/core/parse-utils.ts` and every import points there.
- [ ] The full local check and the targeted rule check pass.
