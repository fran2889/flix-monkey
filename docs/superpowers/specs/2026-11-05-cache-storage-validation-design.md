# Validate cache and storage payloads at their boundaries

**Date:** 2026-11-05

**Status:** accepted

**Revision:** 2026-11-05, the cached title payload is rebuilt with the API parser
pattern instead of being validated in place and cast at hydration time. The
cache parser and the strict title payload decisions below reflect the revision.

**Size:** small change

## Intent

Treat every value read from cache or platform storage as untrusted. A corrupt or
legacy value must become a cache miss or an ignored setting, never an exception
or a partially populated `CacheEntry` or `Title`.

## Context

The four boundaries named by issue #232 parse stored values with type
assertions:

- `CacheEntry.fromJSON` asserts the result of `JSON.parse`.
- `CacheManager.read` asserts the storage value to `string`.
- `WebExtensionAdapter` asserts `browser.storage.local` results and the
  background fetch response.
- The extension content script asserts its storage snapshot and its
  `storage.onChanged` values.

Invalid JSON already becomes a cache miss, but only because the exception is
caught around the assertion. Missing or wrong-typed fields can still produce an
entry whose `getTitle` result is only partly populated, and storage values of
the wrong type leak into the config snapshot unchanged.

The API layer already has throwing field readers in
`src/core/api/parse-utils.ts`. They are generic validation helpers, not
API-specific code, so the cache should reuse them instead of growing a second
set.

There is no expiry sweep in the current code. Corrupt cache entries are removed
only by a migration or Clear Cache.

## Goals

- Validate the entire cache entry envelope and the cached `Title` payload before
  a `CacheEntry` exists.
- Return a cache miss for truncated JSON, non-object JSON, missing required
  fields, wrong-typed fields, and legacy shapes.
- Never throw from the cache read path, including when deleting an invalid
  entry fails.
- Validate every `StorageValue` crossing the WebExtension storage and content
  bootstrap boundaries.
- Reuse the existing field readers from one core-level parser module.
- Add tests for truncated JSON, wrong-typed fields, a legacy payload shape, and
  a valid JSON payload that is not an object.

## Non-goals

- No schema library or new dependency.
- No migration for cache entries. Invalid entries are disposable and refetched.
- No change to cache keys, TTL selection, short-circuit refresh, or `Title`
  normalization.
- No cleanup of unrelated `as` assertions outside the four boundary files.
- No enablement of `@typescript-eslint/no-unsafe-type-assertion`; issue #237
  owns that.

## Anti-goals

- Silently ignoring a wrong-typed cached rating and serving a hit.
- Writing during a cache read unless an invalid entry has to be removed.
- Letting a failed cleanup turn a cache miss into an exception.
- Adding disable comments.

## Constraints

- `strict` and `exactOptionalPropertyTypes` are enabled.
- ESLint complexity is capped at 10.
- Exported declarations need JSDoc with `@param` and `@returns` where
  applicable.
- Shared parser helpers live at `src/core/parse-utils.ts`; the cache must not
  import from `src/core/api/`.
- Legacy literal `null` values for optional top-level fields (`imdbId`,
  `expires`) remain normalized to `undefined`, matching the existing behavior.
- ASCII only and no em-dashes.

## Approaches considered

1. **Cache-local validation.** Add a parallel set of predicates in
   `cache-entry.ts`. This avoids touching the API layer, but duplicates the
   optional readers and creates two validation vocabularies. Rejected.
2. **Move the API parser helpers to the core and reuse them (chosen).** The
   readers are already generic. Move `src/core/api/parse-utils.ts` to
   `src/core/parse-utils.ts`, update its seven import sites, and let the cache
   parser throw `ParseError` internally while `CacheEntry.fromJSON` catches it
   and returns `undefined`. This removes duplication and keeps the cache
   independent of the API layer.
3. **Use a schema library.** Rejected because the project has no runtime
   dependencies and four payloads do not justify the bundle cost.

### Revision approaches

1. **Rebuild `TitleData` and store it on the entry (chosen).** The cache parser
   uses the same shape as the API parsers: read the known fields into a fresh
   typed object. The compiler enforces the `TitleData` shape, the hydration
   assertion disappears, and unknown keys are dropped rather than rejected.
2. **Rebuild the payload but keep the entry's payload as `unknown`.** The
   parser becomes consistent, but `Title.fromCacheJSON` still asserts the type
   during hydration, so the second validation boundary remains. Rejected.
3. **Store a hydrated `Title` on the entry.** This removes lazy hydration, but
   pushes expiry and serialization into one object with no benefit over the
   first approach. Rejected.

## Decisions

- **Shared parser module.** Move `parse-utils.ts` and its unit test to the core
  level. Update the four client imports, `BaseApiClient`, and the two test
  imports. Broaden the `ParseError` description to cover untrusted input
  generally.
- **Finite numbers.** Tighten `optionalNumber` to reject non-finite numbers as
  well as wrong types. This matches the cache's expiry rule and adds one shared
  test.
