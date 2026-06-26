# Design: Fix Correctness Bugs C1–C7

**Date:** 2026-06-26
**Source:** `docs/issues-to-fix.md` — Bugs / Correctness section
**Scope:** Seven targeted bug fixes, each shipped as a separate commit.

---

## C1 — Cross-tab rate-limit race in the request queue

**File:** `src/core/request-queue.js:71-75`

**Problem:** On the no-wait path (`wait === 0`) the queue sets `#lastLocalReqTime` and writes `fm_last_req` without re-reading the shared storage key first. Two Netflix tabs can each compute `wait === 0` simultaneously and fire back-to-back, violating the global rate limit and tripping 429s (XMDB at 1500ms is most exposed).

**Fix:** After computing `wait === 0`, re-read `fm_last_req` from storage before claiming the timeslot. If the fresh value shows another tab fired within `minInterval`, `continue` to re-enter the loop and wait. Residual raciness in the write-after-read window is documented as an accepted limitation.

```
// No wait needed — re-read storage to reduce cross-tab race before claiming the slot
if (this.#globalSyncKey && this.#adapter) {
    const str = await this.#adapter.storageGet(this.#globalSyncKey);
    const parsed = parseInt(str, 10);
    const freshGlobal = Number.isNaN(parsed) ? 0 : parsed;
    if (Date.now() - freshGlobal < this.#minInterval) continue;
}
this.#lastLocalReqTime = Date.now();
// ... existing storageSet ...
```

---

## C2 — In-flight dedup key ≠ cache key

**Files:** `src/core/app.js:85`, `src/core/cache.js:33-38`, `src/core/utils.js`

**Problem:** `app.js` builds the dedup key with `displayTitle.toLowerCase()`; `CacheManager.#getCacheKey` slugifies (replaces `[^a-z0-9]+` with `_` and trims leading/trailing `_`). Titles that differ only by punctuation (e.g. `"Schitt's Creek"` vs `"schitts_creek"`) bypass in-flight dedup yet collide on the same cache key, causing duplicate concurrent lookups and a potential double-write race.

**Fix:** Extract a `slugify(str)` helper into `src/core/utils.js` (already imported by `app.js`). Both `CacheManager.#getCacheKey` and `app.js` `#decorateContainer` use it, making `dedupKey` and cache key always identical.

```js
// utils.js
export function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}
```

---

## C3 — `getInt` / `getFloat` can return a non-numeric fallback

**File:** `src/core/config-manager.js:39-49`

**Problem:** When the parsed value is `NaN`, both methods return `fallback` verbatim. A call like `getInt(key)` (no fallback) returns `undefined`, which flows into `CacheManager.#calculateTtl` → `getTtlMs(undefined)` → `NaN` → an entry that never expires.

**Fix:** When the primary parse yields `NaN`, also parse `fallback` numerically. If that too is `NaN` (e.g. `fallback` is `undefined`), return `0`. Both methods are now guaranteed to return a finite number regardless of the caller's fallback.

```js
getInt(key, fallback) {
    const val = this.get(key, fallback);
    const num = Number.parseInt(val, 10);
    if (!Number.isNaN(num)) return num;
    const fb = Number.parseInt(fallback, 10);
    return Number.isNaN(fb) ? 0 : fb;
}

getFloat(key, fallback) {
    const val = this.get(key, fallback);
    const num = Number.parseFloat(val);
    if (!Number.isNaN(num)) return num;
    const fb = Number.parseFloat(fallback);
    return Number.isNaN(fb) ? 0.0 : fb;
}
```

---

## C4 — Overlay truthiness checks drop legitimate `0` / `0%` ratings

**File:** `src/core/overlay.js:158, 170, 177`

**Problem:** `if (rating)`, `&& rtRating`, `&& mcRating` treat a genuine `0` / `0%` score as absent, so it renders as N/A or is omitted. `Title` normalizes all missing/N/A values to `null`; `0` is a valid score.

**Fix:** Replace bare truthiness checks with `!= null` checks.

| Before        | After                 |
| ------------- | --------------------- |
| `if (rating)` | `if (rating != null)` |
| `&& rtRating` | `&& rtRating != null` |
| `&& mcRating` | `&& mcRating != null` |

---

## C5 — `parseRatings` can throw on a `null` array element

**File:** `src/core/api-clients.js:37`

**Problem:** `ratings.find(r => sourcePattern.test(r.source || r.Source))` dereferences `r` unconditionally. A `null` or `undefined` element in an OMDB `Ratings` array throws a `TypeError`.

**Fix:** Add a null guard before property access:

```js
const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
```

---

## C6 — No `document.contains()` guard before injecting the overlay

**File:** `src/core/app.js:107-115`

**Problem:** During the up-to-30s `await promise`, Netflix may detach or replace the container node. `injectOverlay` then attaches orphaned DOM to a removed node — no visible effect, but a subtle correctness issue.

**Fix:** Add `document.contains(container)` to the existing guard before calling `injectOverlay`. The `finally` block (removing the loading overlay) is harmless on a detached node and is unchanged.

```js
if (!this.#renderer.hasOverlay(container) && document.contains(container)) {
    this.#renderer.injectOverlay(container, data);
    this.#renderer.applyFade(container, data, fadeable);
}
```

---

## C7 — `debug` logging silently broken on userscript host

**File:** `src/core/logger.js:28`

**Problem:** `this.#adapter.configGet('debug') === true` uses strict equality, but `UserscriptAdapter.configGet` returns the raw `GM_getValue` result, which may be the string `"true"` if stored as a string. The strict check then fails and debug logging never activates on the userscript platform.

**Fix:** Normalize by converting the raw value to a string before comparing:

```js
if (String(this.#adapter.configGet('debug')) === 'true') {
```

This correctly handles boolean `true` (WebExtension) and string `"true"` (userscript) while rejecting `false`, `undefined`, `"false"`, `"0"` etc.

---

## Commit Plan

Each fix is independent and will be committed separately in C1–C7 order:

| Commit                                                                           | Files touched                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `fix(request-queue): re-read storage before claiming timeslot on no-wait path`   | `src/core/request-queue.js`                                 |
| `fix(dedup): extract slugify helper and align dedup key with cache key`          | `src/core/utils.js`, `src/core/cache.js`, `src/core/app.js` |
| `fix(config): guarantee numeric return from getInt and getFloat`                 | `src/core/config-manager.js`                                |
| `fix(overlay): use != null checks to preserve zero ratings`                      | `src/core/overlay.js`                                       |
| `fix(api-clients): guard null element in parseRatings`                           | `src/core/api-clients.js`                                   |
| `fix(app): guard document.contains before overlay injection`                     | `src/core/app.js`                                           |
| `fix(logger): normalize debug flag to handle string "true" from userscript host` | `src/core/logger.js`                                        |

---

## Testing Notes

- C1: Unit test with two interleaved queue instances sharing a mock storage adapter; verify only one fires per interval.
- C2: Unit test with a title containing punctuation (e.g. `"Schitt's Creek"`); verify dedup key matches the cache key produced by `CacheManager`.
- C3: Unit test `getInt(key)` with no fallback when the stored value is missing/invalid; verify a number is returned.
- C4: Unit test `#createOverlay` with a `Title` whose `rating`, `rtRating`, `mcRating` are all `0`; verify all three badges render.
- C5: Unit test `parseRatings` with an array containing a `null` element; verify no throw.
- C6: Unit test `#decorateContainer` where `container` is removed from the DOM before `await promise` resolves; verify `injectOverlay` is not called.
- C7: Unit test `Logger.debug` with the adapter returning string `"true"`; verify the console method is called.
