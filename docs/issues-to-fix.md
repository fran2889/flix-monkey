# FlixMonkey: Outstanding Issues to Fix

**Compiled:** 2026-06-20
**Sources:** `docs/project-review.md` (2026-06-07) and `docs/project-review-2026-06-19.md`
**Scope:** Issues only (no proposed features). Every item below was re-verified against the
current source on 2026-06-20 and confirmed **still present**. Issues from the source reviews
that are already fixed are listed at the end for traceability.

---

## Bugs / Correctness

### C1. Cross-tab rate-limit race in the request queue

`src/core/request-queue.js:71-75`. On the no-wait path the queue sets `#lastLocalReqTime`
and writes `fm_last_req` **without re-reading** the shared key first (the comment even states
"Fire immediately without re-reading storage"). Two Netflix tabs can each compute `wait === 0`
and fire simultaneously, violating the global rate limit and tripping 429s (XMDB at 1500ms is
most exposed). Re-read `fm_last_req` immediately before firing on the no-wait path; accept any
residual raciness as a documented limitation.

### C2. In-flight dedup key ≠ cache key

`src/core/app.js:85` vs `src/core/cache.js:33-38`. Dedup uses `displayTitle.toLowerCase()`;
the cache slugifies (`[^a-z0-9]+` → `_`, trim `_`). Titles differing only by punctuation or
whitespace bypass in-flight dedup yet collide on the same cache key → duplicate concurrent
lookups and a possible double-write race. Extract one shared slug function and use it in both
layers.

### C3. `getInt` / `getFloat` can return a non-numeric fallback

`src/core/config-manager.js:39-49`. When the parsed value is `NaN`, the methods return the
`fallback` argument verbatim. A call like `getInt(key)` (no fallback) returns `undefined`,
which flows into `cache.js` `getTtlMs(undefined)` → `NaN` → an entry that **never expires**.
Harden both methods to guarantee a numeric return independent of the caller's fallback.

### C4. Overlay truthiness checks drop legitimate `0` / `0%` ratings

`src/core/overlay.js:158, 170, 177`. `if (rating)`, `&& rtRating`, `&& mcRating` treat a
genuine `0`/`0%` score as absent, so it renders as N/A or is omitted. Use `!= null` (or an
explicit numeric check) for rating presence.

### C5. `parseRatings` can throw on a `null` array element

`src/core/api-clients.js:37`. `ratings.find(r => sourcePattern.test(r.source || r.Source))`
dereferences `r` unconditionally; a `null`/`undefined` element in an OMDB `Ratings` array
throws. Guard the element (`r && (...)`) before accessing properties.

### C6. No `document.contains()` guard before injecting the overlay

`src/core/app.js:107-115`. During the up-to-30s `await promise`, Netflix may detach or replace
the container. `injectOverlay` then attaches orphaned DOM to a removed node. Add a
`document.contains(container)` check before injecting (the loading-overlay removal in the
`finally` is harmless either way).

### C7. `debug` logging silently broken on userscript host

`src/core/logger.js:28` checks `this.#adapter.configGet('debug') === true`, but
`UserscriptAdapter.configGet` (`src/platform/userscript.js:83-85`) returns the raw
`GM_getValue` result, which may be the string `"true"` if ever stored as a string. The strict
`=== true` then fails and debug logging never activates. `WebExtensionAdapter` returns the
typed value, so the two platforms diverge. Normalize the boolean (in `configGet` or
`ConfigManager`) or compare loosely.

---

## Design Issues

### D1. OMDB `search()` is a no-op

`src/core/api-clients.js:280-282` returns `{ title: displayTitle }` unchanged, so
`getDetails` queries OMDB with `t=displayTitle` (fuzzy match). When the Netflix display name
diverges from the OMDB canonical name, this silently returns the wrong title. Use a real OMDB
search step, or document the limitation explicitly.

### D2. No client fallback chain

`src/core/api-manager.js`. `ApiClientManager` holds a single `#client` chosen at startup. If
that provider gets auto-disabled (4xx), every title returns `notFound` until the user manually
resets. Support an ordered client list with fallback.

### D3. Only `overlayCorner` re-renders existing overlays

`src/targets/extension/content.js:36-38`. The `storage.onChanged` listener calls
`refreshStyles()` only for `overlayCorner`. Other visual settings (`showRtRating`,
`showMcRating`, `enableFadeUnderRating`, `fadeRatingThreshold`) update stored state but on-screen
overlays don't update until scroll/reload. Re-decorate (clear + `decorateRoot(document)`) when
any visual setting changes.

### D4. Cross-provider rating blending for rated entries

`src/core/cache.js:62`. The read filter only discards **unrated** entries from a different
`activeSource` (`if (!titleObj.hasRating && titleObj.source !== activeSource) return null;`).
A _rated_ entry written by a previously-selected provider is still served after switching
providers, until its TTL expires (e.g. OMDB MC/RT scores persist after switching to imdbapi).
Make the read source-aware for rated entries, or document this as intended.

### D5. Redundant disabled-client gating (TOCTOU)

`src/core/api-manager.js:52-58` checks `getStatus()` then `BaseApiClient.fetch`
(`src/core/api-clients.js:167`) re-checks `isDisabled()`, straddling an `await`. Two checks of
the same gate around async boundaries. Clarify single ownership of the disabled gate.

### D6. `disable()` purge is incomplete

`src/core/api-clients.js:127-133`. `disable()` clears pending queue items but not the request
already shifted and in-flight, which can still complete after the client is "disabled".

### D7. `storageGet` returns `null`, contract says `undefined`