- **Storage guard.** Export `isStorageValue(value: unknown): value is
StorageValue` from `src/platform/adapter.ts`. A storage value is a string or a
  boolean; everything else is absent as far as the adapter is concerned.
- **WebExtension reads.** `storageGet` returns the value only when
  `isStorageValue` accepts it, otherwise `undefined`. `storageGetAll` builds a
  new record containing only valid values.
- **Background response.** `httpFetch` narrows the background message with a
  guard instead of asserting `FetchResponse`, so the whole file is clean under
  the rule. An absent or invalid response keeps the existing
  `empty background response` error.
- **Content bootstrap.** The content script constructs the adapter first, calls
  `adapter.storageGetAll()`, and seeds the snapshot with the validated record.
  It no longer reads `browser.storage.local` or asserts the shape itself.
- **Content change listener.** The listener accepts a new value only when
  `isStorageValue` accepts it. An invalid value or an absent `newValue` removes
  the key from the snapshot, so config falls back to its default instead of
  keeping a stale value. Visual setting keys still trigger `redecorate`.
- **Cache parser.** `CacheEntry.fromJSON(raw: unknown): CacheEntry | undefined`
  handles a non-string storage value and a `JSON.parse` failure by returning
  `undefined`. It then calls a local `parseCacheEntry` that uses
  `assertRecord`, `requiredString`, `optionalString`, and `optionalNumber` and
  throws only `ParseError` for invalid data. `fromJSON` catches `ParseError` and
  returns `undefined`; any other error propagates.
- **Cache entry shape.** The parser requires a non-array object. Unknown keys
  are ignored, matching the API parsers. `displayTitle` must be a non-empty
  string, `imdbId` a string or null, `expires` a finite number or null, and
  `data` a present, non-array object.
- **Title payload parser.** A module-level `parseTitleData(raw): TitleData`
  rebuilds a fresh payload from the known keys, using the reader return values
  so the compiler enforces the `TitleData` shape. Optional string fields must
  be strings or null; optional numeric fields must be finite numbers or null.
  Unknown keys, including a legacy nested `displayTitle` or `rating` field, are
  dropped. Legacy string ratings still miss. A legacy payload with only unknown
  keys becomes empty `TitleData`; `ApiClientManager` already refuses to serve a
  title with no rating and no matching source as a hit.
- **Stored payload type.** `CacheEntry.#data` becomes `TitleData`, and
  `getTitle()` builds `new Title({ ...data, displayTitle })` directly, so the
  cache path contains no assertion. `Title.fromCacheJSON` loses its last
  production caller and is removed with its tests. `Title.toCacheJSON` and
  `Title` normalization stay unchanged.
- **Cache read.** `CacheManager.read` treats `undefined` as a plain miss. Any
  other rejected value logs the existing `Cache entry corrupt, treating as
miss` warning, deletes the key best-effort, and returns `undefined`. A failed
  delete is logged at debug level and does not throw.
- **Entry limit.** An entry with no `data` is invalid. Cache hits always have a
  serialized `Title` payload, including the empty object written for a
  not-found title.
- **Tests.** Cover truncated JSON, non-object JSON, missing `displayTitle`,
  wrong-typed entry and title fields, the existing legacy null entry, invalid
  storage values, and a failing delete during read. Replace the cache test that
  asserts an unknown `rating` field is a miss with one that asserts the payload
  is rebuilt from the known keys. Cover the removed `Title.fromCacheJSON` cases
  in the cache parser tests. Update cache mock presets and `ApiClientManager` tests
  that pass `undefined` data to pass empty `TitleData` instead. Replace the two
  cache tests that currently use a string rating with numeric ratings so they
  continue to test successful reads; the wrong-type cases cover rejection.

## Verification

- `npm run type-check`, `npm run lint`, `npm run format:check`, and `npm test`
  pass.
- `npx eslint src/core/cache/cache-entry.ts src/core/cache/cache-manager.ts
src/platform/webextension.ts src/targets/extension/content.ts --rule
'{"@typescript-eslint/no-unsafe-type-assertion":"error"}'` reports no
  findings.
- `rg "core/api/parse-utils|api/parse-utils" src tests` finds nothing.
- A corrupt entry read and a failed cleanup both resolve to `undefined` without
  rejecting.
- A `storage.onChanged` event with a wrong-typed value leaves a valid
  configuration state and does not throw.
- `rg "fromCacheJSON" src` finds nothing, and no cache path contains a type
  assertion.
- A stored payload with an unknown key and valid known keys reads back with only
  the known keys.

## What is left to the builder

- The exact `parseTitleData` placement and whether `parseCacheEntry` reads the
  envelope fields inline or in a helper.
- Test names and whether the new cache cases live in `cache.test.ts` or a
  dedicated file.
- Whether the content listener test asserts the invalid key is removed or only
  that the snapshot remains valid.
