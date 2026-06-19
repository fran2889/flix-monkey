# FlixMonkey: Project Quality Review

**Reviewed:** 2026-06-07  
**Version:** 0.10.0  
**Scope:** Full codebase (`src/`, `tests/`, tooling config)

---

## Overall Rating: **8.5 / 10**

A well-structured, intentionally designed browser extension with a clean platform-abstraction architecture, strong test coverage (97% statements, 92% branches), and disciplined module boundaries. The main weaknesses are a handful of real bugs (missing logger arguments, missing error cleanup), some encapsulation inconsistencies in the UI layer, and architectural single-points of failure (no multi-client fallback chain).

---

## 1. Architecture & Module Design

**Rating: 9 / 10**

The Platform Adapter pattern is the project's strongest design choice. All platform-specific code is cleanly isolated behind a stable interface (`PlatformAdapter`), letting the entire `src/core/` layer be platform-agnostic and fully testable under jsdom. The separation is respected throughout: no direct `GM_*` or `browser.*` calls leak into core code.

Module boundaries are tight and responsibilities are single. `CacheManager`, `DisabledClientsManager`, `RequestQueue`, and `ApiClientManager` each do exactly one thing. The `startApp()` factory in `app.js` is a clean composition root, and exposing only a narrow facade (`clearCache`, `resetDisabledClients`, `disconnect`, `refreshStyles`) from it is good encapsulation.

**Issues:**

- **Single client, no fallback chain.** `ApiClientManager` holds one `client` instance chosen at startup. If XMDB is configured but gets disabled, the user gets `notFound` for every title until they manually reset: there is no fallback to IMDb API. The architecture could support a client list with ordered fallback, but currently it doesn't.
- **`ApiClientManager.getClient()` breaks encapsulation** without any production call site: it exists only for test introspection. `src/core/api-manager.js:33`.
- **`startApp()` re-reads `apiClient` config only at init time.** Changing the provider in settings requires a reload, which the options page does trigger. By design, but undocumented.

---

## 2. Core: API Layer

**Rating: 8.5 / 10**

### `api-clients.js`

The `BaseApiClient` hierarchy is clean. Constructor injection of all dependencies enables easy test mocking. The `queuedFetch` → 4xx auto-disable pattern is a good reliability mechanism.

**Issues:**

- **OMDB `search()` is a no-op**: it returns the display title unchanged (`{ title: displayTitle }`) instead of calling a search endpoint. `OmdbApiClient.getDetails` then queries OMDB with `t=displayTitle`, which does fuzzy matching. For titles where the Netflix display name diverges from the OMDB canonical name (e.g. "The Witcher: Blood Origin" vs. "Witcher Blood Origin"), this silently returns wrong results. `src/core/api-clients.js:179–181`.
- **`parseRatings` is a module-level private function** shared by `OmdbApiClient` only. It's not exported and not tested in isolation; its `source` field dual-key lookup (`r.source || r.Source`) handles inconsistent OMDB capitalization but isn't documented.
- **`XmdbApiClient` creates its `RequestQueue` with a hardcoded `'fm_last_req'` storage key** that is different from the OMDB and IMDb queues (which pass `null`). If a user switches providers without clearing state, the old rate-limit timestamp could still throttle the new queue unnecessarily, though only XMDB actually uses cross-tab sync.

### `api-manager.js`

Thin and correct. The `getData` flow (check cache → check health → fetch → cache result) is easy to follow.

**Issue:** When the client is unhealthy, the result is cached as `notFound` with whatever TTL `cacheTtlNoRating` dictates. A 1-day cache on a "client disabled" result means the title won't be retried for a day even if the client recovers in an hour. Consider using a separate short TTL for "disabled at time of lookup" misses.

### `disabled-clients.js`

Simple and correct. The `resetAll()` call with `Promise.all` could theoretically TOCTOU on `isDisabled` + `storageSet`, but this is a management function called by user action, not in any hot path.

### `request-queue.js`

The cross-tab rate-limit sync via storage is a clever solution to a real problem (multiple Netflix tabs). Priority sorting on insert is correct. The `continue` loop strategy for waiting is clear.

