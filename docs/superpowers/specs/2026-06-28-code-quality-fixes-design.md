---
name: code-quality-fixes-2026-06-28
description: Ten isolated code-quality and tooling fixes across config validation, utilities, API layer, settings UI, and test coverage
metadata:
    type: project
---

# Code Quality Fixes — Design

**Date:** 2026-06-28
**Scope:** Ten isolated fixes across config validation, utility portability, API client management, settings UI correctness, and test coverage tooling. Each ships as a separate PR. The spec and implementation plan travel with the first PR.

---

## Fix 1 — Shared TTL validator helper

**File:** `src/core/config-fields.js`

The three cache TTL config fields (`cacheTtlRatedOldYear`, `cacheTtlRatedNewYear`, `cacheTtlNoRating`) each carry an identical inline validator. Extract a module-scoped (unexported) function `validateCacheTtl(val)` that returns `null` for valid values and an error string otherwise. Replace the three inline bodies with calls to this helper. No behavior change; tests for the individual fields are unchanged.

---

## Fix 2 — `window` guard in `runIdle`

**File:** `src/core/utils.js`

`runIdle` checks `typeof window.requestIdleCallback === 'function'`, which throws if `window` itself is not defined (possible on non-standard userscript hosts). Change the condition to:

```js
typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
```

No behavior change in normal browser environments. Add a test asserting the function falls back to `setTimeout` when `requestIdleCallback` is unavailable.

---

## Fix 3 — `httpFetch` timeout cleanup

**File:** `src/platform/webextension.js`

The `setTimeout` that backs the fetch timeout race is never cleared when the fetch succeeds, leaving a dangling timer per request. Store the timer ID and clear it unconditionally after `Promise.race` settles:

```js
let timerId;
const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new FlixMonkeyError('background relay timeout', url)), timeout);
});
try {
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    // ...existing response handling...
    return response.data;
} finally {
    clearTimeout(timerId);
}
```

Add a test asserting `clearTimeout` is called on success (spy on `clearTimeout`).

---

## Fix 4 — Remove `getClient()` from `ApiClientManager`

**File:** `src/core/api-manager.js`

`getClient()` has no caller in `src/` and is uncovered by tests (confirmed via coverage report). It exists only as a potential test introspection hook. Delete the method. No test references it, so no test changes needed.

---

## Fix 5 — Error feedback in `clearCache` and `resetClients`

**File:** `src/core/ui/settings-ui.js`

Both action methods `await` their manager calls with no error handling; a rejection silently leaves the status div unchanged. Wrap both in `try/catch` and display the error message in the status div in red on failure, matching the pattern already used by `save()`:

```js
async clearCache() {
    try {
        await this.#cacheManager.clear();
        statusDiv.textContent = 'Cache cleared.';
        statusDiv.style.color = 'green';
    } catch (err) {
        statusDiv.textContent = `Error: ${err.message}`;
        statusDiv.style.color = 'red';
    }
}
```

Same pattern for `resetClients`. Add tests covering the rejection paths.

---

## Fix 6 — Modal DOM attaches in `open()`, not constructor

**File:** `src/core/ui/modal.js`

`new Modal(...)` currently appends the overlay to `document.body` immediately in the constructor, mutating live DOM before `open()` is called. This makes construction a side-effectful operation.

Remove `document.body.appendChild(this.overlay)` from the constructor. Add it to `open()` before setting `display: flex`. `close()` already calls `this.overlay.remove()`, so a subsequent `open()` call re-appends correctly. `getContentContainer()` works on detached DOM without change.

Update the existing modal tests to reflect that the overlay is not in the DOM until `open()` is called.

---

## Fix 7 — Title immutability

**Files:** `src/core/title.js`, `src/core/api-clients.js`

`Title` is documented "Immutable-style" but `BaseApiClient.fetch()` assigns `displayTitle` and `source` after construction, contradicting the claim.

**In `BaseApiClient.fetch()`**, replace the two post-construction mutations with a new `Title` instance:

```js
// Before
titleObj.displayTitle = displayTitle;
titleObj.source = this.#source;
return titleObj;

// After
return Title.fromJSON({ ...titleObj, displayTitle, source: this.#source });
```

