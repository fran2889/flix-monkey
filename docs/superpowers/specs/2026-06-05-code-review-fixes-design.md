# Code Review Fixes Design

**Date**: 2026-06-05
**Source**: Full codebase review, 2026-06-05
**Scope**: All actionable items — 3 bugs, 6 weaknesses, tooling tweaks. Title matching (W2) and metacritic schema note (W9) are explicitly out of scope.
**Commit strategy**: One commit per issue.

---

## Section 1: Bugs

### B1 — `api-manager.js` return consistency

`getData` writes `Title.notFound()` to cache on two miss paths (unhealthy client, fetch returning null) but returns `null` to the caller. On a subsequent call the cache returns a `Title` object — inconsistent contract.

**Fix**: Return `Title.notFound(displayTitle)` on both miss paths instead of `null`. Update `app.js` to remove the `?? Title.notFound(displayTitle)` null-coalescing fallback since `getData` now always returns a `Title`. Update `api-manager.test.js` to assert a `Title` object with `hasRating: false` on miss rather than `null`.

**Files**: `src/core/api-manager.js`, `src/core/app.js`, `tests/unit/core/api-manager.test.js`

---

### B2 — `service-worker.js` double domain validation

Chrome's service worker validates the domain before calling `handleFetchMessage`, but `handleFetchMessage` already validates internally. Firefox's `background.js` does not pre-validate. Two code paths for the same behaviour.

**Fix**: Remove the 5-line pre-validation block (lines 24–28) from `service-worker.js`. Rely solely on `handleFetchMessage` for validation, matching Firefox's behaviour. No test changes needed.

**Files**: `src/targets/chrome/service-worker.js`

---

### B3 — Options page adapter never initialized with config data

`options.js` creates a `WebExtensionAdapter` and a `ConfigManager` but never calls `adapter.setConfigData()`. Any call to `config.get()` on the options page silently returns defaults.

**Fix**: After `storageGetAll()` loads settings for rendering, call `adapter.setConfigData(settings)` with the result. One line, closes the invisible invariant.

**Files**: `src/targets/extension/options.js`

---

## Section 2: Design Issues

### W1 — Singleton enforcement at the wrong layer

`ApiClientManager` uses `static #created` + `_resetForTest()` to prevent re-instantiation. `FlixMonkeyApp` uses `static #isNavigationPatched` + `resetInternalState()` to prevent double-patching `history.pushState`. Both are class-level concerns that belong at the wiring layer.

**Fix**:

- Remove `static #created` and `_resetForTest()` from `ApiClientManager`.
- Remove `static #isNavigationPatched`, `static #originalPushState`, `static #originalReplaceState`, and `resetInternalState()` from `FlixMonkeyApp`.
- Add module-level state in `app.js`:
    - `let _appStarted = false` — `startApp` throws if already true.
    - `let _navigationPatched = false` — navigation patch skipped if already true.
    - `const _originalPushState = history.pushState` and `const _originalReplaceState = history.replaceState` — captured at module load time (same semantics as the current statics).
- Export `_resetStartedForTest()` from `app.js`. It resets `_appStarted` and `_navigationPatched` to false and restores `history.pushState`/`history.replaceState` to their originals (replacing the current `resetInternalState()` which did all three, plus called `ApiClientManager._resetForTest()`).
- All tests that previously called `ApiClientManager._resetForTest()` or `FlixMonkeyApp.resetInternalState()` switch to `_resetStartedForTest()`.

**Files**: `src/core/api-manager.js`, `src/core/app.js`, `tests/unit/core/api-manager.test.js`, `tests/unit/core/app.test.js`

---

### W5 — Checkbox `_validate()` reads wrong value

`settings-ui.js:128` passes `input.value` to the field's validator. For `type="checkbox"`, `input.value` is always `"on"` — the correct value is `input.checked`.

**Fix**: In `_validate()`, check `input.type === 'checkbox'` and pass `input.checked` instead of `input.value`. Add a unit test asserting the correct value is passed for a mock checkbox field that has a validator.

**Files**: `src/core/ui/settings-ui.js`, `tests/unit/core/ui/settings-ui.test.js`

---

### W6 — `createMockAdapter` missing methods

`tests/mocks/adapter.js` omits `storageGetAll`, `storageSetMany`, and `configGet`. Tests that reach these methods silently fall through ConfigManager's try/catch and exercise defaults rather than real config reads.

**Fix**: Add to `createMockAdapter`:

- `storageGetAll: vi.fn().mockResolvedValue({})`
- `storageSetMany: vi.fn().mockResolvedValue(undefined)`
- `configGet: vi.fn().mockReturnValue(undefined)`

