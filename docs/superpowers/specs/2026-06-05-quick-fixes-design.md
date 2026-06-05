# Quick Fixes — Design Spec

> Date: 2026-06-05

Six independent PRs, each targeting a specific area. Each PR is self-contained and can be merged independently. No new test files; existing tests must continue to pass.

Commit messages describe only the functional change — no references to reviews or plans.

---

## PR 1 — `app.js` robustness

**Files:** `src/core/app.js`

### Changes

1. **Store the MutationObserver reference** — assign to `#observer` instead of a bare local variable so it can be disconnected later.

2. **Add `disconnect()` method** — calls `#observer?.disconnect()` and sets `#observer = null`.

3. **Wire `disconnect()` to `beforeunload`** — inside `init()`, register `window.addEventListener('beforeunload', () => this.disconnect())` so the observer is torn down when the tab unloads.

4. **Expose `disconnect` from `startApp()`** — add `disconnect: () => app.disconnect()` to the returned object alongside `clearCache` and `resetDisabledClients`, so callers and tests can invoke it explicitly.

5. **Wrap the mutation handler in try/catch** — the arrow function body passed to `MutationObserver` should be wrapped so an uncaught error doesn't silently kill decoration. Log at `logger.error` with the caught error.

6. **Guard `init()` against double-call** — add `#initialised = false` private field; set it to `true` on first call; throw `new Error('FlixMonkeyApp already initialised')` if called again.

### Test update

In `tests/unit/core/app.test.js`, update the `afterEach` to call `disconnect()` on the app returned by `startApp()` rather than relying solely on `FlixMonkeyApp.resetInternalState()` to undo observer side-effects. Keep `FlixMonkeyApp.resetInternalState()` for resetting the navigation patch state.

---

## PR 2 — API error normalization

**Files:** `src/core/api-clients.js`

### Changes

1. **Safe status access in `queuedFetch`** — change:
    ```js
    if (err.status >= 400 && err.status < 500)
    ```
    to:
    ```js
    const status = err?.status;
    if (status >= 400 && status < 500)
    ```
    This prevents a `NaN` comparison when the error has no `.status` (e.g., a network timeout).

---

## PR 3 — Cache robustness

**Files:** `src/core/cache.js`, `src/core/title.js`

### Changes

1. **Log on JSON.parse failure** — in `CacheManager.read()`, the empty `catch` block should call `logger.warn('Cache entry corrupt, treating as miss', { key })` before returning `null`. Makes data-loss bugs visible.

2. **`Title.fromJSON` validation** — add a basic guard: if the argument is not a plain object, return `null` instead of constructing a `Title` with undefined fields. Check that `obj` is non-null and `typeof obj === 'object'`.

### Note on slug collision resistance

The collision problem (e.g. `"The King's Speech"` vs `"The Kings Speech"`) cannot be solved by appending a year to the key: the Netflix DOM only exposes the display title, never a year. At read-time there is no year available, so a year-qualified key written on the write path would always be a miss on reads. A real fix requires a different data model (e.g. keying by IMDb ID) and is left for a separate design effort.

---

## PR 4 — Surface discovery

**Files:** `src/core/surfaces.js`, `src/core/constants.js`

### Changes

1. **`TOP_10_BADGE` constant in `constants.js`** — add a single export `TOP_10_BADGE = 'title-card-top-10'` (class name without the dot). This is the only selector that needs to live outside `surfaces.js` because `overlay.js` also needs it to build the CSS rule that offsets the badge on top-10 cards. Moving the rest of the selector strings to constants would add indirection with no benefit — they all live in `surfaces.js` and still require a code release to update.

2. **Log on fallback to parentElement** — in `discover()`, when `titleEl.closest(surface.containerSel)` returns `null` and the code falls back to `titleEl.parentElement`, call `logger.debug('Surface container selector failed, falling back to parentElement', { selector: surface.containerSel })`.

3. **Document surface priority** — add a comment block above the `#SURFACES` array explaining the priority order (title-card → search → bob → previewModal → jawBone) and noting that `Set`-based deduplication means a container matched by an earlier surface is skipped by later ones.

---

## PR 5 — UI polish

**Files:** `src/core/overlay.js`, `src/core/ui/settings-ui.js`, `src/core/constants.js`

### Changes

1. **`#stylesInjected` instance-level** — change from `static #stylesInjected = false` to `#stylesInjected = false` (instance field). Update `injectStyles()` accordingly. Remove `static resetInternalState()` from `OverlayRenderer` — it no longer has class-level state to reset, and tests get a clean slate by constructing a new instance. Remove the `OverlayRenderer.resetInternalState()` call from `FlixMonkeyApp.resetInternalState()` as well.

2. **Use `TOP_10_BADGE` constant in CSS** — `overlay.js` hardcodes `.title-card-top-10` in the CSS template string. Replace it with `TOP_10_BADGE` exported from `constants.js` (PR 4). The constant holds the bare class name without the dot; add the `.` in the template: `.${TOP_10_BADGE} .${this.#OVERLAY_CLASS} { ... }`. PR 4 adds this constant; if merging out of order, add `TOP_10_BADGE` to `constants.js` in this PR instead.

3. **`replaceChildren()` in settings-ui** — find all uses of `container.innerHTML = ''` or `element.innerHTML = ''` used for clearing and replace with `element.replaceChildren()`. This avoids leaking event listeners attached to removed children.

4. **Disable Save button during write** — in the Save click handler, set `button.disabled = true` at the start of the async operation and restore it (in a `finally` block) when the storage write completes.

---

## PR 6 — DRY background scripts

**Files:** new `src/targets/extension/fetch-proxy.js`, `src/targets/firefox/background.js`, `src/targets/chrome/service-worker.js`

### Changes

1. **Extract shared fetch logic** — the core fetch handler (domain validation, AbortController, fetch, response parsing) is identical between `background.js` and `service-worker.js` except for how the response is sent (`return value` vs `sendResponse()`). Extract the pure computation into `fetch-proxy.js`:

    ```js
    // fetch-proxy.js
    export async function handleFetchMessage(url, options) {
        // validates domain, fetches, returns { data } or { error, status }
    }
    ```

    Both background files import and call `handleFetchMessage`, then wire their platform-specific response mechanism around it.

2. **`background.js` becomes thin** — retains only the `browser.runtime.onMessage` listener and `browser.action.onClicked` listener. The message handler calls `handleFetchMessage` and returns the result.

3. **`service-worker.js` becomes thin** — retains only the `chrome.runtime.onMessage` listener (which must return `true` for async) and the `chrome.action.onClicked` listener. Calls `handleFetchMessage` and passes the result to `sendResponse`.

### Note on module availability

`fetch-proxy.js` uses `validateDomain` and `DEFAULT_FETCH_TIMEOUT`, which are already imported by both background files — no new dependencies introduced.

---

## Cross-cutting constraint

All PRs must leave `npm test` green and `npm run lint` clean.
