# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix all actionable items from the 2026-06-05 full codebase review — 3 real bugs, 6 design/test weaknesses, and 3 tooling tweaks — one commit per issue.

**Architecture:** Each task is fully independent. There are no shared state dependencies between tasks except Task 4 (W1) which changes how tests reset between runs — complete it before Tasks 5–10 to avoid `_resetForTest` calls referencing removed methods. Tasks 11–13 are pure config changes with zero runtime impact.

**Tech Stack:** JavaScript ES2022, Vitest, Rollup, ESLint flat config.

---

## Files Modified

| File                                     | Tasks       |
| ---------------------------------------- | ----------- |
| `src/core/api-manager.js`                | T1, T4      |
| `src/core/app.js`                        | T1, T4, T10 |
| `src/core/cache.js`                      | T7          |
| `src/core/request-queue.js`              | T8          |
| `src/core/overlay.js`                    | T10         |
| `src/core/ui/modal.js`                   | T9          |
| `src/core/ui/settings-ui.js`             | T3, T5      |
| `src/targets/chrome/service-worker.js`   | T2          |
| `src/targets/extension/content.js`       | T10         |
| `tests/mocks/adapter.js`                 | T6          |
| `tests/unit/core/api-manager.test.js`    | T1, T4      |
| `tests/unit/core/app.test.js`            | T4          |
| `tests/unit/core/overlay.test.js`        | T10         |
| `tests/unit/core/ui/settings-ui.test.js` | T5          |
| `tests/ui/modal.ui.test.js`              | T9          |
| `eslint.config.js`                       | T11         |
| `vitest.config.js`                       | T12         |
| `rollup.config.js`                       | T13         |

---

## Task 1: B1 — `getData` return consistency

**Files:**

- Modify: `src/core/api-manager.js:86-94`
- Modify: `src/core/app.js:18-27` (imports), `src/core/app.js:91`
- Modify: `tests/unit/core/api-manager.test.js:63-106`

`getData` returns `null` on both miss paths but writes `Title.notFound()` to cache. On a cache hit that `Title` is returned — inconsistent contract. Fix: always return the `Title.notFound` object.

- [x] **Step 1: Update the two miss-path returns in `api-manager.js`**

In `src/core/api-manager.js`, replace the `getData` method body (lines 80–99):

```js
async getData(displayTitle) {
    const cached = await this.#cache.read(displayTitle);
    if (cached !== null) return cached;

    const status = await this.#client.getStatus();
    if (!status.healthy) {
        const notFound = Title.notFound(displayTitle);
        await this.#cache.write(displayTitle, notFound);
        return notFound;
    }

    const data = await this.#client.fetch(displayTitle);
    if (!data) {
        const notFound = Title.notFound(displayTitle);
        await this.#cache.write(displayTitle, notFound);
        return notFound;
    }

    await this.#cache.write(displayTitle, data);
    logger.info(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}.`);
    return data;
}
```

- [x] **Step 2: Remove the null-coalescing fallback in `app.js`**

In `src/core/app.js`, `#decorateContainer` at the line that calls `injectOverlay` (currently line 91):

```js
// Before:
this.#renderer.injectOverlay(container, data ?? Title.notFound(displayTitle));
// After:
this.#renderer.injectOverlay(container, data);
```

Then remove the now-unused `Title` import from the top of the file. The import line is:

```js
import { Title } from './title.js';
```

Delete it entirely. (Verify no other usage of `Title` remains in `app.js`.)

- [x] **Step 3: Update tests that expected `null` on miss**

In `tests/unit/core/api-manager.test.js`, update the three affected tests:

