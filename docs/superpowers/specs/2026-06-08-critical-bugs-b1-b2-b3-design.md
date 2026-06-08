# Critical Bug Fixes: B1, B2, B3

**Date:** 2026-06-08
**Scope:** Three production bugs — missing logger in options page, persistent loading spinner on error, Chrome sender validation gap
**Delivery:** Three sequential PRs (B3 → B1 → B2)

---

## PR 1 — B3: Chrome service worker sender validation

### Problem

`src/targets/chrome/service-worker.js` processes any `FM_FETCH` message from any sender. Firefox's background script validates `sender.id !== browser.runtime.id` before processing; Chrome's does not. An adversarial extension could relay requests through FlixMonkey's background worker. The domain allowlist in `fetch-proxy.js` limits the blast radius but does not eliminate the exposure.

### Fix

Add a sender identity check at the top of the `onMessage` listener, mirroring the Firefox pattern:

```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id) return false;
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    handleFetchMessage(url, options).then(sendResponse);
    return true;
});
```

The `_sender` parameter is already present but unused — rename to `sender` to use it.

### Test

File: `tests/unit/targets/chrome/service-worker.test.js` (existing)

Add one case: a message with a foreign `sender.id` is rejected — `handleFetchMessage` is not called and the listener returns `false`.

---

## PR 2 — B1: Missing logger in options.js

### Problem

`src/targets/extension/options.js` constructs `ConfigManager` and `CacheManager` without a `logger` argument:

```js
const config = new ConfigManager(adapter); // logger → undefined
const cacheManager = new CacheManager(adapter, config); // logger → undefined
```

Both constructors store the logger as a private field and call it in non-trivial paths. When the user clicks **Clear Cache**, `CacheManager.clear()` calls `this.#logger.debug(...)` — `this.#logger` is `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'debug')`. The cache clears successfully (the storage calls complete before the log line) but the error propagates and the status message is never displayed.

### Fix

Instantiate a `Logger` and thread it through, matching the pattern in `startApp()`:

```js
import { Logger } from '../../core/logger.js';

const adapter = new WebExtensionAdapter();
const logger = new Logger(adapter);
const config = new ConfigManager(adapter, logger);
const cacheManager = new CacheManager(adapter, config, logger);
const disabledClientsManager = new DisabledClientsManager(adapter);
```

### Test

New file: `tests/unit/targets/options.test.js`

Covers:

1. **Clear Cache** — `cacheManager.clear()` resolves without throwing; status message is set to the success string.
2. **Reset Clients** — `disabledClientsManager.resetAll()` resolves without throwing; status message is set.
3. **Logger is wired** — `clear()` on a `CacheManager` constructed with a real `Logger` does not throw `TypeError` (regression guard for this exact bug).

Mock strategy: use existing mock adapter from `tests/mocks/`; stub `clear()` and `resetAll()` to resolve.

---

## PR 3 — B2: Loading overlay not removed on `decorateContainer` rejection

### Problem

In `src/core/app.js`, `#decorateContainer` injects a loading overlay (⏳) before awaiting the API promise. If the promise rejects (timeout after `INFLIGHT_TIMEOUT_MS`, or API error), execution exits via the thrown exception. The error is caught in `decorateRoot` and logged, but the loading overlay is never removed. The spinner stays on the container indefinitely until the page reloads.

Relevant flow (`app.js:82–112`):

```
injectLoadingOverlay(container)   ← adds .fm-loading div
await promise                     ← may throw
injectOverlay(container, data)    ← never reached on throw
                                  ← .fm-loading div stays forever
```

### Fix

**`src/core/overlay.js`** — add `removeLoadingOverlay(container)` to `OverlayRenderer`. The renderer owns the loading overlay DOM; removal belongs there:

```js
removeLoadingOverlay(container) {
    container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
}
```

**`src/core/app.js`** — wrap the await + inject block in try/finally:

```js
try {
    const data = await promise;
    if (!this.#renderer.hasOverlay(container)) {
        this.#renderer.injectOverlay(container, data);
        this.#renderer.applyFade(container, data, fadeable);
    }
} finally {
    this.#renderer.removeLoadingOverlay(container);
}
```

`removeLoadingOverlay` is safe to call on success too — by the time `injectOverlay` runs it has already removed the loading overlay (see `overlay.js:209`), so the finally call is a no-op in the happy path.

### Test

File: `tests/unit/core/app.test.js` (existing)

Add one case: when `api.getData` rejects, after the rejection is caught by `decorateRoot`, the container does not contain a `.fm-loading` element.

---

## Files Changed

| PR  | File                                               | Change                                                  |
| --- | -------------------------------------------------- | ------------------------------------------------------- |
| 1   | `src/targets/chrome/service-worker.js`             | Add sender.id guard                                     |
| 1   | `tests/unit/targets/chrome/service-worker.test.js` | Add foreign-sender rejection test                       |
| 2   | `src/targets/extension/options.js`                 | Add Logger, pass to ConfigManager + CacheManager        |
| 2   | `tests/unit/targets/options.test.js`               | New file — clearCache, resetClients, no-TypeError tests |
| 3   | `src/core/overlay.js`                              | Add `removeLoadingOverlay()`                            |
| 3   | `src/core/app.js`                                  | try/finally in `#decorateContainer`                     |
| 3   | `tests/unit/core/app.test.js`                      | Add rejection → overlay-removed test                    |
