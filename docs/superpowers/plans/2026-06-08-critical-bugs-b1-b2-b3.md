# Critical Bug Fixes B1/B2/B3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three production bugs — Chrome sender-validation gap (B3), missing logger crash in options page (B1), and persistent loading spinner on API rejection (B2) — each with a targeted test.

**Architecture:** Three sequential commits, one per bug, each following TDD: write the failing test first, apply the minimal fix, verify green. B3 ships first (security). No shared state between the three changes.

**Tech Stack:** JavaScript ES2022, Vitest, jsdom, webextension-polyfill, Chrome MV3 service worker

---

## Files changed

| Task | File                                               | Action                                                                   |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| 1    | `src/targets/chrome/service-worker.js`             | Rename `_sender` → `sender`, add sender.id guard                         |
| 1    | `tests/unit/targets/chrome/service-worker.test.js` | Add `id` to chrome.runtime mock, update sender args, add rejection test  |
| 2    | `src/targets/extension/options.js`                 | Import `Logger`, instantiate, pass to `ConfigManager` and `CacheManager` |
| 2    | `tests/unit/targets/options.test.js`               | Capture constructor args, add logger-wired regression test               |
| 3    | `src/core/overlay.js`                              | Add `removeLoadingOverlay(container)` method                             |
| 3    | `src/core/app.js`                                  | Wrap `await promise` block in try/finally calling `removeLoadingOverlay` |
| 3    | `tests/unit/core/app.test.js`                      | Add rejection → loading overlay removed test                             |

---

## Task 1 — B3: Chrome service worker sender validation

**Files:**

- Modify: `src/targets/chrome/service-worker.js`
- Modify: `tests/unit/targets/chrome/service-worker.test.js`

- [x] **Step 1: Write the failing test**

Open `tests/unit/targets/chrome/service-worker.test.js`.

First, add `id: 'test-ext'` to `chrome.runtime` in the existing `beforeEach` mock so the guard has a value to compare against:

```js
global.chrome = {
    runtime: {
        id: 'test-ext', // ← add this line
        onMessage: {
            addListener: vi.fn(fn => {
                messageListener = fn;
            }),
        },
        openOptionsPage: vi.fn(),
    },
    action: {
        onClicked: {
            addListener: vi.fn(fn => {
                actionListener = fn;
            }),
        },
    },
};
```

Then update the `sender` argument in all existing `messageListener(...)` calls from `{}` to `{ id: 'test-ext' }`. There are 10 calls across the existing tests. Find every occurrence of `}, {}, ` and `}, {},` in the file and change the `{}` sender to `{ id: 'test-ext' }`. Affected lines (in the existing file):

```js
// should ignore non-FM_FETCH messages
const result = messageListener({ type: 'OTHER' }, { id: 'test-ext' }, vi.fn());

// should reject requests to disallowed domains
const result = messageListener({ type: 'FM_FETCH', url: 'http://malicious.com' }, { id: 'test-ext' }, sendResponse);

// should handle invalid URLs
const result = messageListener({ type: 'FM_FETCH', url: 'not-a-url' }, { id: 'test-ext' }, sendResponse);

// should respect custom timeout in options
messageListener(
    { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: customTimeout } },
    { id: 'test-ext' },
    sendResponse
);

// should fall back to DEFAULT_FETCH_TIMEOUT (8000ms)
messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: {} }, { id: 'test-ext' }, vi.fn());

// should actually abort fetch when timer fires
messageListener(
    { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: customTimeout } },
    { id: 'test-ext' },
    vi.fn()
);

// should handle successful JSON response
messageListener(
    { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'json' } },
    { id: 'test-ext' },
    sendResponse
);

// should handle successful text response
messageListener(
    { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'text' } },
    { id: 'test-ext' },
    sendResponse
);

// should handle HTTP error response
messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' }, { id: 'test-ext' }, sendResponse);

// should handle fetch exception
messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' }, { id: 'test-ext' }, sendResponse);
```

Now add the new test at the end of the `describe` block (before the closing `}`):