```js
it('should handle fail if client returns null', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const client = {
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(null),
    };
    const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, client);

    const result = await manager.getData('Some Title');
    expect(result).not.toBeNull();
    expect(result.hasRating).toBe(false);
    expect(result.displayTitle).toBe('Some Title');
    expect(client.fetch).toHaveBeenCalled();
});

it('should cache "Not Found" result if client fails', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const client = {
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(null),
    };
    const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, client);

    const result = await manager.getData('Unknown Movie');
    expect(result.hasRating).toBe(false);
    expect(mockCache.write).toHaveBeenCalledWith(
        'Unknown Movie',
        expect.objectContaining({ apiTitle: null, rating: null })
    );
});

it('should skip unhealthy client', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const unhealthyClient = {
        getStatus: vi.fn().mockResolvedValue({ healthy: false }),
        fetch: vi.fn(),
    };
    const manager = new ApiClientManager(mockCache, {}, {}, mockConfig, unhealthyClient);

    const result = await manager.getData('Test Movie');
    expect(result).not.toBeNull();
    expect(result.hasRating).toBe(false);
    expect(unhealthyClient.fetch).not.toHaveBeenCalled();
});
```

- [x] **Step 4: Run the tests**

```bash
npx vitest run tests/unit/core/api-manager.test.js tests/unit/core/app.test.js
```

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add src/core/api-manager.js src/core/app.js tests/unit/core/api-manager.test.js
git commit -m "fix(api-manager): return Title.notFound instead of null on getData miss"
```

---

## Task 2: B2 — Chrome double domain validation

**Files:**

- Modify: `src/targets/chrome/service-worker.js:18-20` (imports), `src/targets/chrome/service-worker.js:24-29` (pre-validation block)

- [x] **Step 1: Remove the pre-validation block**

In `src/targets/chrome/service-worker.js`, the listener currently reads:

```js
import { handleFetchMessage } from '../extension/fetch-proxy.js';
import { validateDomain } from '../extension/domains.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;

    const validation = validateDomain(url);
    if (!validation.valid) {
        sendResponse({ error: validation.error });
        return false;
    }

    handleFetchMessage(url, options).then(sendResponse);
    return true;
});
```

Replace with (remove the `validateDomain` import and the pre-check block):

```js
import { handleFetchMessage } from '../extension/fetch-proxy.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FM_FETCH') return false;
    const { url, options = {} } = msg;
    handleFetchMessage(url, options).then(sendResponse);
    return true;
});

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
```

- [x] **Step 2: Run the service-worker tests**

```bash
npx vitest run tests/unit/targets/chrome/service-worker.test.js
```

Expected: all pass.

- [x] **Step 3: Commit**

```bash
git add src/targets/chrome/service-worker.js
git commit -m "fix(chrome): remove redundant domain pre-validation from service-worker"
```

---

## Task 3: B3 — Options page adapter never initialized

**Files:**

- Modify: `src/core/ui/settings-ui.js:34`

The fix belongs in `SettingsUI.render()` — that is where `storageGetAll()` is called, so it is the right place to initialize the adapter's synchronous config reads. The adapter's `setConfigData` method may not exist on all adapter types (e.g., the userscript adapter does not have it), so use optional chaining.

- [x] **Step 1: Call `setConfigData` after `storageGetAll` in `render()`**

In `src/core/ui/settings-ui.js`, in the `render` method, after the `storageGetAll` call (currently line 34):

```js
// Before:
const settings = (await this.adapter.storageGetAll()) || {};

// After:
const settings = (await this.adapter.storageGetAll()) || {};
this.adapter.setConfigData?.(settings);
```

- [x] **Step 2: Run the settings-ui tests**

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js tests/ui/settings-ui.ui.test.js
```

Expected: all pass.

- [x] **Step 3: Commit**

```bash
git add src/core/ui/settings-ui.js
git commit -m "fix(options): initialise adapter config data after storage load"
```

---

## Task 4: W1 — Singleton enforcement at the right layer

**Files:**

- Modify: `src/core/api-manager.js` (remove static flag + backdoor)
- Modify: `src/core/app.js` (module-level guards + export reset fn)
- Modify: `tests/unit/core/api-manager.test.js` (remove reset calls + singleton test)
- Modify: `tests/unit/core/app.test.js` (swap reset call + add startApp twice test)

`ApiClientManager` carries a `static #created` flag and `_resetForTest()` backdoor. `FlixMonkeyApp` carries static navigation-patching state and `resetInternalState()`. Both belong at the module level in `app.js`.