**Issue:** After `await new Promise(r => setTimeout(r, wait))` and `continue`, the loop re-reads storage but does **not** re-sort the queue. New items enqueued during the sleep that have higher priority than the current head won't jump the queue until the next item is dequeued. Minor, but inconsistent with the stated priority guarantee.

---

## 3. Core: Application Lifecycle

**Rating: 8 / 10**

`app.js` handles a genuinely complex problem: decorating a dynamic SPA without double-rendering, with debouncing, in-flight deduplication, and across navigation events. The solution is well-structured.

**Issues:**

- **Loading overlay is never removed on error.** If `promise` in `#decorateContainer` rejects (timeout or API error), execution leaves via the thrown exception and the `⏳` loading overlay stays on the container indefinitely. The error is caught and logged by `decorateRoot`, but the DOM is never cleaned up. `src/core/app.js:107`. Fix: wrap the `await promise` in try/finally to remove the loading overlay on failure.

- **`decorateContainer` operates on potentially detached containers.** During `await promise` (up to 30 seconds), Netflix may have replaced or removed the container. Calling `injectOverlay` on a detached node doesn't crash but adds orphaned DOM elements. A `document.contains(container)` check before injecting would be a cheap guard.

- **`#initialised` guard throws on double-init** (`src/core/app.js:162`), which is good. But `disconnect()` doesn't reset `#initialised`, so after a disconnect the instance is permanently dead. If the extension calls `disconnect()` on a config change and wants to restart without a full page reload, it must create a new `FlixMonkeyApp` instance. This is by design per the comment, but should be documented.

---

## 4. Core: DOM Layer

**Rating: 8.5 / 10**

### `surfaces.js`

The priority-ordered surface list is a clean pattern for handling multiple Netflix DOM layouts. The `seen` set correctly prevents duplicate containers.

**Issue:** When `titleEl.closest(surface.containerSel)` fails, the code **silently falls back to `parentElement`** and logs only a debug message. For surfaces with multi-selector `containerSel` (like the jawBone surface), `closest` will legitimately fail on some layouts. The fallback to `parentElement` may attach the overlay to a wrong container. Consider logging a `warn` and skipping rather than guessing.

### `overlay.js`

Solid. Badge creation uses DOM APIs correctly (no `innerHTML`). The `injectStyles()` call on every overlay/position change is efficient (update vs. create).

**Issues:**

- **MC and RT badges have no links.** IMDb gets a clickable `<a>` with an IMDb URL; MC and RT scores are plain `<div>` elements. This is a usability gap, particularly for RT where a direct link would be natural.
- **`injectStyles()` reads `overlayCorner` synchronously** via `config.get()`. If the corner was changed since the style tag was last written, a call to `refreshStyles()` correctly updates it. But `injectStyles()` is also called at `init()`, before `setConfigData()` is called for extensions: meaning the first style injection uses defaults, then `refreshStyles()` is not called because `overlayCorner` isn't in the `storage.onChanged` batch at startup. In practice this works because `setConfigData()` happens before `startApp()`, but the timing assumption is fragile.

---

## 5. Core: Config & Cache

**Rating: 9 / 10**

`ConfigManager` is minimal and correct. The three typed accessors (`get`, `getInt`, `getFloat`) cover all config field types.

`CacheManager` handles TTL correctly, including `Infinity` for "cache forever" (`-1` days). The slug-based key generation is practical, though different titles can collide to the same slug (e.g. "The Movie!" and "the movie" both → `the_movie`). For a ratings cache this is acceptable (worst case: stale hit).

**Issue: `cacheTtlNoRating` applied to "disabled client" result** (see API layer section above).

---

## 6. Platform Adapter

**Rating: 9 / 10**

The adapter design is sound. Abstract base with throwing defaults ensures subclass omissions surface at runtime rather than silently degrading.

**Issues:**

- **`UserscriptAdapter.configGet(key)`** calls `GM_getValue(key)` directly, which returns the raw stored value. For booleans this means the stored value may be the string `"true"` if it was ever written as a string by an older version. `WebExtensionAdapter.configGet()` returns the value directly from the parsed storage object, so booleans come back as booleans. This asymmetry can cause `value === true` checks to fail on userscript. `ConfigManager` doesn't normalize types. Downstream code like `Logger.debug`: `if (this.#adapter.configGet('debug') === true)`: the strict equality would fail if `GM_getValue` returns `"true"`. `src/core/logger.js:28`.

