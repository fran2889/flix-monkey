# Review Fixes — Design Spec

_Date: 2026-06-06_

## Overview

32 commits addressing all actionable findings from the 2026-06-06 full code review, ordered by category: Correctness Bugs → Security → Architecture → Code Quality → Performance → Test Gaps → Build & DevOps. Each commit pairs a production-code change with its corresponding test update.

Skipped: items the review marked "No immediate action needed" (CSP comment, release-please casing verification), and the CI `npm ci` duplication (review calls it correct and safe — speed trade-off only).

---

## 1. Correctness Bugs

### Commit 1 — `fix(title): use null checks in hasRating; add zero-rating and normalization tests`

**Files:** `src/core/title.js`, `tests/unit/core/title.test.js`

`hasRating` uses truthiness (`!!`), which returns `false` for a legitimate score of `0`. Fix:

```js
get hasRating() {
    return this.rating !== null || this.rtRating !== null || this.mcRating !== null;
}
```

Tests: add `describe('rating normalization')` covering:

- `rating = 0`, `rtRating = "0%"`, `mcRating = "0/100"` — each must yield `hasRating === true`
- `'N/A'`, `''`, `null`, `undefined` → `null`
- Malformed strings like `"8.5/10"` for rtRating, `"abc"` for mcRating → `null`
- `year` as `"2020–"` (open range) → `parseInt` yields `2020`

Also covers the Testing HIGH: "Title normalization edge cases are untested."

---

### Commit 2 — `fix(app): catch errors from decorateContainer; add unhandled-rejection test`

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

`decorateRoot` calls `this.#decorateContainer(...)` with no `await` and no `.catch()`. Errors become silent unhandled rejections. Fix in `decorateRoot`:

```js
this.#decorateContainer(container, title, fadeable).catch(err => logger.error('decorateContainer failed', err));
```

Test: spy on `logger.error`, inject a renderer whose `injectOverlay` throws, verify the error is logged and no unhandled rejection occurs.

Also covers Testing HIGH: "No test for unhandled-rejection path in decorateRoot."

---

## 2. Security

### Commit 3 — `fix(webextension): guard httpFetch against null background response`

**Files:** `src/platform/webextension.js`, `tests/unit/platform/webextension.test.js`

After `Promise.race`, `response` can be `undefined` if the background is not ready. `response.error` on line 67 throws a `TypeError`. Fix:

```js
const response = await Promise.race([fetchPromise, timeoutPromise]);
if (!response) throw new FlixMonkeyError('empty background response');
```

Test: mock `browser.runtime.sendMessage` to resolve with `undefined`; verify `FlixMonkeyError` is thrown with the expected message.

---

### Commit 4 — `fix(background): validate sender.id in Firefox message listener`

**Files:** `src/targets/firefox/background.js`, `tests/unit/targets/firefox/background.test.js`

The listener ignores the `sender` parameter entirely. Any context with access to the extension ID can trigger `handleFetchMessage`. Fix:

```js
browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (sender.id !== browser.runtime.id) return;
    if (msg.type !== 'FM_FETCH') return;
    ...
});
```

Test: call the listener with a spoofed `sender.id`; verify `handleFetchMessage` is not called.

---

### Commit 5 — `fix(modal): replace innerHTML template with createElement calls`

**Files:** `src/core/ui/modal.js`, `tests/ui/modal.ui.test.js`

`this.overlay.innerHTML` is assigned a hardcoded template literal. No immediate XSS risk today, but the pattern is fragile — any future interpolation would introduce it. Replace with `createElement` calls consistent with the rest of the codebase. The `titleId` (`crypto.randomUUID()`) is set via `setAttribute` on the heading element.

Tests: existing `modal.ui.test.js` tests cover all modal behaviour; verify no regression after the refactor.

---

### Commit 6 — `fix(api-clients): redact API keys from debug log URLs`

**Files:** `src/core/api-clients.js`, `tests/unit/core/api-clients.test.js`

`XmdbApiClient.search`, `XmdbApiClient.getDetails`, and `OmdbApiClient.getDetails` pass full URLs including API key params to `logger.debug`. Redact before logging:

```js
logger.debug(`Searching XMDB: ${url.toString().replace(/apiKey=[^&]+/, 'apiKey=*****')}`);
```

Apply same pattern to all three call sites (XMDB search, XMDB details, OMDB details).

Test: spy on `logger.debug`; verify the logged string does not contain the actual key value.

---

## 3. Architecture

### Commit 7 — `refactor(adapter): add setConfigData no-op to PlatformAdapter; remove optional chain`

**Files:** `src/platform/adapter.js`, `src/core/ui/settings-ui.js`

`SettingsUI.render()` calls `this.adapter.setConfigData?.(settings)` via optional chaining — a duck-typed call on a method not declared in `PlatformAdapter`. Add as a documented no-op to the base class:

```js
/** No-op by default; WebExtensionAdapter overrides to pre-load config. */
setConfigData(_data) {}
```

Remove the `?.` in `settings-ui.js` line 35. No new test needed — `adapter.test.js` already exercises the base class.

---

### Commit 8 — `refactor(api-manager): remove dead clearCache method`

**Files:** `src/core/api-manager.js`, `tests/unit/core/api-manager.test.js`

`ApiClientManager.clearCache()` is never called — `FlixMonkeyApp.clearCache()` goes directly to `this.#cache.clear()`. Delete the method and remove any corresponding test for it.

---

### Commit 9 — `refactor(app): move _navigationPatched to instance field; capture history lazily`

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

Three module-level variables cause problems:

- `_navigationPatched` — shared across all instances, blocks two apps in the same module scope
- `_originalPushState` / `_originalReplaceState` — captured at import time, before test code can set up mocks

Fix:

- Move `_navigationPatched` to `#navigationPatched` instance field (default `false`)
- Remove module-level `_originalPushState` / `_originalReplaceState`
- Inside `#initNavigationObservers`, capture current `history.pushState` / `history.replaceState` lazily at the time of first patch
- `_resetStartedForTest()` only resets `_appStarted`; patch restoration happens naturally because test cleanup disconnects the app instance

Update navigation-observer tests to reflect that reset no longer restores the history methods directly.

---

### Commit 10 — `refactor(entry): reuse cache and disabled managers from startApp return value`

**Files:** `src/core/app.js`, `src/targets/userscript/entry.js`, `tests/unit/core/app.test.js`

`entry.js` creates a second `ConfigManager`, `CacheManager`, and `DisabledClientsManager` after `startApp` already created its own, both writing to the same storage keys.

Extend the `startApp` return value:

```js
return {
    clearCache: () => app.clearCache(),
    resetDisabledClients: () => app.resetDisabledClients(),
    disconnect: () => app.disconnect(),
    refreshStyles: () => renderer.injectStyles(),
    cacheManager: cache,
    disabledManager: disabledManager,
};
```

In `entry.js`, replace the three re-instantiations with references to `app.cacheManager` and `app.disabledManager`.

Test: verify `startApp` return value includes both manager references.

---

## 4. Code Quality

### Commit 11 — `fix(api-clients): guard queuedFetch against non-integer status`

**Files:** `src/core/api-clients.js`, `tests/unit/core/api-clients.test.js`

`if (status >= 400 && status < 500)` silently passes when `status` is `undefined` (network error). Fix:

```js
if (Number.isInteger(status) && status >= 400 && status < 500) await this.disable();
```

Test: stub `this.#queue.enqueue` to throw an error with no `status` property; verify `disable()` is not called.

---

### Commit 12 — `refactor(settings-ui): scope element queries to container`

**Files:** `src/core/ui/settings-ui.js`, `tests/unit/core/ui/settings-ui.test.js`

`_validate()` and `save()` use `document.getElementById(...)`. Two simultaneous `SettingsUI` instances would interfere. Fix:

- Store `this.#container = container` at the start of `render()`
- Replace all `document.getElementById('fm-...')` calls in `_validate()`, `save()`, `clearCache()`, and `resetClients()` with `this.#container.querySelector('#fm-...')`