```js
it('should reject FM_FETCH messages from a foreign sender', () => {
    const handleFetchSpy = vi.spyOn(
        // fetch-proxy is called internally; verify no fetch is triggered
        global,
        'fetch'
    );
    const sendResponse = vi.fn();
    const result = messageListener(
        { type: 'FM_FETCH', url: 'https://xmdbapi.com' },
        { id: 'other-extension' },
        sendResponse
    );
    expect(result).toBe(false);
    expect(handleFetchSpy).not.toHaveBeenCalled();
    handleFetchSpy.mockRestore();
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/targets/chrome/service-worker.test.js
```

Expected: the new test FAILS (sender check not yet implemented, so the fetch IS triggered), and existing tests still pass. If existing tests now fail (domain/URL checks return wrong thing), confirm that `chrome.runtime.id` was added and sender args updated correctly.

- [x] **Step 3: Apply the fix**

Open `src/targets/chrome/service-worker.js`. The current content is:

```js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    handleFetchMessage(url, options).then(sendResponse);
    return true;
});
```

Replace with:

```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id) return false;
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    handleFetchMessage(url, options).then(sendResponse);
    return true;
});
```

- [x] **Step 4: Run all tests to verify green**

```bash
npx vitest run tests/unit/targets/chrome/service-worker.test.js
```

Expected: all 11 tests pass (10 existing + 1 new).

Then run the full suite to check for regressions:

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add src/targets/chrome/service-worker.js tests/unit/targets/chrome/service-worker.test.js
git commit -m "fix(chrome): validate sender identity in service worker message listener"
```

---

## Task 2 — B1: Wire Logger through options.js

**Files:**

- Modify: `src/targets/extension/options.js`
- Modify: `tests/unit/targets/options.test.js`

- [x] **Step 1: Write the failing test**

Open `tests/unit/targets/options.test.js`.

At the top of the file, add two module-level variables to capture constructor arguments, and add a `Logger` mock that is transparent (allows checking what was passed):

```js
// Add at the top, alongside the existing module-level spy declarations:
let cacheManagerConstructorArgs;
let configManagerConstructorArgs;
```

Update the existing `vi.mock('../../../src/core/config-manager.js', ...)` factory to capture args:

```js
vi.mock('../../../src/core/config-manager.js', () => ({
    ConfigManager: class {
        constructor(...args) {
            configManagerConstructorArgs = args;
        }
        configGet() {
            return null;
        }
    },
}));
```

Update the existing `vi.mock('../../../src/core/cache.js', ...)` factory to capture args:

```js
vi.mock('../../../src/core/cache.js', () => ({
    CacheManager: class {
        constructor(...args) {
            cacheManagerConstructorArgs = args;
        }
    },
}));
```

Reset both in `beforeEach`:

```js
beforeEach(async () => {
    vi.resetModules();

    capturedInstance = null;
    cacheManagerConstructorArgs = undefined; // ← add
    configManagerConstructorArgs = undefined; // ← add
    renderSpy = vi.fn().mockResolvedValue(undefined);
    tabsQuerySpy = vi.fn().mockResolvedValue([{ id: 1 }, { id: 42 }]);
    tabsReloadSpy = vi.fn().mockResolvedValue(undefined);

    await import('../../../src/targets/extension/options.js');
});
```

Now add the regression test inside the existing `describe` block:

```js
it('should pass a Logger instance as the third argument to CacheManager', () => {
    // Before B1 fix, the third arg was undefined, causing TypeError in clear()
    expect(cacheManagerConstructorArgs).toBeDefined();
    expect(cacheManagerConstructorArgs[2]).toBeDefined();
    expect(cacheManagerConstructorArgs[2]).not.toBeUndefined();
});

it('should pass a Logger instance as the second argument to ConfigManager', () => {
    expect(configManagerConstructorArgs).toBeDefined();
    expect(configManagerConstructorArgs[1]).toBeDefined();
    expect(configManagerConstructorArgs[1]).not.toBeUndefined();
});
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/targets/options.test.js
```

Expected: the two new tests FAIL (`cacheManagerConstructorArgs[2]` is `undefined`). Existing tests still pass.

- [x] **Step 3: Apply the fix**

Open `src/targets/extension/options.js`. Replace the current content with:

```js
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import browser from 'webextension-polyfill';
import { WebExtensionAdapter } from '../../platform/webextension.js';
import { Logger } from '../../core/logger.js';
import { SettingsUI } from '../../core/ui/settings-ui.js';
import { ConfigManager } from '../../core/config-manager.js';
import { CacheManager } from '../../core/cache.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';