- **`WebExtensionAdapter.httpFetch` timeout fires a `reject` after the race has already settled.** The timer is never cleared on success. This creates a dangling `setTimeout` per request. Low impact, but a `clearTimeout` after the race would be cleaner. `src/platform/webextension.js:62–64`.

---

## 7. Extension Targets

**Rating: 7.5 / 10**

### `content.js`

The `appRef` temporal-dead-zone workaround (ref wrapper) is clever and well-commented. The `storage.onChanged` listener correctly keeps `stored` in sync.

**Issue:** `storage.onChanged` only calls `refreshStyles()` for `overlayCorner`. Other visual settings (`showRtRating`, `showMcRating`, `enableFadeUnderRating`, `fadeRatingThreshold`) are changed in storage but the existing overlays on screen are not re-rendered. The user has to scroll away and back (or reload) to see changes take effect. This is a UX gap; it could be addressed by adding a `decorateRoot(document)` call (after clearing loaded overlays) when visual settings change.

### `options.js`

**Bug (real): missing `logger` argument to `CacheManager` and `ConfigManager`.**

```js
const config = new ConfigManager(adapter); // logger missing → undefined
const cacheManager = new CacheManager(adapter, config); // logger missing → undefined
```

Both constructors accept `logger` as their third argument. When the user clicks **Clear Cache** in the options page, `CacheManager.clear()` calls `this.#logger.debug(...)`: `this.#logger` is `undefined`, so this throws `TypeError: Cannot read properties of undefined (reading 'debug')`. The cache is cleared (the `Promise.all` completes before the log line) but the error propagates and the status message is never set. Similarly, if a corrupt cache entry is encountered in `CacheManager.read()`, the `warn` call crashes. `src/targets/extension/options.js:26–28`.

### `fetch-proxy.js` / `domains.js`

The domain allowlist in `validateDomain` is a correct and sufficient SSRF guard. The `https://` protocol is enforced by checking exact hostnames, and the `URL` constructor rejects non-URLs.

**Issue:** `fetch-proxy.js` does not validate `responseType` against an allowlist. A caller could pass `responseType: 'blob'` or other exotic types; `res.blob()` would be called. In practice all callers pass `'json'` or `'text'`, but input is not validated.

### `chrome/service-worker.js`

**Issue:** Unlike the Firefox background script, the Chrome service worker **does not verify `sender.id`**. Firefox does: `if (sender?.id !== browser.runtime.id) return;`. Chrome's version processes any `FM_FETCH` message from any sender. The domain allowlist mitigates the impact, but an extension with broader permissions could relay requests through FlixMonkey. A `sender.id !== chrome.runtime.id` check should be added.

### `firefox/background.js`

Correct. Sender validation is present.

---

## 8. UI Layer

**Rating: 7.5 / 10**

### `settings-ui.js`

**Issue: inconsistent access modifier style.** `adapter`, `fields`, and `onSave` are public class fields. `#cacheManager` and `#disabledClientsManager` use proper private syntax. `_validate()` and `_injectStyles()` use underscore convention for "private" instead of `#`. This is inconsistent within a single class that otherwise uses `#` throughout the codebase.

**Issue: `SettingsUI` calls `adapter.setConfigData(settings)` inside `render()`** (`line 38`). This mutates the adapter's config state as a side effect of rendering the UI. If `render()` is called multiple times (e.g., re-opening settings without a page reload), it re-reads storage and re-sets config, which is fine, but it's a surprising hidden side effect. The config-loading responsibility arguably belongs outside `SettingsUI`.

**Issue: no feedback when `clearCache` or `resetClients` fails.** Both methods `await` the operation with no try/catch. An exception would leave the status div unchanged and potentially propagate silently.

### `modal.js`