No test changes required — existing tests improve silently.

**Files**: `tests/mocks/adapter.js`

---

## Section 3: Performance

### W3 — Serial cache deletes

`CacheManager.clear()` deletes entries one by one with `await` inside a `for...of` loop. Unnecessarily slow with a large cache.

**Fix**: Replace with `await Promise.all(keys.map(key => this.#adapter.storageDelete(key)))`. No semantic difference. Verify existing `clear()` tests still pass.

**Files**: `src/core/cache.js`

---

### W4 — Queue re-sorts on every iteration

`RequestQueue.#process()` sorts the full queue on every loop iteration even when no new items have been enqueued.

**Fix**: Remove the sort from `#process()`. After `this.#queue.push(...)` in `enqueue()`, immediately sort: `this.#queue.sort((a, b) => b.priority - a.priority)`. Queue is always ordered on entry; `#process()` just shifts from the front. Existing priority tests cover correctness.

**Files**: `src/core/request-queue.js`

---

## Section 4: UI / Accessibility

### W7 — Modal has no keyboard accessibility

`modal.js` has no Escape key handler, no ARIA roles, and no focus management.

**Fix**:

1. Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="fm-modal-title"` to `.fm-modal-content`. Give the title element `id="fm-modal-title"`.
2. Add `tabindex="-1"` to `.fm-modal-content`.
3. In `open()`: save `document.activeElement` as `this.#returnFocus`; call `.focus()` on `.fm-modal-content`; attach a `keydown` listener on `document` that calls `this.close()` on `Escape`.
4. In `close()`: remove the `keydown` listener; call `this.#returnFocus?.focus()`.

Full focus trap (Tab cycling) is out of scope — the only consumer is the settings UI which renders a standard form with natural Tab order.

Update `modal.ui.test.js`: assert Escape closes the modal, `role="dialog"` is present, focus returns to the trigger after close.

**Files**: `src/core/ui/modal.js`, `tests/ui/modal.ui.test.js`

---

### W8 — Overlay corner position stale after config change

`OverlayRenderer.injectStyles()` reads the corner config once and injects a `<style>` tag. In the extension, changing the corner setting has no effect until page reload.

**Fix**:

- Give the injected `<style>` tag a stable `id` (`fm-overlay-styles`).
- Make `injectStyles()` idempotent: if the element already exists, update its `textContent` rather than appending a new tag.
- In `src/targets/extension/content.js`, call `renderer.injectStyles()` inside the existing `storage.onChanged` handler when the corner config key changes.

Userscript behaviour is unchanged (styles injected once on load). Update `overlay.test.js` to assert that calling `injectStyles()` twice replaces rather than duplicates the style tag.

**Files**: `src/core/overlay.js`, `src/targets/extension/content.js`, `tests/unit/core/overlay.test.js`

---

## Section 5: Tooling

### `no-console` → error

Change `'no-console': 'warn'` to `'no-console': 'error'` in `eslint.config.js`. Run lint to confirm no remaining direct `console.*` calls exist in `src/`.

**Files**: `eslint.config.js`

---

### Coverage thresholds

Raise `lines` and `functions` thresholds from `80` to `90` in `vitest.config.js`. Run `npm test` to confirm the current suite already clears 90%.

**Files**: `vitest.config.js`

---

### `rollup.config.js` cleanup

The current config attaches `_target` to each Rollup config object then destructures it away before passing to Rollup. Replace with a plain object keyed by target name (or a `Map<target, RollupConfig[]>`) so target identity is explicit and not piggybacked on config objects.

**Files**: `rollup.config.js`

---

## Commit Order

Suggested sequence to keep each commit self-contained and bisect-friendly:

1. `fix(api-manager): return Title.notFound instead of null on getData miss` — B1
2. `fix(chrome): remove redundant domain pre-validation from service-worker` — B2
3. `fix(options): initialise adapter config data after storage load` — B3
4. `refactor(api-manager): move singleton guard to startApp module level` — W1
5. `fix(settings-ui): pass input.checked for checkbox validation` — W5
6. `test(mocks): add storageGetAll, storageSetMany, configGet to createMockAdapter` — W6
7. `perf(cache): delete entries in parallel in CacheManager.clear` — W3
8. `perf(request-queue): sort on enqueue instead of on every iteration` — W4
9. `feat(modal): add keyboard accessibility and ARIA roles` — W7
10. `fix(overlay): make injectStyles idempotent; re-inject on corner config change` — W8
11. `build(eslint): promote no-console to error` — tooling
12. `build(vitest): raise coverage thresholds to 90%` — tooling
13. `refactor(rollup): use keyed object instead of _target piggyback` — tooling