const adapter = new WebExtensionAdapter();
const logger = new Logger(adapter);
const config = new ConfigManager(adapter, logger);
const cacheManager = new CacheManager(adapter, config, logger);
const disabledClientsManager = new DisabledClientsManager(adapter);

const ui = new SettingsUI(adapter, undefined, cacheManager, disabledClientsManager);
ui.onSave = async () => {
    const tabs = await browser.tabs.query({ url: '*://*.netflix.com/*' });
    await Promise.all(tabs.map(tab => browser.tabs.reload(tab.id)));
    window.close();
};
ui.render(document.body);
```

- [x] **Step 4: Run the tests to verify green**

```bash
npx vitest run tests/unit/targets/options.test.js
```

Expected: all 4 tests pass (2 existing + 2 new).

Then run the full suite:

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add src/targets/extension/options.js tests/unit/targets/options.test.js
git commit -m "fix(options): pass Logger to ConfigManager and CacheManager constructors"
```

---

## Task 3 — B2: Remove loading overlay on decorateContainer rejection

**Files:**

- Modify: `src/core/overlay.js`
- Modify: `src/core/app.js`
- Modify: `tests/unit/core/app.test.js`

- [x] **Step 1: Write the failing test**

Open `tests/unit/core/app.test.js`. Add this test inside the existing `describe('App', ...)` block, after the existing `'should inject loading overlay while fetching'` test:

```js
it('should remove the loading overlay when getData rejects', async () => {
    const mockAdapter = createMockAdapter({ configGet: vi.fn().mockReturnValue(null) });

    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Failing Title</div>
        </div>
    `;

    vi.spyOn(ApiClientManager.prototype, 'getData').mockRejectedValue(new Error('API failure'));

    appRef = startApp(mockAdapter);

    // Allow decorateRoot to run and the rejection to settle
    await Promise.resolve();
    vi.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    const card = document.querySelector('.title-card');
    expect(card.querySelector('.fm-loading')).toBeNull();
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/core/app.test.js -t "should remove the loading overlay when getData rejects"
```

Expected: FAIL — `.fm-loading` is still present after the rejection because no cleanup happens.

- [x] **Step 3: Add `removeLoadingOverlay` to OverlayRenderer**

Open `src/core/overlay.js`. After the existing `injectLoadingOverlay` method (around line 202), add:

```js
removeLoadingOverlay(container) {
    container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
}
```

The section after the change should read:

```js
injectLoadingOverlay(container) {
    container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
    container.appendChild(this.#createLoadingOverlay());
}

removeLoadingOverlay(container) {
    container.querySelector(`.${this.#LOADING_CLASS}`)?.remove();
}

isLoading(container) {
    return container.querySelector(`.${this.#LOADING_CLASS}`) !== null;
}
```

- [x] **Step 4: Add try/finally in `#decorateContainer`**

Open `src/core/app.js`. Find the `#decorateContainer` method. Replace the block from the `const data = await promise;` line through the `applyFade` call with a try/finally:

Current code (lines 107–111):

```js
const data = await promise;
if (!this.#renderer.hasOverlay(container)) {
    this.#renderer.injectOverlay(container, data);
    this.#renderer.applyFade(container, data, fadeable);
}
```

Replace with:

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

`removeLoadingOverlay` is a no-op on the success path because `injectOverlay` already removes the loading overlay (see `overlay.js` — `injectOverlay` calls `container.querySelector('.fm-rating-overlay')?.remove()` which covers the loading overlay too since it has the same base class). The finally call is safe in both paths.

- [x] **Step 5: Run the tests to verify green**

```bash
npx vitest run tests/unit/core/app.test.js
```

Expected: all tests pass including the new one.

Then run the full suite:

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 6: Commit**

```bash
git add src/core/overlay.js src/core/app.js tests/unit/core/app.test.js
git commit -m "fix(app): remove loading overlay when decorateContainer rejects"
```

---

## Final verification

After all three commits, confirm clean state:

```bash
npm test
npm run lint
```

Both should exit with code 0.