- [x] **Step 1: Remove singleton flag from `ApiClientManager`**

In `src/core/api-manager.js`, remove these lines:

```js
// Remove:
static #created = false;

// Remove (in constructor):
if (ApiClientManager.#created) throw new Error('ApiClientManager already instantiated');
ApiClientManager.#created = true;

// Remove entirely:
/** @internal for testing only */
static _resetForTest() {
    ApiClientManager.#created = false;
}
```

The class constructor becomes:

```js
constructor(cacheManager, disabledManager, adapter, config, client = null) {
    this.#cache = cacheManager;
    this.#disabledManager = disabledManager;
    this.#config = config;
    this.#client = client;

    if (!this.#client) {
        this.#client = ApiClientManager.#createClientFromConfig(this.#config, this.#disabledManager, adapter);
    }
}
```

- [x] **Step 2: Move singleton and navigation state to module level in `app.js`**

In `src/core/app.js`:

1. Add these four module-level declarations **before** the `FlixMonkeyApp` class:

```js
let _appStarted = false;
let _navigationPatched = false;
const _originalPushState = history.pushState;
const _originalReplaceState = history.replaceState;
```

2. Remove the three static fields from `FlixMonkeyApp`:

```js
// Remove:
static #isNavigationPatched = false;
static #originalPushState = history.pushState;
static #originalReplaceState = history.replaceState;
```

3. Remove `resetInternalState()` from the class entirely:

```js
// Remove:
/** @internal for testing only */
static resetInternalState() {
    FlixMonkeyApp.#isNavigationPatched = false;
    history.pushState = FlixMonkeyApp.#originalPushState;
    history.replaceState = FlixMonkeyApp.#originalReplaceState;
    ApiClientManager._resetForTest();
}
```

4. Update `#initNavigationObservers()` to use the module-level variables:

```js
#initNavigationObservers() {
    if (_navigationPatched) return;
    _navigationPatched = true;

    history.pushState = (...args) => {
        _originalPushState.apply(history, args);
        this.#debouncedDecorate();
    };
    history.replaceState = (...args) => {
        _originalReplaceState.apply(history, args);
        this.#debouncedDecorate();
    };

    window.addEventListener('popstate', () => this.#debouncedDecorate());

    this.#observer = new MutationObserver(mutations => {
        try {
            const hasElements = mutations.some(m =>
                Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE)
            );
            if (hasElements) this.#debouncedDecorate();
        } catch (err) {
            logger.error('Mutation handler error', err);
        }
    });
    this.#observer.observe(document.body, { childList: true, subtree: true });
}
```

5. Add guard to `startApp` and export the test-reset function. Update `startApp` and add export **after** it:

```js
export function startApp(adapter) {
    if (_appStarted) throw new Error('startApp already called');
    _appStarted = true;

    const configManager = new ConfigManager(adapter);
    const cache = new CacheManager(adapter, configManager);
    const disabledManager = new DisabledClientsManager(adapter);
    const api = new ApiClientManager(cache, disabledManager, adapter, configManager);
    const renderer = new OverlayRenderer(configManager);
    const surfaces = new SurfaceManager();
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces);
    logger.setConfig(configManager);
    app.init();
    return {
        clearCache: () => app.clearCache(),
        resetDisabledClients: () => app.resetDisabledClients(),
        disconnect: () => app.disconnect(),
    };
}

/** @internal for testing only */
export function _resetStartedForTest() {
    _appStarted = false;
    _navigationPatched = false;
    history.pushState = _originalPushState;
    history.replaceState = _originalReplaceState;
}
```

- [x] **Step 3: Update `api-manager.test.js`**

Remove the `beforeEach` that called `ApiClientManager._resetForTest()` and the singleton-throw test:

```js
// Remove entirely:
beforeEach(() => {
    ApiClientManager._resetForTest();
});

// Remove entirely:
it('should throw if instantiated more than once', () => {
    new ApiClientManager({}, {}, {}, mockConfig, {});
    expect(() => new ApiClientManager({}, {}, {}, mockConfig, {})).toThrow('ApiClientManager already instantiated');
});
```