`src/platform/webextension.js:34` and `src/platform/userscript.js:24` both `?? null`, but the
`PlatformAdapter` JSDoc contract (`src/platform/adapter.js:39`) promises `undefined` for a
missing key. Align the contract and the implementations.

### D8. Divergent config reactivity between platforms

Userscript reads config live via `GM_getValue` but reloads on save; WebExtension reads a
snapshot kept current by `storage.onChanged` (`src/targets/extension/content.js:32-39`), which
only re-renders for `overlayCorner` (see D3). Document the model and converge the behaviors.

---

## Code Quality

### Q1. `SettingsUI` mixes access-modifier conventions

`src/core/ui/settings-ui.js`. `adapter`, `fields`, `onSave` are public; `#cacheManager`,
`#disabledClientsManager`, `#container` use `#private`; `_validate`, `_injectStyles`,
`_groupFields`, `_createField` use the `_underscore` convention. Standardize on `#`.

### Q2. `setConfigData()` called as a side effect of `render()`

`src/core/ui/settings-ui.js:37-38`. Rendering the UI mutates adapter config state (reads
storage and calls `setConfigData`). Move config loading out of `render()`.

### Q3. No error feedback in `clearCache` / `resetClients`

`src/core/ui/settings-ui.js:250-266`. Both `await` their manager calls with no `try/catch`; a
rejection leaves the status div unchanged and propagates silently.

### Q4. Modal DOM appended in the constructor

`src/core/ui/modal.js:56`. `new Modal(...)` appends the overlay to `document.body` immediately,
mutating live DOM before `open()`. Append in `open()` and remove on `close()`.

### Q5. `httpFetch` timeout never cleared

`src/platform/webextension.js:62-64`. The `setTimeout` behind the timeout race is never
cleared on success, leaving a dangling timer per request. Clear it after `Promise.race`
settles.

### Q6. `getClient()` breaks encapsulation with no production caller

`src/core/api-manager.js:33`. Exists only for test introspection (no `src/` caller). Remove it
and test via behavior, or document its test-only intent.

### Q7. MC and RT badges are unlinked

`src/core/overlay.js:170-181`. IMDb gets a clickable `<a>`; MC and RT are plain `<div>`. Add
navigable links (RT especially is a natural target).

### Q8. Duplicated TTL validator across config fields

`src/core/config-fields.js` (validators on `cacheTtlRatedOldYear`, `cacheTtlRatedNewYear`,
`cacheTtlNoRating`, lines ~95-139). Extract a shared validator helper.

### Q9. `runIdle` references `window` unguarded

`src/core/utils.js:55`. `window.requestIdleCallback` is referenced without checking that
`window` exists — a minor portability risk on non-standard userscript hosts.

### Q10. `Title` documented "immutable-style" but mutated post-construction

`src/core/title.js:32` says "Immutable-style", yet `BaseApiClient.fetch`
(`src/core/api-clients.js:172-173`) assigns `displayTitle`/`source` after construction. Either
make it truly immutable or drop the claim.

---

## Testing / Tooling

### T1. Coverage thresholds lack `branches` / `statements`

`vitest.config.js:10`. Only `{ lines: 90, functions: 90 }` are enforced; branch and statement
coverage are unmeasured. Add `branches`/`statements` thresholds (the original 2026-06-07 review
also noted they sit well below actual coverage — ratchet upward).

---

## Documentation

### Doc1. Node version mismatch

`README.md:127` and `CONTRIBUTING.md:20` say Node `>= 22`, but `package.json:53`, `.nvmrc`
(`24`), and CI require `>= 24`. Fix both docs.

### Doc2. Rate-limit value mismatch

`src/core/constants.js:33` sets `IMDBAPI: 4000`, but `AGENTS.md:237` documents `IMDBAPI 1000`.
Reconcile and confirm the intended value (4s/request makes large browse grids slow to
decorate).

### Doc3. README changelog section is stale

`README.md:107-109` says the changelog "will be automatically generated … upon the first
release", but `CHANGELOG.md` already exists (currently at `1.0.1`). Update the section to link
the existing changelog.

### Doc4. Userscript lacks `@updateURL` / `@downloadURL`

`src/targets/userscript/metadata.js`. Installed userscripts won't auto-update; point these at
the release asset.

### Doc5. No explicit manifest CSP

`src/targets/chrome/manifest.json` and `src/targets/firefox/manifest.json` have no
`content_security_policy.extension_pages` (relying on the MV3 default `script-src 'self'`). Add
one for defense-in-depth and documented intent.

---

## Already Resolved Since the Source Reviews

These appeared in the source reviews but are **fixed** in the current code (verified
2026-06-20); listed for traceability only:

- **options.js missing `logger`** — `ConfigManager`/`CacheManager` now receive `logger`
  (`src/targets/extension/options.js:28-29`).
- **Loading overlay not removed on error** — `#decorateContainer` now uses `try/finally`
  (`src/core/app.js:113-115`).
- **Chrome service worker sender validation** — now present
  (`src/targets/chrome/service-worker.js:21`).
- **`options.js` untested** — `tests/unit/targets/options.test.js` now exists.
- **`content.js` `onChanged`/`refreshStyles` untested** — now covered
  (`tests/unit/targets/content.test.js:79-90`).
- **`npm test` ran live-API integration tests** — default `test` script now runs only
  `tests/unit tests/ui`; integration moved to `test:integration` / nightly workflow.
- **`type` missing from `TitleOptions` typedef** — now documented (`src/core/title.js:28`).
- **`fetch-proxy` unvalidated `responseType` (blob risk)** — now only `json`/`text` paths
  exist (`src/targets/extension/fetch-proxy.js:37`).
