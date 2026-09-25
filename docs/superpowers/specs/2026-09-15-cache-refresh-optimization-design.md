/**

- SPDX-FileCopyrightText: 2026 Fran
- SPDX-License-Identifier: GPL-3.0-only
  */

# Cache Refresh Optimization Design

**Date:** 2026-09-15
**Status:** Approved
**Author:** Mistral Vibe

## Summary

This design introduces an optimization to the cache refresh mechanism that reduces unnecessary API calls by leveraging cached IMDb IDs. When a cache entry expires but contains an IMDb ID, the system will skip the search phase and proceed directly to fetching details using the known ID.

## Problem Statement

Currently, when a cache entry expires, the system performs a full lookup: `search(displayTitle)` followed by `getDetails(searchTitle)`. This is inefficient when the cached entry already contains an IMDb ID, as the search step is redundant.

Additionally, the current cache structure stores `displayTitle` inside the serialized `Title` object, which intermixes cache metadata (search keys) with API-returned data.

## Architecture Overview

### Cache Structure

**Current:**

```
{
  data: Title,        // Includes displayTitle, imdbId, ratings, etc.
  expires: number
}
```

**New:**

```
{
  displayTitle: string,      // Cache metadata: search key from Netflix
  imdbId: string | null,    // Cache metadata: identity key for short-circuit
  data: Title,              // API data: Title without displayTitle
  expires: number | null
}
```

The `displayTitle` field is extracted to the top level and excluded from the serialized `Title` in the `data` field. This creates a clean separation between cache-level metadata (search keys) and API-returned data.

### Data Flow

1. **Cache Hit (non-expired):**
    - `CacheManager.read()` returns a valid `CacheEntry`
    - `ApiClientManager` calls `entry.getTitle()` which reconstructs the Title with `displayTitle` from the cache entry
    - Title is returned to the caller

2. **Cache Expired with IMDb ID:**
    - `CacheManager.read()` returns an expired `CacheEntry` with `imdbId`
    - `ApiClientManager` calls `client.fetch(displayTitle, imdbId)`
    - Client skips `search()` and proceeds directly to `getDetails()` using the provided `imdbId`
    - Fresh data is fetched and written to cache

3. **Cache Miss or Expired without IMDb ID:**
    - `CacheManager.read()` returns `null` or an expired entry without `imdbId`
    - `ApiClientManager` calls `client.fetch(displayTitle)` for the full search flow

## Component Changes

### 1. Title Class (`src/core/title.js`)

**New methods:**

- `toCacheJSON()`: Returns a plain object representation of the Title excluding `displayTitle` for cache serialization
- `fromCacheJSON(obj, displayTitle)`: Static method to reconstruct a Title from cache data plus the `displayTitle` from the cache entry

These methods maintain backward compatibility while enabling the new cache structure.

### 2. CacheManager (`src/core/cache.js`)

**New class: `CacheEntry`**

- Encapsulates cache entry data with proper separation of concerns
- Provides `getTitle()` for valid entries (reconstructs Title with `displayTitle`)
- Provides `isExpired` property for expiry checking
- Provides access to `displayTitle` and `imdbId` at the entry level

**Modified methods:**

- `read(displayTitle, activeSource)`: Returns `CacheEntry | null`. For expired entries, returns the entry with full access to `displayTitle` and `imdbId`
- `write(displayTitle, titleObj)`: Writes entries in the new format with `displayTitle` and `imdbId` at the top level, and `data` containing the Title without `displayTitle`

### 3. ApiClientManager (`src/core/api-manager.js`)

**Modified method: `getData(displayTitle)`**

- Reads cache entry using the new `CacheEntry` class
- If valid and non-expired: returns `entry.getTitle()`
- If expired with `imdbId`: calls `client.fetch(displayTitle, entry.imdbId)`
- If cache miss or expired without `imdbId`: calls `client.fetch(displayTitle)`

### 4. BaseApiClient (`src/core/api-clients.js`)

**Modified method: `fetch(displayTitle, imdbId?)`**

