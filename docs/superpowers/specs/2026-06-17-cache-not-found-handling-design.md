# Cache Not-Found Handling

**Date:** 2026-06-17
**Scope:** Stop caching "not found" results that stem from errors or disabled clients; scope genuine not-found cache entries to their source provider

---

## Problem

When an API rate limit is exhausted, the client is disabled for 1 hour. During that hour, every title lookup produces a `Title.notFound()` that gets cached with a 1-day TTL. After the client recovers, those titles are still served as "not found" from cache and never retried.

A second dimension: cache keys are provider-agnostic (`fmc:<slug>`). A title genuinely not found on one provider gets cached, and switching to a different provider still serves the stale miss.

### Root causes

1. `ApiClientManager.getData()` caches `Title.notFound()` for disabled clients — caching a result we never actually looked up.
2. `BaseApiClient.fetch()` catches all errors and returns `null`, making genuine not-found indistinguishable from API errors. Both get cached.
3. Cache entries don't track which provider produced them, so provider switches don't invalidate stale misses.
4. `XmdbApiClient.search()` and `OmdbApiClient.search()` return `null` for missing API keys — same `null` as genuine not-found.

---

## Design

### 1. Don't cache disabled-client results

In `ApiClientManager.getData()`, when the client is unhealthy, return `Title.notFound(displayTitle, source)` to the caller but skip `cache.write()`.

### 2. Don't cache error results

Remove the try/catch from `BaseApiClient.fetch()` so errors propagate. In `ApiClientManager.getData()`, wrap the `fetch()` call in try/catch:

- `fetch()` returns `null` → genuine not-found, cache it
- `fetch()` throws → log a warning, return `Title.notFound(displayTitle, source)` without caching

### 3. Throw on soft errors in `getDetails()`

`getDetails()` returning `null` should mean genuine not-found, not an API error. Update subclasses:

| Client  | Condition                             | Current       | New                                                               |
| ------- | ------------------------------------- | ------------- | ----------------------------------------------------------------- |
| XMDB    | `!detailsJson \|\| detailsJson.error` | return `null` | throw                                                             |
| IMDBAPI | `!detailsJson \|\| detailsJson.error` | return `null` | throw                                                             |
| OMDB    | `json.Response === 'False'`           | return `null` | return `null` (genuine not-found; OMDB's search is a passthrough) |

### 4. Validate API keys in `getStatus()`

XMDB and OMDB override `getStatus()` to return unhealthy when no API key is configured. Remove the `if (!apiKey) return null` guards from their `search()` methods.

### 5. Scope not-found cache entries to source provider

`Title.notFound(displayTitle, source)` accepts and sets `source`. `Title.source` is already serialized into cache entries.

`CacheManager.read()` accepts `activeSource`. After deserializing:

- Has ratings → serve regardless of source (ratings are provider-agnostic)
- Not-found (`!hasRating`) and `source === activeSource` → serve if not expired
- Not-found and `source !== activeSource` → return `null` (cache miss)

Old entries without `source` (`null`) won't match any active provider, so they're treated as misses and retried — correct behavior.

Obsolete entries are not deleted on read — they'll be overwritten on the next successful fetch.

---

## Files Changed

| File                      | Change                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/title.js`       | `notFound(displayTitle, source)` accepts and sets `source`                                                                                                                                              |
| `src/core/cache.js`       | `read()` accepts `activeSource`; source-mismatch not-found entries return `null`                                                                                                                        |
| `src/core/api-manager.js` | Disabled path skips cache. `fetch()` wrapped in try/catch: errors return not-found without caching. Sets source on not-found Titles. Passes active source to `cache.read()`                             |
| `src/core/api-clients.js` | Remove try/catch from `BaseApiClient.fetch()`. XMDB/IMDBAPI `getDetails()` throw on error responses. XMDB/OMDB remove API key guards from `search()`. XMDB/OMDB override `getStatus()` to check API key |
