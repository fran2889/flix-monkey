# Design: Correctness & Contract Fixes

**Date:** 2026-06-27
**PR structure:** One PR per issue; this doc and the implementation plan ship with PR 1.

---

## 1 — Unified visual-settings redecoration

### Problem

`content.js` only calls `refreshStyles()` when `overlayCorner` changes. The four other visual
settings (`showRtRating`, `showMcRating`, `enableFadeUnderRating`, `fadeRatingThreshold`) update
stored config but leave on-screen overlays stale until scroll or page reload.

### Design

**`OverlayRenderer`** gains `clearAllOverlays()`: queries all `.fm-rating-overlay` elements in
the document and removes them.

**`FlixMonkeyApp`** gains `redecorate()`:

1. `renderer.injectStyles()` — refreshes the CSS corner/position rule
2. `renderer.clearAllOverlays()` — removes stale overlay divs
3. `this.decorateRoot(document)` — re-injects fresh overlays with current config

**`startApp()`** replaces `refreshStyles` with `redecorate` in the returned handle.

**`content.js`** defines a `VISUAL_SETTINGS` set of all five keys: `overlayCorner`,
`showRtRating`, `showMcRating`, `enableFadeUnderRating`, `fadeRatingThreshold`. The
`storage.onChanged` handler calls `appRef.app?.redecorate()` when any of them are present in
`changes`. The `overlayCorner`-only branch is removed.

### Testing

- Replace existing `refreshStyles` tests in `content.test.js` with `redecorate` equivalents.
- Add tests asserting `redecorate` fires for each of the four previously-ignored visual keys.
- Add a unit test for `OverlayRenderer.clearAllOverlays()`.

---

## 2 — Single-ownership disabled gate

### Problem

`ApiClientManager.getData()` checks `client.getStatus()` (which internally calls `isDisabled()`),
then calls `client.fetch()` which immediately re-checks `isDisabled()`. Two checks of the same
condition across async boundaries.

### Design

Remove the `if (await this.isDisabled()) return null;` line from `BaseApiClient.fetch()`. The
disabled gate has single ownership in `getData()` via `getStatus()`. Add a JSDoc note to
`fetch()` that callers are expected to gate through `getStatus()` before invoking.

### Testing

No new tests. Any test that was specifically asserting the removed behaviour can be cleaned up
post-implementation.

---

## 3 — Mid-fetch disable guard

### Problem

`disable()` calls `queue.clear()` which drains pending queue items, but any request already
dequeued and in-flight in `httpFetch` completes regardless. A concurrent `disable()` call
(triggered by another title's 4xx failure) between `search()` and `getDetails()` in `fetch()`
goes undetected.

### Design

Add an `isDisabled()` check in `BaseApiClient.fetch()`, between `search()` and `getDetails()`:

```js
const match = await this.search(displayTitle);
if (!match) return null;
if (await this.isDisabled()) return null;
const titleObj = await this.getDetails(match, displayTitle);
```

The `disable()` JSDoc notes that any HTTP request already executing at the network level cannot
be aborted and may complete, but its result is discarded by the caller. This is accepted.

### Testing

- Add a test to `api-clients.test.js` simulating `disable()` being called between `search()` and
  `getDetails()`, asserting `getDetails()` is not called and `fetch()` returns `null`.

---

## 4 — `storageGet` contract alignment

### Problem

`WebExtensionAdapter.storageGet` and `UserscriptAdapter.storageGet` both return `null` for a
missing key (via `?? null`). The `PlatformAdapter` JSDoc promises `undefined`.

### Design

Update the `storageGet` JSDoc in `adapter.js` to document the return type as
`Promise<string|null>`. No implementation changes — the implementations are already correct and
all callers handle `null` safely.

### Testing

- Add tests to the platform adapter test files verifying that a missing key returns `null`.