- [x] **Step 4: Update `app.test.js`**

1. Update the import at the top:

```js
// Before:
import { startApp, FlixMonkeyApp } from '../../../src/core/app.js';
import { ApiClientManager } from '../../../src/core/api-manager.js';

// After:
import { startApp, FlixMonkeyApp, _resetStartedForTest } from '../../../src/core/app.js';
import { ApiClientManager } from '../../../src/core/api-manager.js';
```

2. In `afterEach`, replace the reset call:

```js
// Before:
FlixMonkeyApp.resetInternalState();

// After:
_resetStartedForTest();
```

3. Add a new test that `startApp` throws if called twice. Add it alongside the existing init-twice test:

```js
it('should throw if startApp is called twice', () => {
    const mockAdapter = createMockAdapter();
    appRef = startApp(mockAdapter);
    expect(() => startApp(mockAdapter)).toThrow('startApp already called');
});
```

- [x] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass. The singleton test in `api-manager.test.js` is gone; the new `startApp` throws test passes.

- [x] **Step 6: Commit**

```bash
git add src/core/api-manager.js src/core/app.js tests/unit/core/api-manager.test.js tests/unit/core/app.test.js
git commit -m "refactor(api-manager): move singleton guard to startApp module level"
```

---

## Task 5: W5 — Checkbox `_validate()` reads wrong value

**Files:**

- Modify: `src/core/ui/settings-ui.js:128`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

`_validate()` passes `input.value` to field validators. For checkboxes `input.value` is always `"on"` — should be `input.checked`.

- [x] **Step 1: Write a failing test**

In `tests/unit/core/ui/settings-ui.test.js`, add a new test at the end of the `describe` block:

```js
it('should pass input.checked (not input.value) to validate for checkbox fields', async () => {
    const validateFn = vi.fn().mockReturnValue(null);
    const checkboxField = {
        key: 'testCheckbox',
        label: 'Test Checkbox',
        type: 'checkbox',
        default: false,
        validate: validateFn,
    };
    const ui = new SettingsUI(mockAdapter, [checkboxField], mockCacheManager, mockDisabledClientsManager);
    await ui.render(container);

    const input = container.querySelector('#fm-testCheckbox');
    input.checked = true;

    ui._validate();

    expect(validateFn).toHaveBeenCalledWith(true);
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js -t "should pass input.checked"
```

Expected: FAIL — `validateFn` was called with `"on"` not `true`.

- [x] **Step 3: Fix `_validate()` in `settings-ui.js`**

In `src/core/ui/settings-ui.js`, in the `_validate` method, replace the single validate call line:

```js
// Before:
const errorMsg = field.validate ? field.validate(input.value) : null;

// After:
const fieldValue = input.type === 'checkbox' ? input.checked : input.value;
const errorMsg = field.validate ? field.validate(fieldValue) : null;
```

- [x] **Step 4: Run the tests**

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js
```

Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
git commit -m "fix(settings-ui): pass input.checked for checkbox field validation"
```

---

## Task 6: W6 — Complete `createMockAdapter`

**Files:**

- Modify: `tests/mocks/adapter.js`

Three adapter methods are missing from the shared test fixture, causing silent fallbacks in tests that call them.

- [x] **Step 1: Add missing methods to `createMockAdapter`**

In `tests/mocks/adapter.js`, replace the returned object:

```js
export function createMockAdapter(overrides = {}) {
    return {
        httpFetch: vi.fn().mockResolvedValue({}),
        storageGet: vi.fn().mockResolvedValue(null),
        storageSet: vi.fn().mockResolvedValue(undefined),
        storageDelete: vi.fn().mockResolvedValue(undefined),
        storageGetKeys: vi.fn().mockResolvedValue([]),
        storageGetAll: vi.fn().mockResolvedValue({}),
        storageSetMany: vi.fn().mockResolvedValue(undefined),
        configGet: vi.fn().mockReturnValue(undefined),
        ...overrides,
    };
}
```

- [x] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. No test should regress; some previously-silently-broken config reads now exercise real mock methods.

