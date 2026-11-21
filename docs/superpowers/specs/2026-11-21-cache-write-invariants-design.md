# Cache Write Invariants Design

**Issue:** [#243 Prevent abandoned lookups from overwriting newer cache entries](https://github.com/fran2889/flix-monkey/issues/243)

## Intent

A rating lookup that outlives its caller can still write the cache. The previous approach tracked request generations and retained one lookup per title. That machinery is being removed because the racing requests return the same provider data in the common case, and because the cache can enforce the only invariant that matters: a good entry is not replaced by a worse one.

The cache becomes the single owner of write order and write policy. Lookup code stays simple.

## Goals

- A valid cache entry that has ratings is never replaced by a bare miss.
- A result whose IMDb ID differs from the current stored override is not cached.
- Writes for a title are serialized, so the bare-miss check cannot be bypassed by a save interleaving between its read and its write.
- A late lookup cannot undo an IMDb ID edit.
- Preserve the 30 second per-caller timeout and the not-found fallback render.

## Non-Goals

- One provider request per title. Concurrent decorations of the same title may duplicate requests.
- The late 4xx disable policy. Tracked in #316.
- A stale success overwriting a newer entry after refresh. Accepted as immaterial.
- A stale decoration painting over a newer one. Tracked in #315.
- Cross-tab atomicity and `clear()` serialization.
- Cache format, TTL, or migration changes.

## Constraints

- The checks run inside `CacheManager.write`; `CacheManager` serializes `write` per slug.
- `IdOverrideManager` is passed to `CacheManager` as a fourth constructor argument, within the four-parameter limit.
- `ApiClientManager` loses request ids and `invalidate`; the app deletes through `CacheManager.delete` directly.
- `FlixMonkeyApp` loses the in-flight map and its cleanup. Each decoration gets its own timeout race.
- No new dependencies.

## Approaches Considered

### A. Request generations and deduplication (previous)

Retains the raw lookup per title, gives every caller its own timeout, fences cache writes and 4xx disables with a request id, and serializes writes in `ApiClientManager`. Rejected: it protects races whose successful results carry the same data, and it spreads one concept across two layers.

### B. Checks in `ApiClientManager`

Adds the override manager to the manager and keeps the write chain there. Rejected: the cache remains last-write-wins, the manager gains a fifth dependency, and the policy lives away from the write it guards.

### C. Checks and serialization in `CacheManager` (chosen)

The cache enforces its own write invariants and ordering. `ApiClientManager` becomes read, fetch, write.

## Decisions

- `CacheManager` keeps a per-slug promise chain that only `write` enqueues on. The tail is registered synchronously and its rejection normalized, so one failed write does not reject later ones.
- `write` reads the cached entry after any earlier queued operation:
    - If the incoming title has no rating and no IMDb ID, and the existing entry is not expired and has a rating, skip the write and log at debug. An ID-only entry is deliberately not protected: when the retained ID lookup misses, the miss replaces the hint, which is the existing behavior and avoids repeating a failing ID lookup.
    - If an override exists and differs from the incoming `imdbId`, skip the write and log at debug.
    - Otherwise write as before.
- `delete` writes storage directly. It is not ordered against saves, so a save already in progress can repopulate the entry after a refresh or edit.
- `CacheStore.write` is documented as best effort: it may decline to store the title.
- `ApiClientManager.#fetch` awaits `cache.write` directly. Refresh and edit await `CacheManager.delete`.
- Refresh and IMDb ID edit set the override where applicable, await `cache.delete`, then redecorate.
- `#decorateContainer` keeps the narrowed lookup try and the uncached not-found fallback for a failed or timed-out lookup.
- The 2026-11-16 design and plan are superseded and removed.

## Residual Risk

- Concurrent decorations of one title can issue duplicate provider requests.
- A stale success can overwrite a newer one after refresh, including a lookup that started before the invalidation but reaches `cache.write` after it.
- Cross-tab writes are not serialized; the invariants hold within one page.
- `clear()` bypasses the chain and can race a write.
- If a provider canonicalizes an override to a different IMDb ID, the save is skipped.

## Testing

- Cache: a bare miss does not replace a rated entry; a bare miss replaces an ID-only entry; an expired entry is replaceable; an override mismatch is skipped; a matching override is written; a write queued behind a rejected write still runs; settling a write keeps a later queued write on the chain.
- Manager: cache hit, fetch, miss, and unhealthy client, without generation or fence cases.
- App: timeout and rejection render the fallback; refresh and edit delete the entry and redecorate; a render failure is not mistaken for a lookup failure.