The spread of a `Title` instance yields its own enumerable public fields. `fromJSON` runs normalization again, which is a no-op since values are already typed.

**In `Title` constructor**, add `Object.freeze(this)` as the last statement. This enforces immutability at runtime. The `imdbUrl` getter and `hasRating` getter are on the prototype and are unaffected by freeze.

**Update the docstring** at line 32 of `title.js` from "Immutable-style" to "Immutable".

**Test updates:**

- Add a test asserting that assigning to a `Title` field after construction does not change the value (frozen object behavior).
- The api-manager test at line 201 does `title.source = 'test-source'` on a `Title` constructed without a source, then uses that title as the mock's fetch return value. With freeze, that mutation would silently fail. Update the test to pass `source: 'test-source'` in the `Title` constructor instead.

---

## Fix 8 — Remove `setConfigData` side effect from `render()`

**File:** `src/core/ui/settings-ui.js`

`render()` reads storage and then calls `this.adapter.setConfigData(settings)`, mutating adapter state as a side effect of rendering. The WebExtension content script already seeds `setConfigData` via its `storage.onChanged` handler independently. The userscript adapter's `configGet` reads `GM_getValue` live and does not use the seeded data. The options page doesn't call `configGet` at all during rendering — it passes raw settings values directly to field construction.

Remove the `this.adapter.setConfigData(settings)` call from `render()`. No caller change needed. Update the test that asserts `setConfigData` is called during render to assert it is not called.

---

## Fix 9 — Standardize `SettingsUI` access modifiers to `#`

**File:** `src/core/ui/settings-ui.js`

The class mixes three access-modifier conventions (`public`, `#private`, `_underscore`). Standardize everything to `#`:

| Before            | After                                                       |
| ----------------- | ----------------------------------------------------------- |
| `this.adapter`    | `this.#adapter`                                             |
| `this.fields`     | `this.#fields`                                              |
| `onSave = null`   | `#onSave = null` + public `get onSave()` / `set onSave(fn)` |
| `_validate()`     | `#validate()`                                               |
| `_injectStyles()` | `#injectStyles()`                                           |
| `_groupFields()`  | `#groupFields()`                                            |
| `_createField()`  | `#createField()`                                            |

`onSave` receives a getter/setter pair because callers in `options.js` and `entry.js` set it after construction (`ui.onSave = ...`). The public setter preserves the calling convention while backing the value with `#onSave`.

The one test that calls `ui._validate()` directly is rewritten to exercise validation indirectly through `save()` with an invalid field value, which is the correct behavioral contract to test.

---

## Fix 10 — Coverage thresholds for branches and statements

**File:** `vitest.config.js`

The coverage threshold object currently enforces only `lines: 90` and `functions: 90`. Measured coverage (unit + UI tests) is: statements 97.2%, branches 91.8%, functions 93.0%, lines 98.2%.

Add `statements: 97` and `branches: 90` to lock in the current floor. Both values are intentionally set slightly below the measured coverage to give headroom for new untested code paths introduced alongside test gaps, while still catching regressions.

---

## PR Order

| #   | Fix                                           | File(s)                                        |
| --- | --------------------------------------------- | ---------------------------------------------- |
| 1   | Shared TTL validator helper                   | `src/core/config-fields.js`                    |
| 2   | `window` guard in `runIdle`                   | `src/core/utils.js`                            |
| 3   | `httpFetch` timeout cleanup                   | `src/platform/webextension.js`                 |
| 4   | Remove `getClient()`                          | `src/core/api-manager.js`                      |
| 5   | Error feedback in `clearCache`/`resetClients` | `src/core/ui/settings-ui.js`                   |
| 6   | Modal DOM attaches in `open()`                | `src/core/ui/modal.js`                         |
| 7   | Title immutability                            | `src/core/title.js`, `src/core/api-clients.js` |
| 8   | `setConfigData` out of `render()`             | `src/core/ui/settings-ui.js`                   |
| 9   | Standardize `SettingsUI` access modifiers     | `src/core/ui/settings-ui.js`                   |
| 10  | Coverage thresholds                           | `vitest.config.js`                             |

The spec and implementation plan are committed alongside Fix 1.