Well-implemented accessible modal: `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape key handler, and focus restoration on close. The `crypto.randomUUID()` for the label ID is a correct approach.

**Issue:** The modal DOM (`overlay`) is appended to `document.body` in the **constructor**, not in `open()`. Every call to `new Modal(...)` immediately modifies the live DOM, even before the modal is shown. If construction fails after `appendChild` (e.g., `crypto` not available), the orphaned overlay stays in the DOM.

---

## 9. Testing

**Rating: 9 / 10**

Coverage is genuinely high (97% statements, 92% branches) with thresholds enforced in `vitest.config.js`. The test suite is organized into unit / UI / integration tiers, each with distinct responsibilities. UI tests use real Netflix fixture HTML, which gives them good fidelity.

**Strengths:**

- `app.test.js` covers all significant lifecycle scenarios including inflight deduplication, timeout, DOM mutation, and double-init.
- `request-queue.test.js` tests cross-instance storage sync with a mock adapter.
- Integration tests use `it.skipIf(!hasCredentials(...))`: correct pattern for optional credential-gated tests.
- `chrome/service-worker.test.js` covers the full message dispatch path including domain validation.

**Issues:**

- **`options.js` has no test file.** It's the entry point for the options page, contains the logger-missing bug described above, and handles user-facing interactions (Clear Cache, Reset Clients). `tests/unit/targets/options.test.js` does not exist.

- **`content.js` test** (`tests/unit/targets/content.test.js`) exists but only verifies that `startApp` is called: it doesn't exercise the `storage.onChanged` listener or the `refreshStyles` path.

- **No test for the `overlayCorner` → `refreshStyles()` flow** in `content.js`. This is a regression risk since it's the only setting that triggers a style refresh without a reload.

- **Coverage gaps** (`app.js:75–79` = the `disconnect()` navigation cleanup) are not tested: `popstate` handler removal is not asserted.

- **The `integration/api-clients.test.js` has a wrong import path** (`from './setup'` instead of `'./setup.js'`) and imports from `'../../src/...'` relative to the integration directory instead of `'../../../src/...'`. This likely works due to jsdom module resolution but is fragile.

---

## 10. Tooling & Build

**Rating: 9 / 10**

The build pipeline is well thought out:

- `rollup.config.js` handles three targets cleanly with shared plugins.
- `asciiEscape()` plugin prevents non-ASCII characters from breaking userscript delivery.
- `injectManifestMetadata()` avoids maintaining version numbers in multiple places.
- `strip-license-header` transform prevents the GPL header from being duplicated across bundle inputs.
- Husky + lint-staged enforces format/lint on commit.
- `commitlint` with `config-conventional` enforces the commit message style from `AGENTS.md`.

**Issues:**

- **`rollup.config.js` extension builds include inline sourcemaps (`sourcemap: true`) in production bundles.** Sourcemaps are valuable for debugging but expose the unminified source tree. For a public extension this is acceptable (the source is open), but intentional.

- **`vitest.config.js` coverage thresholds** are set at 90%/90% for lines/functions but the actual coverage is ~98%/93%. The thresholds could be tightened to prevent regressions.

- **No `release-please` action file** in `.github/` was found: the `release-please-config.json` exists at the root but there's no corresponding CI workflow to actually run it. Manual releases are needed.

- **`dotenv` is listed as a dev dependency** but no `.env` usage was found in `src/` or `scripts/`. Likely used only in the integration test setup (`tests/integration/setup.js`). This is fine but worth a comment.

---

## 11. Security

**Rating: 8.5 / 10**

- **No `innerHTML`** anywhere in the codebase. All DOM construction uses `createElement`/`textContent`/`appendChild`. XSS risk is effectively eliminated.
- **Domain allowlist in `fetch-proxy.js`** prevents the background proxy from being used as an open relay.
- **API keys are stored in `browser.storage.local`** (not `sync`), which is correct: keys are sensitive and shouldn't roam across profiles.
- **`rel="noopener noreferrer"`** on the IMDb link is correct.

**Issues:**

- **Chrome service worker accepts messages without sender validation** (see section 7). An adversarial extension could trigger fetches to the three allowed API endpoints using the victim extension's identity.

- **API keys are passed as query parameters** (`apiKey=...`, `apikey=...`) in URLs logged at debug level. If debug logging is enabled and the user copies debug output for a bug report, the key is exposed. `src/core/api-clients.js:134, 151, 187`.

- **`URL` search params include the API key before the fetch**: any intermediary (system proxy, browser history of about:blank redirects) could capture it. Passing the key as an `Authorization` header would be better, but this is an API design constraint from OMDB/XMDB.

---

## 12. Summary of Issues by Severity

### Bugs (should fix)

| #   | Location                                  | Issue                                                                                                                    |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| B1  | `src/targets/extension/options.js:26–28`  | `CacheManager` and `ConfigManager` constructed without `logger`; `clear()` and corrupt-cache path crash with `TypeError` |
| B2  | `src/core/app.js:107`                     | Loading overlay not removed when `decorateContainer` rejects (timeout, error); spinner persists forever                  |
| B3  | `src/targets/chrome/service-worker.js:20` | Sender identity not validated; Firefox background validates, Chrome does not                                             |

### Design Issues (worth addressing)

| #   | Location                              | Issue                                                                                                                              |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `src/core/api-clients.js:179`         | OMDB `search()` is a no-op; wrong results for titles with name mismatches                                                          |
| D2  | `src/targets/extension/content.js:36` | Only `overlayCorner` triggers `refreshStyles()`; visual setting changes don't update existing overlays                             |
| D3  | `src/core/logger.js:28`               | `=== true` strict check on `debug` config; userscript stores booleans as strings via `GM_getValue` → debug logging silently broken |
| D4  | `src/core/api-manager.js`             | No client fallback chain; single disabled client means total failure until manual reset                                            |
| D5  | `src/core/app.js:107`                 | No `document.contains(container)` guard before `injectOverlay`; orphaned DOM operations on removed containers                      |

### Code Quality (cleanup)

| #   | Location                          | Issue                                                                           |
| --- | --------------------------------- | ------------------------------------------------------------------------------- |
| Q1  | `src/core/ui/settings-ui.js`      | Mixed public fields, `_underscore` methods, and `#private` fields in same class |
| Q2  | `src/core/ui/modal.js:56`         | Modal appended to `document.body` in constructor, not in `open()`               |
| Q3  | `src/platform/webextension.js:62` | Timeout in `httpFetch` never cleared; dangling `setTimeout` per request         |
| Q4  | `src/core/api-manager.js:33`      | `getClient()` breaks encapsulation; no production caller                        |
| Q5  | `src/core/ui/settings-ui.js:38`   | `adapter.setConfigData()` called as side effect inside `render()`               |
| Q6  | `src/core/overlay.js`             | MC and RT badges are unlinked; only IMDb has a navigable URL                    |