Test: render two `SettingsUI` instances into separate containers; verify save/validate on one does not affect the other.

---

### Commit 13 — `fix(api-manager): demote per-fetch success log from info to debug`

**Files:** `src/core/api-manager.js`, `tests/unit/core/api-manager.test.js`

`logger.info` on line 90 fires on every successful rating fetch — the only high-frequency `info` call in the codebase. Demote it to `logger.debug` so it only appears when debug mode is enabled. The three other `info` calls (lines 59, 61, 68) are user-triggered actions (reset clients, clear cache) and remain at `info`. `logger.js` is unchanged.

Test: verify `logger.info` is not called and `logger.debug` is called after a successful `getData()`.

---

### Commit 14 — `fix(api-clients): replace magic key sentinels with empty-string check`

**Files:** `src/core/api-clients.js`, `src/core/config-fields.js`, `tests/unit/core/api-clients.test.js`

`'YOUR_XMDB_API_KEY'` and `'YOUR_OMDB_API_KEY'` serve double duty as UI placeholder text and the runtime "not configured" sentinel. Decouple them:

- Change `default` in `config-fields.js` for `xmdbApiKey` and `omdbApiKey` from the placeholder strings to `''`
- Change sentinel check in `api-clients.js`: `if (!apiKey || apiKey === 'YOUR_XMDB_API_KEY')` → `if (!apiKey)`

Test: verify that an empty-string key causes `search()` to return `null` without making a network request.

---

### Commit 15 — `refactor(config-manager): remove duck-typing; constructor always takes a PlatformAdapter`

**Files:** `src/core/config-manager.js`, `tests/unit/core/config-manager.test.js`, `tests/unit/core/api-manager.test.js`, `tests/unit/core/cache.test.js`, `tests/unit/core/overlay.test.js`, `tests/ui/*.ui.test.js`, `tests/integration/config-manager.test.js`, `tests/integration/api-clients.test.js`

**Depends on commit 26** (mock adapter must support `configGet` override first).

The constructor accepts either a function or an adapter via duck-typing (`typeof source === 'function'`). Replace with a single parameter type — always a `PlatformAdapter`:

```js
constructor(adapter) {
    this.#adapter = adapter;
}

get(key, fallback) {
    const val = this.#adapter.configGet(key);
    return val !== undefined && val !== null ? val : (fallback ?? CONFIG_DEFAULTS[key]);
}
```

- Delete the `#getter` field and the `typeof` branch entirely; remove the no-arg default
- The four production call sites (`app.js`, `options.js`, `entry.js` × 2) are unchanged — they already pass an adapter
- Update the ~40 test call sites from `new ConfigManager()` / `new ConfigManager(getter)` to `new ConfigManager(createMockAdapter())` / `new ConfigManager(createMockAdapter({ configGet: getter }))`

---

### Commit 16 — `refactor(overlay): remove unused displayTitle param from loading overlay`

**Files:** `src/core/overlay.js`, `src/core/app.js`, `tests/unit/core/overlay.test.js`

`#createLoadingOverlay(_displayTitle)` and `injectLoadingOverlay(container, _displayTitle)` accept a parameter that is never used (the loading overlay only shows a spinner). Remove the parameter from both methods and update the call site in `app.js` line 77 to drop the `displayTitle` argument.

---

## 5. Performance

### Commit 17 — `perf(app): replace Array.from in MutationObserver with addedNodes.length`

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

The observer allocates a new array on every mutation record:

```js
Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
```

Replace with:

```js
m.addedNodes.length > 0 && Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
```

Actually, use `for...of` to avoid the allocation entirely:

```js
mutations.some(m => {
    for (const n of m.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
    }
    return false;
});
```

Test: existing mutation observer tests verify the callback still fires on element additions.

---

### Commit 18 — `perf(app): pass addedNode parents to decorateRoot instead of full document`

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

`decorateRoot(document)` triggers a full-document `querySelectorAll` sweep on every debounced mutation. When mutations are known to a specific subtree, searching from the parent of each added node is cheaper.