- Adds optional `imdbId` parameter
- If `imdbId` is provided: skips `search()`, constructs a minimal Title with `displayTitle` and `imdbId`, proceeds directly to `getDetails()`
- If `imdbId` is not provided: existing behavior (search followed by details)

### 5. OMDbApiClient (`src/core/api-clients.js`)

**Modified method: `getDetails(searchTitle)`**

- Currently a pass-through since OMDb's search already returns full data
- Must support receiving a minimal Title (with only `displayTitle` and `imdbId`) and fetching full details by ID
- Will use the `i=tt1234567` endpoint parameter instead of `t=title` when called via the short-circuit path

### 6. Migration (`src/core/migrations.js`)

**New migration version:**

- Iterates over all `fmc:*` storage keys
- For each entry, parses the JSON and extracts `displayTitle` from the Title inside `data`
- Rewrites the entry in the new format with `displayTitle` and `imdbId` at the top level
- For the `data` field, re-serializes the Title without `displayTitle`
- Advances the `fm_data_version` after all entries are migrated

## Error Handling and Edge Cases

1. **Expired entry without `imdbId`:** Falls back to the full `search()` -> `getDetails()` flow
2. **Valid entry with ratings but no `imdbId`:** Returns the Title as-is; the `imdbUrl` getter will use `displayTitle` as fallback (which is populated from the cache entry)
3. **Corrupt cache entry:** Logged as warning, treated as cache miss
4. **OMDb short-circuit with ID:** Must handle the case where a minimal Title is passed to `getDetails()`

## Testing Strategy

### Unit Tests

**CacheManager:**

- Verify `displayTitle` and `imdbId` are stored at top level of cache entries
- Verify `data` field excludes `displayTitle`
- Verify `CacheEntry.getTitle()` reconstructs Title correctly with `displayTitle`
- Verify expired entries can be identified and provide access to `displayTitle` and `imdbId`

**ApiClientManager:**

- Verify cache hit returns Title from `entry.getTitle()`
- Verify expired entry with `imdbId` triggers short-circuit fetch
- Verify expired entry without `imdbId` triggers full fetch
- Verify cache miss triggers full fetch

**BaseApiClient:**

- Verify `fetch(displayTitle, imdbId)` skips `search()` and calls `getDetails()` directly
- Verify `fetch(displayTitle)` without `imdbId` uses full flow

**OMDbApiClient:**

- Verify `getDetails()` can fetch by ID when provided with a minimal Title
- Verify ratings are correctly extracted from ID-based response

**Migration:**

- Verify old cache entries are transformed to new format correctly
- Verify `displayTitle` is extracted and stored at top level
- Verify `imdbId` is extracted and stored at top level
- Verify `data` field no longer contains `displayTitle`
- Verify new entries are written in new format

### Edge Cases

- Entry with `imdbId` but no ratings
- Entry without `imdbId` but with ratings
- Not-found entries (cached misses)
- Entries with special characters in `displayTitle`

## Rollout Considerations

1. **Backward compatibility:** The migration will handle existing cache entries automatically
2. **No breaking changes:** The public API of `CacheManager`, `ApiClientManager`, and clients remains compatible
3. **Performance:** The short-circuit path reduces one API call (search) per expired entry with a known IMDb ID
4. **Storage impact:** Minimal - `displayTitle` and `imdbId` are moved from inside the serialized Title to the top level, with `displayTitle` removed from the Title serialization

## Files Modified

- `src/core/title.js` - Add serialization methods
- `src/core/cache.js` - Add `CacheEntry` class, update read/write
- `src/core/api-manager.js` - Update `getData()` to use new cache flow
- `src/core/api-clients.js` - Update `BaseApiClient.fetch()` and `OMDbApiClient.getDetails()`
- `src/core/migrations.js` - Add new migration version

## Files Added

- `src/core/cache-entry.js` - New `CacheEntry` class (or integrated into `cache.js`)

---

**Approval:**

- [x] Architecture approved
- [x] Component designs approved
- [ ] User review pending

**Next Steps:**

1. User reviews and approves this specification
2. Create implementation plan using writing-plans skill
3. Implement changes with corresponding tests