### Testing Gaps

| #   | Location                             | Issue                                                                         |
| --- | ------------------------------------ | ----------------------------------------------------------------------------- |
| T1  | `tests/unit/targets/options.test.js` | Missing; options page is untested including the logger-missing bug            |
| T2  | `tests/unit/targets/content.test.js` | `storage.onChanged` handler and `refreshStyles` path not exercised            |
| T3  | `vitest.config.js`                   | Coverage thresholds (90%) are far below actual coverage (97%); ratchet upward |

---

## 13. Positive Highlights

These aspects stand out as genuinely well-done and worth preserving:

- **Platform adapter + `startApp` factory**: clean DI composition root; zero platform bleed into core
- **In-flight deduplication** in `#decorateContainer`: correctly prevents duplicate API calls for the same title on screen simultaneously
- **`RequestQueue` cross-tab sync**: `fm_last_req` storage key keeps rate limits consistent across multiple Netflix tabs
- **`CacheManager` TTL tiers**: per-age and per-rating-availability cache durations are user-configurable and sensible defaults
- **`SurfaceManager` priority ordering**: the surface array with `seen` set cleanly handles five distinct Netflix DOM layouts
- **`Modal` a11y**: `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape handler, and focus restoration are all present
- **No `innerHTML` anywhere**: XSS is structurally eliminated
- **Test suite quality**: 346 tests, 32 files, 97% coverage; meaningful scenarios rather than trivial assertions
- **License header enforcement via ESLint plugin**: ensures GPL header is present on every committed file