Collect unique parent elements from `addedNodes` across the mutation batch. If the set is non-empty, call `decorateRoot` once per unique parent; fall back to `decorateRoot(document)` only when no suitable parent is found (e.g. direct `document.body` children). The `debounce` callback receives the collected parents from the last mutation batch — the `#debouncedDecorate` function is updated to accept an optional roots array.

Test: verify that mutations with known parents call `discover` on the parent element, not `document`; verify fallback to `document` when no parent is available.

---

### Commit 19 — `perf(request-queue): read global storage timestamp once per process cycle`

**Files:** `src/core/request-queue.js`, `tests/unit/core/request-queue.test.js`

`#process()` calls `storageGet(this.#globalSyncKey)` on every `while` iteration, even when the computed `wait` is `0` and execution should proceed immediately. Read the timestamp once at the start of `#process()`, then re-read only after a wait:

```js
async #process() {
    if (this.#isProcessing) return;
    this.#isProcessing = true;

    while (this.#queue.length > 0) {
        const now = Date.now();
        let lastGlobal = await this.#readGlobalTimestamp();
        const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
        if (wait > 0) {
            await new Promise(r => setTimeout(r, wait));
            continue; // re-read at top of loop
        }
        // fire immediately — no re-read needed
        ...
    }
}
```

Test: verify `storageGet` is called once per request when no wait is required (spy on `adapter.storageGet`).

---

### Commit 20 — `perf(app): add safety timeout to #inFlight entries`

**Files:** `src/core/app.js`, `src/core/constants.js`, `tests/unit/core/app.test.js`

If the API call in `#decorateContainer` never settles (adapter timeout did not fire), the `#inFlight` Map entry leaks permanently. Wrap the inner promise with a timeout rejection:

```js
const INFLIGHT_TIMEOUT_MS = 30_000;
promise = Promise.race([
    (async () => await this.#api.getData(displayTitle))(),
    new Promise((_, reject) => setTimeout(() => reject(new FlixMonkeyError('inflight timeout')), INFLIGHT_TIMEOUT_MS)),
]).finally(() => this.#inFlight.delete(dedupKey));
```

`INFLIGHT_TIMEOUT_MS` as a named constant in `constants.js`.

Test: use fake timers; advance past `INFLIGHT_TIMEOUT_MS`; verify the Map entry is removed and `logger.error` is called (via the `.catch` added in commit 2).

---

## 6. Test Gaps

### Commit 21 — `test(content): add smoke test for content.js entry point`

**New file:** `tests/unit/targets/content.test.js`

Mock `webextension-polyfill`. Import `content.js`. Verify:

1. `startApp` is called once with a `WebExtensionAdapter`
2. `browser.storage.onChanged.addListener` is registered
3. When the listener fires with `overlayCorner` changed, `app.refreshStyles()` is called
4. When the listener fires with a non-corner key, `refreshStyles` is not called

---

### Commit 22 — `test(options): add smoke test for options.js entry point`

**New file:** `tests/unit/targets/options.test.js`

Mock `webextension-polyfill`. Import `options.js`. Verify:

1. `SettingsUI.render` is called with `document.body`
2. No uncaught errors during wiring

---

### Commit 23 — `test(integration): use it.skipIf for credential-gated tests`

**Files:** `tests/integration/api-clients.test.js`

Replace the current `if (!hasCredentials) { it.skip(...) } else { ... }` pattern with Vitest's built-in:

```js
it.skipIf(!hasCredentials(credentials))('fetches real data', async () => { ... });
```

Or wrap the whole credential-dependent block in `describe.skipIf(...)`.

---

### Commit 24 — `test(request-queue): document timing assumption in clear() test`

**Files:** `tests/unit/core/request-queue.test.js`

Add a comment to the `clear()` test explaining why enqueueing two items with a huge interval and then clearing yields count `1` (the first item is dequeued by `#process` before the first `await`, leaving only the second to be cleared).

---

### Commit 25 — `test(surfaces): add tests for fallback selectors per surface`