- [x] **Step 3: Commit**

```bash
git add tests/mocks/adapter.js
git commit -m "test(mocks): add storageGetAll, storageSetMany, configGet to createMockAdapter"
```

---

## Task 7: W3 — Parallel cache deletes

**Files:**

- Modify: `src/core/cache.js:77-84`

- [x] **Step 1: Replace the serial loop with `Promise.all`**

In `src/core/cache.js`, replace the `clear()` method body:

```js
async clear() {
    const keys = await this.#adapter.storageGetKeys(this.#prefix);
    const count = keys.length;
    await Promise.all(keys.map(key => this.#adapter.storageDelete(key)));
    logger.debug(`Cache cleared – removed ${count} entr${count === 1 ? 'y' : 'ies'}.`);
}
```

- [x] **Step 2: Run the cache tests**

```bash
npx vitest run tests/unit/core/cache.test.js
```

Expected: all pass.

- [x] **Step 3: Commit**

```bash
git add src/core/cache.js
git commit -m "perf(cache): delete entries in parallel in CacheManager.clear"
```

---

## Task 8: W4 — Sort on enqueue instead of every iteration

**Files:**

- Modify: `src/core/request-queue.js:32-36` (enqueue), `src/core/request-queue.js:52-55` (#process)

- [x] **Step 1: Move the sort from `#process` to `enqueue`**

In `src/core/request-queue.js`:

Replace the `enqueue` method:

```js
enqueue(url, priority, fetchFn, responseType) {
    return new Promise((resolve, reject) => {
        this.#queue.push({ url, priority, resolve, reject, fetchFn, responseType });
        if (this.#queue.length > 1) {
            this.#queue.sort((a, b) => b.priority - a.priority);
        }
        this.#process();
    });
}
```

In `#process`, remove the sort block (currently lines 53–55):

```js
// Remove this block from #process:
if (this.#queue.length > 1) {
    this.#queue.sort((a, b) => b.priority - a.priority);
}
```

The `#process` `while` loop now starts directly with the `Date.now()` read after the `while (this.#queue.length > 0)` check.

- [x] **Step 2: Run the request-queue tests**

```bash
npx vitest run tests/unit/core/request-queue.test.js
```

Expected: all pass, including priority-ordering tests.

- [x] **Step 3: Commit**

```bash
git add src/core/request-queue.js
git commit -m "perf(request-queue): sort on enqueue instead of on every iteration"
```

---

## Task 9: W7 — Modal keyboard accessibility and ARIA

**Files:**

- Modify: `src/core/ui/modal.js`
- Modify: `tests/ui/modal.ui.test.js`

- [x] **Step 1: Write failing tests**

Add three tests to `tests/ui/modal.ui.test.js` (before the closing `});`):

```js
it('should have role="dialog" and aria-modal on the content element', () => {
    const _modal = new Modal('A11y Modal');
    const content = document.querySelector('.fm-modal-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('aria-labelledby')).toBe('fm-modal-title');
    expect(document.getElementById('fm-modal-title')).not.toBeNull();
});

it('should close when Escape is pressed', () => {
    const modal = new Modal('Escape Modal');
    modal.open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.fm-modal-overlay')).toBeNull();
});

it('should return focus to the trigger element after close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const modal = new Modal('Focus Modal');
    modal.open();
    modal.close();

    expect(document.activeElement).toBe(trigger);
});
```

- [x] **Step 2: Run the new tests to verify they fail**

```bash
npx vitest run tests/ui/modal.ui.test.js -t "role=\"dialog\""
npx vitest run tests/ui/modal.ui.test.js -t "Escape"
npx vitest run tests/ui/modal.ui.test.js -t "return focus"
```

Expected: all three FAIL.

- [x] **Step 3: Rewrite `modal.js`**

Replace the entire `src/core/ui/modal.js` class body with:

```js
export class Modal {
    #returnFocus = null;
    #escHandler = null;

    constructor(title) {
        this.title = title;
        this.overlay = document.createElement('div');
        this.overlay.className = 'fm-modal-overlay';
        this.overlay.innerHTML = `
            <div class="fm-modal-content" role="dialog" aria-modal="true" aria-labelledby="fm-modal-title" tabindex="-1">
                <div class="fm-modal-header">
                    <h2 class="fm-modal-title" id="fm-modal-title"></h2>
                    <button class="fm-modal-close">×</button>
                </div>
                <div class="fm-modal-body"></div>
            </div>
        `;
        this.overlay.querySelector('.fm-modal-title').textContent = this.title;
        this.overlay.querySelector('.fm-modal-close').onclick = () => this.close();
        document.body.appendChild(this.overlay);
    }

    getContentContainer() {
        return this.overlay.querySelector('.fm-modal-body');
    }

    open() {
        this.#returnFocus = document.activeElement;
        this.overlay.style.display = 'flex';
        this.overlay.querySelector('.fm-modal-content').focus();
        this.#escHandler = e => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.#escHandler);
    }

    close() {
        if (this.#escHandler) {
            document.removeEventListener('keydown', this.#escHandler);
            this.#escHandler = null;
        }
        this.overlay.remove();
        this.#returnFocus?.focus();
    }
}
```

- [x] **Step 4: Run all modal tests**

```bash
npx vitest run tests/ui/modal.ui.test.js
```

Expected: all pass including the three new ones.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/modal.js tests/ui/modal.ui.test.js
git commit -m "feat(modal): add keyboard accessibility and ARIA roles"
```

---

## Task 10: W8 — Overlay styles idempotent; re-inject on corner change

**Files:**

- Modify: `src/core/overlay.js`
- Modify: `src/core/app.js` (expose `refreshStyles` in return value)
- Modify: `src/targets/extension/content.js`
- Modify: `tests/unit/core/overlay.test.js`

Currently `injectStyles()` uses an instance flag `#stylesInjected` and always appends a new `<style>` tag. The fix replaces the instance flag with a DOM-id check so any call updates rather than duplicates the tag. Then `content.js` calls `refreshStyles()` when the corner setting changes.

- [x] **Step 1: Write a failing test for idempotent update**

In `tests/unit/core/overlay.test.js`, replace the existing "should allow two separate instances" test with a test for the new idempotent behavior, and add an update test:

```js
it('should update the existing style tag when injectStyles is called again', () => {
    const configLeft = new ConfigManager(key => (key === 'overlayCorner' ? 'top-left' : undefined));
    const configRight = new ConfigManager(key => (key === 'overlayCorner' ? 'top-right' : undefined));
    const rendererA = new OverlayRenderer(configLeft);
    const rendererB = new OverlayRenderer(configRight);

    rendererA.injectStyles();
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
    expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('left:6px');

    rendererB.injectStyles();
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
    expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('right:6px');
});
```

Also update the existing "should inject styles only once per instance" test — after the change it verifies the same outcome but via the DOM id rather than an instance flag. No assertion change needed, but verify the `id` is set:

```js
it('should inject styles only once per instance', () => {
    const renderer = new OverlayRenderer(new ConfigManager());
    renderer.injectStyles();
    renderer.injectStyles();
    const styles = document.head.querySelectorAll('style');
    expect(styles).toHaveLength(1);
    expect(document.head.querySelector('#fm-overlay-styles')).not.toBeNull();
});
```

- [x] **Step 2: Run the overlay tests to verify the new test fails**

```bash
npx vitest run tests/unit/core/overlay.test.js -t "should update the existing"
```

Expected: FAIL — second renderer appends a second tag instead of updating.

- [x] **Step 3: Rewrite `injectStyles()` in `overlay.js`**

Remove the `#stylesInjected` field and rewrite `injectStyles()`:

```js
// Remove this private field:
#stylesInjected = false;
```

Replace the `injectStyles()` method:

```js
injectStyles() {
    const existing = document.getElementById('fm-overlay-styles');
    const cornerStyles = {
        'top-left': 'top:6px;left:6px;',
        'top-right': 'top:6px;right:6px;',
        'bottom-left': 'bottom:6px;left:6px;',
        'bottom-right': 'bottom:6px;right:6px;',
    };
    const corner = this.#config.get('overlayCorner', 'top-left');
    const positionCss = cornerStyles[corner] ?? cornerStyles['top-left'];
    const flexDirection = corner.includes('bottom') ? 'column-reverse' : 'column';
    let cssText = `
        .${this.#OVERLAY_CLASS} {
            position: absolute;
            ${positionCss}
            z-index: 9999;
            display: flex;
            flex-direction: ${flexDirection};
            gap: 4px;
            pointer-events: none;
        }
        .${this.#OVERLAY_CLASS} > * {
            background: rgba(0,0,0,0.72);
            font-family: Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: default;
            text-decoration: none;
            white-space: nowrap;
            pointer-events: auto;
            transition: background 0.15s;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .${this.#OVERLAY_CLASS} a {
            pointer-events: auto;
            cursor: pointer;
        }
        .${this.#OVERLAY_CLASS} > *:hover { background: rgba(0,0,0,0.92); }
        .${this.#OVERLAY_CLASS} .fm-label { font-size: 10px; letter-spacing: 0.03em; color: #f5c518; }
        .${this.#OVERLAY_CLASS} .fm-rt { color: #fa320a; }
        .${this.#OVERLAY_CLASS} .fm-mc { color: #6ac; }
        .${this.#OVERLAY_CLASS} .fm-value { color: #fff; }
        .${this.#OVERLAY_CLASS} .fm-na { color: #aaa; }
        .${this.#OVERLAY_CLASS} .fm-search { font-size: 11px; color: #ccc; }
    `;
    if (corner.includes('left')) {
        cssText += `\n        .${TOP_10_BADGE} .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
    }
    cssText += `
        .fm-faded { opacity: 0.30; transition: opacity 0.2s; }
        .fm-faded:hover { opacity: 1; }
    `;
    if (existing) {
        existing.textContent = cssText;
    } else {
        const style = document.createElement('style');
        style.id = 'fm-overlay-styles';
        style.textContent = cssText;
        document.head.appendChild(style);
    }
}
```

- [x] **Step 4: Expose `refreshStyles` from `startApp` in `app.js`**

In `src/core/app.js`, update the `startApp` return value:

```js
return {
    clearCache: () => app.clearCache(),
    resetDisabledClients: () => app.resetDisabledClients(),
    disconnect: () => app.disconnect(),
    refreshStyles: () => renderer.injectStyles(),
};
```

- [x] **Step 5: Update `content.js` to re-inject styles on corner change**

In `src/targets/extension/content.js`, capture the `startApp` return value and call `refreshStyles()` when `overlayCorner` changes:

```js
import browser from 'webextension-polyfill';
import { WebExtensionAdapter } from '../../platform/webextension.js';
import { startApp } from '../../core/app.js';

(async () => {
    const adapter = new WebExtensionAdapter();
    const stored = await browser.storage.local.get(null);
    adapter.setConfigData(stored);

    // Register storage listener BEFORE starting the app to ensure any configuration changes
    // are reflected in the 'stored' object which the adapter uses for synchronous reads.
    let appRef;
    browser.storage.onChanged.addListener(changes => {
        Object.entries(changes).forEach(([k, v]) => {
            stored[k] = v.newValue;
        });
        if ('overlayCorner' in changes) {
            appRef?.refreshStyles();
        }
    });

    appRef = startApp(adapter);
})();
```

- [x] **Step 6: Run the overlay tests and full suite**

```bash
npx vitest run tests/unit/core/overlay.test.js
npm test
```

Expected: all pass including the new update test.

- [x] **Step 7: Commit**

```bash
git add src/core/overlay.js src/core/app.js src/targets/extension/content.js tests/unit/core/overlay.test.js
git commit -m "fix(overlay): make injectStyles idempotent; re-inject on corner config change"
```

---

## Task 11: `no-console` → error

**Files:**

- Modify: `eslint.config.js:9`

- [x] **Step 1: Change `no-console` from `warn` to `error`**

In `eslint.config.js`, in `commonRules`:

```js
// Before:
'no-console': ['warn', { allow: ['debug', 'info', 'warn', 'error'] }],

// After:
'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error'] }],
```

- [x] **Step 2: Run lint to confirm no violations**

```bash
npm run lint
```

Expected: exits 0 with no `no-console` errors. The `allow` list already covers all logger-style console methods; only bare `console.log` calls would be flagged, and there should be none in `src/`.

- [x] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "build(eslint): promote no-console from warn to error"
```

---

## Task 12: Raise coverage thresholds

**Files:**

- Modify: `vitest.config.js:10`

- [x] **Step 1: Verify current coverage clears 90%**

```bash
npm test -- --coverage
```

Check the output table. Both `lines` and `functions` rows should already show ≥ 90%. If either is below 90%, do **not** raise the threshold — investigate which files are under-covered first.

- [x] **Step 2: Raise thresholds in `vitest.config.js`**

```js
// Before:
coverage: {
    thresholds: { lines: 80, functions: 80 },
},

// After:
coverage: {
    thresholds: { lines: 90, functions: 90 },
},
```

- [x] **Step 3: Run tests to confirm they still pass with the new thresholds**

```bash
npm test -- --coverage
```

Expected: exits 0.

- [x] **Step 4: Commit**

```bash
git add vitest.config.js
git commit -m "build(vitest): raise coverage thresholds to 90%"
```

---

## Task 13: `rollup.config.js` cleanup

**Files:**

- Modify: `rollup.config.js:64-130`

Replace the `_target` piggyback pattern with a plain object keyed by target name.

- [x] **Step 1: Rewrite the config export section**

In `rollup.config.js`, replace the `allConfigs` array and the `export default` at the bottom with:

```js
const configsByTarget = {
    userscript: [
        {
            input: 'src/targets/userscript/entry.js',
            output: { file: 'dist/FlixMonkey.user.js', format: 'iife', banner: USERSCRIPT_BANNER },
            plugins: [
                ...sharedPlugins(),
                {
                    name: 'strip-license-header',
                    transform(code) {
                        return code.replace(
                            /\/\*\*(?:(?!\*\/)[\s\S])*?GNU General Public License(?:(?!\*\/)[\s\S])*?\*\/\n?/g,
                            ''
                        );
                    },
                },
            ],
        },
    ],
    firefox: [
        {
            input: 'src/targets/extension/content.js',
            output: { file: 'dist/firefox/content.js', format: 'iife', sourcemap: true },
            plugins: [
                ...sharedPlugins(),
                copyStatic([['src/targets/extension/options.html', 'dist/firefox/options.html']]),
                injectManifestMetadata('src/targets/firefox/manifest.json', 'dist/firefox/manifest.json'),
            ],
        },
        {
            input: 'src/targets/extension/options.js',
            output: { file: 'dist/firefox/options.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
        {
            input: 'src/targets/firefox/background.js',
            output: { file: 'dist/firefox/background.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
    ],
    chrome: [
        {
            input: 'src/targets/extension/content.js',
            output: { file: 'dist/chrome/content.js', format: 'iife', sourcemap: true },
            plugins: [
                ...sharedPlugins(),
                copyStatic([['src/targets/extension/options.html', 'dist/chrome/options.html']]),
                injectManifestMetadata('src/targets/chrome/manifest.json', 'dist/chrome/manifest.json'),
            ],
        },
        {
            input: 'src/targets/extension/options.js',
            output: { file: 'dist/chrome/options.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
        {
            input: 'src/targets/chrome/service-worker.js',
            output: { file: 'dist/chrome/service-worker.js', format: 'iife', sourcemap: true },
            plugins: sharedPlugins(),
        },
    ],
};

const targets = target ? [target] : Object.keys(configsByTarget);
export default targets.flatMap(t => configsByTarget[t]);
```

- [x] **Step 2: Verify the build still works**

```bash
npm run build
```

Expected: `dist/` artifacts are produced for all three targets with no errors.

- [x] **Step 3: Commit**

```bash
git add rollup.config.js
git commit -m "refactor(rollup): use keyed object instead of _target piggyback"
```