**Files:** `tests/unit/core/surfaces.test.js`

For each of the three surfaces (jawBone, previewModal, titleCard) add parameterised tests exercising each alternate selector listed in `surfaces.js`. Use `it.each` with fixture HTML that uses the alternate selector class names.

---

### Commit 26 — `test(mocks): have createMockAdapter extend PlatformAdapter; support configGet override`

**Files:** `tests/mocks/adapter.js`

**Must land before commit 15.**

Change the plain object returned by `createMockAdapter` to an instance of `MockPlatformAdapter extends PlatformAdapter`. Override all abstract methods with `vi.fn()` stubs. Accept an optional overrides object so tests can supply a custom `configGet`:

```js
function createMockAdapter(overrides = {}) {
    return new MockPlatformAdapter(overrides);
}

class MockPlatformAdapter extends PlatformAdapter {
    #configGet;
    constructor({ configGet = () => undefined, ...rest } = {}) {
        super();
        this.#configGet = configGet;
        // apply vi.fn() stubs for remaining methods via rest
    }
    configGet(key) {
        return this.#configGet(key);
    }
    storageGet = vi.fn(async () => null);
    // ... etc
}
```

Tests that currently pass the mock will continue to work; commit 15 then migrates all `new ConfigManager(getter)` call sites to `new ConfigManager(createMockAdapter({ configGet: getter }))`.

---

## 7. Build & DevOps

### Commit 27 — `build(rollup): add inline source map for userscript bundle`

**Files:** `rollup.config.js`

Add `sourcemap: 'inline'` to the userscript output config (the `format: 'iife'` block). Firefox and Chrome already have `sourcemap: true`; the userscript uses `'inline'` so no separate `.map` file is distributed.

---

### Commit 28 — `build(rollup): hoist and tighten strip-license-header regex`

**Files:** `rollup.config.js`

The regex `/\/\*\*[\s\S]*?GNU General Public License[\s\S]*?\*\//` is:

1. Allocated anew inside every `transform()` call
2. Not anchored — could strip any block comment containing that phrase

Fix:

- Hoist to a module-level `const LICENSE_BLOCK_RE = /^\/\*\*[\s\S]*?GNU General Public License[\s\S]*?\*\//`
- Anchor with `^` to match only blocks at the very start of a file
- The regex is now allocated once and reused

---

### Commit 29 — `build(package): verify required dist files before zipping`

**Files:** `scripts/package.js`

Before zipping each extension target, check that the required files exist and throw a descriptive error if any are missing:

```js
const required = ['manifest.json', 'content.js', 'options.html', 'options.js'];
const bgFile = target === 'firefox' ? 'background.js' : 'service-worker.js';
[...required, bgFile].forEach(f => {
    if (!fs.existsSync(path.join(dir, f))) throw new Error(`Missing ${f} in ${dir}`);
});
```

---

### Commit 30 — `build: add .nvmrc and engine-strict to enforce Node >= 22`

**New files:** `.nvmrc`, `.npmrc`

`.nvmrc`:

```
22
```

`.npmrc`:

```
engine-strict=true
```

Developers on Node < 22 will get an error on `npm install` rather than a silent warning.

## Summary

| Category       | Commits | Review findings addressed                    |
| -------------- | ------- | -------------------------------------------- |
| Correctness    | 1–2     | CQ HIGH × 1, CQ MEDIUM × 1, Testing HIGH × 2 |
| Security       | 3–6     | Security HIGH × 1, Security MEDIUM × 3       |
| Architecture   | 7–10    | Arch HIGH × 1, Arch MEDIUM × 3               |
| Code Quality   | 11–16   | CQ MEDIUM × 2, CQ LOW × 3, CQ NOTE × 1       |
| Performance    | 17–20   | Perf HIGH × 1, Perf MEDIUM × 3               |
| Test gaps      | 21–26   | Testing MEDIUM × 3, Testing LOW × 3          |
| Build & DevOps | 27–30   | Build MEDIUM × 3, Build LOW × 1              |
| **Total**      | **30**  | **28 findings**                              |
