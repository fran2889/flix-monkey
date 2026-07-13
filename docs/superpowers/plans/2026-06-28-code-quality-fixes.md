# Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix ten isolated code-quality issues across config validation, utilities, API layer, settings UI, and test coverage tooling, each shipped as its own PR.

**Architecture:** Each task is self-contained — one or two source files, tests in the same commit. No task depends on any other; they can be executed in any order, though the order below goes from simplest to most structural.

**Tech Stack:** JavaScript (ES2022 private class fields), Vitest, jsdom

## Global Constraints

- All tests run with: `npm test` (runs `tests/unit` and `tests/ui` only; integration tests are excluded)
- Each task ends with `npm test` passing and a single commit
- Commit titles follow conventional commits: `type(scope): description`
- No new dependencies
- No new exported symbols unless the spec explicitly requires them
- The spec for this work lives at `docs/superpowers/specs/2026-06-28-code-quality-fixes-design.md`
- The implementation plan lives at `docs/superpowers/plans/2026-06-28-code-quality-fixes.md` (this file); both travel with Task 1's PR

---

## Files Modified

| Task | Files                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/core/config-fields.js`                                                                                            |
| 2    | `src/core/utils.js`, `tests/unit/core/utils.test.js`                                                                   |
| 3    | `src/platform/webextension.js`, `tests/unit/platform/webextension.test.js`                                             |
| 4    | `src/core/api-manager.js`                                                                                              |
| 5    | `src/core/ui/settings-ui.js`, `tests/unit/core/ui/settings-ui.test.js`                                                 |
| 6    | `src/core/ui/modal.js`, `tests/unit/core/ui/modal.test.js`                                                             |
| 7    | `src/core/title.js`, `src/core/api-clients.js`, `tests/unit/core/title.test.js`, `tests/unit/core/api-manager.test.js` |
| 8    | `src/core/ui/settings-ui.js`                                                                                           |
| 9    | `src/core/ui/settings-ui.js`, `tests/unit/core/ui/settings-ui.test.js`                                                 |
| 10   | `vitest.config.js`                                                                                                     |

---

## Task 1: Shared TTL validator helper

**Files:**

- Modify: `src/core/config-fields.js`

**Interfaces:**

- Produces: nothing new — `CONFIG_FIELDS` export is unchanged in shape; validators on the three cache TTL fields now delegate to the extracted helper

The three cache TTL config fields (`cacheTtlRatedOldYear`, `cacheTtlRatedNewYear`, `cacheTtlNoRating`) each carry an identical inline validator body. Extract it as a module-scoped unexported function.

- [x] **Step 1: Verify existing TTL validator tests pass**

```bash
npx vitest run tests/unit/core/config-fields.test.js
```

Expected: all tests pass. The `describe.each(['cacheTtlRatedOldYear', 'cacheTtlRatedNewYear', 'cacheTtlNoRating'])` block at line 89 is the coverage target.

- [x] **Step 2: Extract the helper in `src/core/config-fields.js`**

Add the helper function before the `CONFIG_FIELDS` declaration (after the imports):

```js
function validateCacheTtl(val) {
    if (typeof val === 'string' && val.trim() === '') return 'Must be -1 or a positive integer';
    const n = Number(val);
    return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Must be -1 or a positive integer';
}
```

Replace each of the three identical inline validators (on `cacheTtlRatedOldYear`, `cacheTtlRatedNewYear`, `cacheTtlNoRating`) with:

```js
validate: validateCacheTtl,
```

The three fields are at lines ~117, ~129, ~143. After the change the three field objects look like:

```js
{
    key: 'cacheTtlRatedOldYear',
    label: 'Rated > 1yr',
    type: 'text',
    default: String(CACHE_TTL_INFINITE),
    title: 'How long to cache ratings for older titles. -1 = forever.',
    section: 'Cache Duration (days)',
    row: 'cache-fields',
    validate: validateCacheTtl,
},
{
    key: 'cacheTtlRatedNewYear',
    label: 'Rated < 1yr',
    type: 'text',
    default: '30',
    title: 'How long to cache ratings for recent titles.',
    row: 'cache-fields',
    validate: validateCacheTtl,
},
{
    key: 'cacheTtlNoRating',
    label: 'Unrated',
    type: 'text',
    default: '1',
    title: 'How long to cache titles with no rating. Use small value to retry sooner.',
    row: 'cache-fields',
    validate: validateCacheTtl,
},
```

- [x] **Step 3: Run tests to verify nothing broke**

```bash
npm test
```

Expected: all tests pass. No behavior changed.

- [x] **Step 4: Commit**

```bash
git add src/core/config-fields.js docs/superpowers/specs/2026-06-28-code-quality-fixes-design.md docs/superpowers/plans/2026-06-28-code-quality-fixes.md
git commit -m "refactor(config): extract shared TTL validator helper"
```

---

## Task 2: `window` guard in `runIdle`

**Files:**

- Modify: `src/core/utils.js`
- Modify: `tests/unit/core/utils.test.js`

**Interfaces:**

- Produces: `runIdle(func, timeout?)` — same signature, same behavior in browser environments, safe on hosts where `window` is undefined

- [x] **Step 1: Write the failing test**

In `tests/unit/core/utils.test.js`, inside the `describe('runIdle')` block (after the two existing tests), add:

```js
it('falls back to setTimeout when window is undefined', () => {
    const savedWindow = global.window;
    global.window = undefined;
    const func = vi.fn();
    runIdle(func);
    vi.advanceTimersByTime(1);
    expect(func).toHaveBeenCalled();
    global.window = savedWindow;
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/core/utils.test.js
```

Expected: the new test fails because the current code dereferences `window.requestIdleCallback` when `window` is undefined, causing a TypeError.

- [x] **Step 3: Apply the guard in `src/core/utils.js`**

Change line 57 of `src/core/utils.js` from:

```js
if (typeof window.requestIdleCallback === 'function') {
```

to:

```js
if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
```

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including the new one.

- [x] **Step 5: Commit**

```bash
git add src/core/utils.js tests/unit/core/utils.test.js
git commit -m "fix(utils): guard window existence in runIdle"
```

---

## Task 3: `httpFetch` timeout cleanup

**Files:**

- Modify: `src/platform/webextension.js`
- Modify: `tests/unit/platform/webextension.test.js`

**Interfaces:**

- Produces: `httpFetch(url, options?)` — same signature; the dangling `setTimeout` is now cleared after every settled race

- [x] **Step 1: Write the failing test**

In `tests/unit/platform/webextension.test.js`, after the existing `httpFetch` tests, add:

```js
it('httpFetch clears the timeout after a successful fetch', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    browser.runtime.sendMessage.mockResolvedValue({ data: { ok: true } });
    await adapter.httpFetch('https://api.example.com');
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/platform/webextension.test.js
```

Expected: the new test fails because `clearTimeout` is never called in the current implementation.

- [x] **Step 3: Update `httpFetch` in `src/platform/webextension.js`**

Replace the current `httpFetch` method body (lines 70–83) with:

```js
async httpFetch(url, options = {}) {
    const timeout = options.timeout ?? DEFAULT_FETCH_TIMEOUT;
    const fetchPromise = browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });

    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(
            () => reject(new FlixMonkeyError('background relay timeout', url)),
            timeout
        );
    });

    try {
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (!response) throw new FlixMonkeyError('empty background response', url);
        if (response.error) {
            throw new FlixMonkeyError(response.error, url, response.status, response.body ?? null);
        }
        return response.data;
    } finally {
        clearTimeout(timerId);
    }
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including the new one.

- [x] **Step 5: Commit**

```bash
git add src/platform/webextension.js tests/unit/platform/webextension.test.js
git commit -m "fix(webextension): clear httpFetch timeout after race settles"
```

---

## Task 4: Remove `getClient()` from `ApiClientManager`

**Files:**

- Modify: `src/core/api-manager.js`

**Interfaces:**

- The method `getClient()` is removed entirely. It has no caller in `src/` and no test calls it (confirmed by the coverage report showing line 34 uncovered).

- [x] **Step 1: Delete the `getClient()` method**

In `src/core/api-manager.js`, remove lines 33–35:

```js
getClient() {
    return this.#client;
}
```

The file goes from:

```js
constructor(cache, disabledManager, client, logger) {
    this.#cache = cache;
    this.#disabledManager = disabledManager;
    this.#client = client;
    this.#logger = logger;
}

getClient() {
    return this.#client;
}

async resetDisabledClients() {
```

to:

```js
constructor(cache, disabledManager, client, logger) {
    this.#cache = cache;
    this.#disabledManager = disabledManager;
    this.#client = client;
    this.#logger = logger;
}

async resetDisabledClients() {
```

- [x] **Step 2: Run tests to verify nothing broke**

```bash
npm test
```

Expected: all tests pass. The `ApiClientManager` tests test via `getData` and `resetDisabledClients`, not `getClient`.

- [x] **Step 3: Commit**

```bash
git add src/core/api-manager.js
git commit -m "refactor(api-manager): remove unused getClient() accessor"
```

---

## Task 5: Error feedback in `clearCache` and `resetClients`

**Files:**

- Modify: `src/core/ui/settings-ui.js`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

**Interfaces:**

- `clearCache()` and `resetClients()` now catch errors and display them in the `#fm-status` div in red

- [x] **Step 1: Write the failing tests**

In `tests/unit/core/ui/settings-ui.test.js`, inside the `describe('Action buttons')` block (after the last existing action button test), add:

```js
it('should show error in red when clearCache fails', async () => {
    mockCacheManager.clear.mockRejectedValue(new Error('disk full'));
    await settingsUI.render(container);
    container.querySelector('#fm-clearCacheBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const status = container.querySelector('#fm-status');
    expect(status.textContent).toBe('Error: disk full');
    expect(status.style.color).toBe('red');
});

it('should show error in red when resetClients fails', async () => {
    mockDisabledClientsManager.resetAll.mockRejectedValue(new Error('storage unavailable'));
    await settingsUI.render(container);
    container.querySelector('#fm-resetClientsBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const status = container.querySelector('#fm-status');
    expect(status.textContent).toBe('Error: storage unavailable');
    expect(status.style.color).toBe('red');
});
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js
```

Expected: the two new tests fail (unhandled rejections leave status unchanged).

- [x] **Step 3: Add error handling in `src/core/ui/settings-ui.js`**

Replace `clearCache` (lines 250–255) and `resetClients` (lines 257–265) with:

```js
async clearCache() {
    const statusDiv = this.#container.querySelector('#fm-status');
    try {
        await this.#cacheManager.clear();
        statusDiv.textContent = 'Cache cleared.';
        statusDiv.style.color = 'green';
    } catch (err) {
        statusDiv.textContent = `Error: ${err.message}`;
        statusDiv.style.color = 'red';
    }
}

async resetClients() {
    const statusDiv = this.#container.querySelector('#fm-status');
    try {
        const reenabled = await this.#disabledClientsManager.resetAll();
        statusDiv.textContent =
            reenabled.length > 0
                ? `Re-enabled API clients: ${reenabled.join(', ')}`
                : 'No disabled API clients found to re-enable.';
        statusDiv.style.color = 'green';
    } catch (err) {
        statusDiv.textContent = `Error: ${err.message}`;
        statusDiv.style.color = 'red';
    }
}
```

Note: `this.#container` is the already-declared private field; it exists at this point because `clearCache`/`resetClients` are only called after `render()`.

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including the two new ones.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
git commit -m "fix(settings-ui): show error feedback when clearCache or resetClients fails"
```

---

## Task 6: Modal DOM attaches in `open()`, not constructor

**Files:**

- Modify: `src/core/ui/modal.js`
- Modify: `tests/unit/core/ui/modal.test.js`

**Interfaces:**

- `new Modal(title)` builds the overlay in memory but does **not** touch `document.body`
- `open()` appends the overlay to `document.body` then shows it
- `close()` removes it (unchanged — already calls `this.overlay.remove()`)
- `getContentContainer()` works on detached DOM (unchanged)

- [x] **Step 1: Update three existing tests and add one new test**

Three existing tests query `document` immediately after `new Modal(...)` without calling `open()`. They need to call `open()` first. Additionally, add one new test confirming the overlay is absent from the DOM before `open()`.

In `tests/unit/core/ui/modal.test.js`, make the following changes:

**Test "should correctly render the modal and its sub-elements"** (line 26): add `modal.open()` before the `expect` calls:

```js
it('should correctly render the modal and its sub-elements', () => {
    const modal = new Modal('Test Modal');
    modal.open();

    expect(document.querySelector('.fm-modal-overlay')).not.toBeNull();
    expect(document.querySelector('.fm-modal-content')).not.toBeNull();
    expect(document.querySelector('.fm-modal-header')).not.toBeNull();
    expect(document.querySelector('.fm-modal-title')).not.toBeNull();
    expect(document.querySelector('.fm-modal-title').textContent).toBe('Test Modal');
    expect(document.querySelector('.fm-modal-close')).not.toBeNull();
    expect(document.querySelector('.fm-modal-body')).not.toBeNull();
});
```

**Test "should close the modal when clicking the close button"** (line 56): add `modal.open()` before clicking:

```js
it('should close the modal when clicking the close button', () => {
    const modal = new Modal('Test Modal');
    modal.open();
    document.querySelector('.fm-modal-close').click();
    expect(document.querySelector('.fm-modal-overlay')).toBeNull();
});
```

**Test "should have role="dialog" and aria-modal on the content element"** (line 62): add `modal.open()` before querying:

```js
it('should have role="dialog" and aria-modal on the content element', () => {
    const modal = new Modal('A11y Modal');
    modal.open();
    const content = document.querySelector('.fm-modal-content');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    const labelledBy = content.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy);
    expect(titleEl).not.toBeNull();
    expect(titleEl.textContent).toBe('A11y Modal');
});
```

**New test** — add after the "should not register duplicate Escape listeners" test:

```js
it('should not be in the DOM before open() is called', () => {
    new Modal('Pre-open Modal');
    expect(document.querySelector('.fm-modal-overlay')).toBeNull();
});
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/core/ui/modal.test.js
```

Expected: the new test fails (overlay IS in DOM after constructor), and the three updated tests might pass by accident since they now call open() — but the new test definitively fails.

- [x] **Step 3: Move `appendChild` to `open()` in `src/core/ui/modal.js`**

In the constructor (around line 56), remove `document.body.appendChild(this.overlay)`.

In `open()`, add `document.body.appendChild(this.overlay)` before `this.overlay.style.display = 'flex'`:

```js
open() {
    if (this.#escHandler) return;
    document.body.appendChild(this.overlay);
    this.#returnFocus = document.activeElement;
    this.overlay.style.display = 'flex';
    this.overlay.querySelector('.fm-modal-content').focus();
    this.#escHandler = e => {
        if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.#escHandler);
}
```

`close()` already calls `this.overlay.remove()`, so calling `open()` again after `close()` re-appends correctly (the JS object still holds the reference).

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including the new one.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/modal.js tests/unit/core/ui/modal.test.js
git commit -m "fix(modal): defer DOM attachment from constructor to open()"
```

---

## Task 7: Title immutability

**Files:**

- Modify: `src/core/title.js`
- Modify: `src/core/api-clients.js`
- Modify: `tests/unit/core/title.test.js`
- Modify: `tests/unit/core/api-manager.test.js`

**Interfaces:**

- `Title` instances are frozen after construction — field assignment after `new Title(...)` is silently ignored (or throws in strict mode)
- `BaseApiClient.fetch()` returns a new `Title.fromJSON({...titleObj, displayTitle, source})` instead of mutating the returned object

- [x] **Step 1: Write the failing Title freeze test**

In `tests/unit/core/title.test.js`, add a new `describe` block after the existing ones:

```js
describe('immutability', () => {
    it('should not allow mutation of fields after construction', () => {
        const title = new Title({ displayTitle: 'Original', rating: 7.5 });
        title.displayTitle = 'Mutated';
        title.rating = 0;
        expect(title.displayTitle).toBe('Original');
        expect(title.rating).toBe(7.5);
    });
});
```

- [x] **Step 2: Update the api-manager test**

In `tests/unit/core/api-manager.test.js`, find the test "should log on successful data retrieval" (around line 198). The setup currently does:

```js
const title = new Title({ apiTitle: 'Logged Movie' });
title.source = 'test-source';
```

Change it to pass `source` in the constructor:

```js
const title = new Title({ apiTitle: 'Logged Movie', source: 'test-source' });
```

The full updated test block (lines 198–213):

```js
it('should log on successful data retrieval', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const title = new Title({ apiTitle: 'Logged Movie', source: 'test-source' });
    const mockClient = {
        source: 'test-source',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(title),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    await manager.getData('Logged Movie');
    expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from test-source')
    );
});
```

- [x] **Step 3: Run the tests to verify the Title freeze test fails**

```bash
npx vitest run tests/unit/core/title.test.js tests/unit/core/api-manager.test.js
```

Expected: the immutability test fails (mutation currently succeeds). The api-manager test should now pass since we moved source to the constructor.

- [x] **Step 4: Add `Object.freeze(this)` to the `Title` constructor**

In `src/core/title.js`, add `Object.freeze(this)` as the last line of the constructor body, after all property assignments. The end of the constructor becomes:

```js
        this.source = source ?? null;
        this.type = type ?? null;
        Object.freeze(this);
    }
```

- [x] **Step 5: Update the docstring on the `Title` class**

In `src/core/title.js`, change the class docstring from:

```js
/**
 * Immutable-style data class representing a movie or show with its ratings.
```

to:

```js
/**
 * Immutable data class representing a movie or show with its ratings.
```

- [x] **Step 6: Update `BaseApiClient.fetch()` in `src/core/api-clients.js`**

The `fetch` method currently mutates the `titleObj` returned by `getDetails`. Replace the mutation with `Title.fromJSON`:

Current (around lines 163–173):

```js
async fetch(displayTitle) {
    const match = await this.search(displayTitle);
    if (!match) return null;
    if (await this.isDisabled()) return null;
    const titleObj = await this.getDetails(match, displayTitle);
    if (titleObj) {
        titleObj.displayTitle = displayTitle;
        titleObj.source = this.#source;
    }
    return titleObj;
}
```

After:

```js
async fetch(displayTitle) {
    const match = await this.search(displayTitle);
    if (!match) return null;
    if (await this.isDisabled()) return null;
    const titleObj = await this.getDetails(match, displayTitle);
    if (!titleObj) return null;
    return Title.fromJSON({ ...titleObj, displayTitle, source: this.#source });
}
```

`{ ...titleObj }` spreads the own enumerable public fields of the frozen `Title` instance. `Title.fromJSON` runs normalization again — this is a no-op since all values are already typed by the first `Title` construction. The resulting instance is frozen.

Note: `Title` is already imported in `src/core/api-clients.js` (used by `getDetails` implementations).

- [x] **Step 7: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass including the new immutability test.

- [x] **Step 8: Commit**

```bash
git add src/core/title.js src/core/api-clients.js tests/unit/core/title.test.js tests/unit/core/api-manager.test.js
git commit -m "fix(title): enforce immutability with Object.freeze and eliminate post-construction mutation"
```

---

## Task 8: Remove `setConfigData` side effect from `render()`

**Files:**

- Modify: `src/core/ui/settings-ui.js`

**Interfaces:**

- `render(container)` no longer calls `adapter.setConfigData()` — it is purely a DOM-building function
- Callers that need `setConfigData` (WebExtension content script) already call it independently

- [x] **Step 1: Remove the call from `render()`**

In `src/core/ui/settings-ui.js`, find lines 37–38 in `render()`:

```js
const settings = (await this.adapter.storageGetAll()) || {};
this.adapter.setConfigData(settings);
```

Remove the `setConfigData` call, leaving only:

```js
const settings = (await this.adapter.storageGetAll()) || {};
```

- [x] **Step 2: Run tests to verify nothing broke**

```bash
npm test
```

Expected: all tests pass. No existing test asserts that `setConfigData` is called during `render()`, so no test changes are needed. The mock adapter still defines `setConfigData: vi.fn()` — it just won't be called, which is fine.

- [x] **Step 3: Commit**

```bash
git add src/core/ui/settings-ui.js
git commit -m "fix(settings-ui): remove setConfigData side effect from render()"
```

---

## Task 9: Standardize `SettingsUI` access modifiers to `#`

**Files:**

- Modify: `src/core/ui/settings-ui.js`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

**Interfaces:**

- `onSave` remains settable by callers via `ui.onSave = fn` — backed by `#onSave` with a public getter/setter
- All previously `_underscore` methods are now `#private` — not reachable from tests; the one test that called `_validate()` directly is replaced

This is the largest rename in the batch. Touch every occurrence of each renamed symbol.

- [x] **Step 1: Update the test that directly calls `_validate()`**

In `tests/unit/core/ui/settings-ui.test.js`, find the test "should pass input.checked (not input.value) to validate for checkbox fields" (around line 266). It currently calls `ui._validate()`. Replace with `await ui.save()` to exercise the same code path via the public API:

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

    await ui.save();

    expect(validateFn).toHaveBeenCalledWith(true, expect.any(Object));
});
```

- [x] **Step 2: Run the updated test to verify it still passes before touching the source**

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js
```

Expected: all tests pass. (The `_validate` method still exists and the save path calls it.)

- [x] **Step 3: Apply all renames in `src/core/ui/settings-ui.js`**

Apply these changes to the class body:

**Field declarations** — replace the current mixed block:

```js
// Before
#cacheManager;
#disabledClientsManager;
#container = null;
onSave = null;
```

with:

```js
#adapter;
#fields;
#cacheManager;
#disabledClientsManager;
#container = null;
#onSave = null;

get onSave() { return this.#onSave; }
set onSave(fn) { this.#onSave = fn; }
```

**Constructor** — change:

```js
constructor(adapter, fields = CONFIG_FIELDS, cacheManager, disabledClientsManager) {
    this.adapter = adapter;
    this.fields = fields;
    this.#cacheManager = cacheManager;
    this.#disabledClientsManager = disabledClientsManager;
}
```

to:

```js
constructor(adapter, fields = CONFIG_FIELDS, cacheManager, disabledClientsManager) {
    this.#adapter = adapter;
    this.#fields = fields;
    this.#cacheManager = cacheManager;
    this.#disabledClientsManager = disabledClientsManager;
}
```

**Method renames** — apply these four renames everywhere in the file:

| Old name        | New name        |
| --------------- | --------------- |
| `_groupFields`  | `#groupFields`  |
| `_createField`  | `#createField`  |
| `_validate`     | `#validate`     |
| `_injectStyles` | `#injectStyles` |

Each method definition and each call site must be updated. Call sites are:

- `render()` calls `this._injectStyles()` → `this.#injectStyles()`
- `render()` calls `this._groupFields()` → `this.#groupFields()`
- `render()` uses `this.fields` in `_groupFields` body → `this.#fields`
- `render()` calls `this._createField(field, settings)` → `this.#createField(field, settings)`
- `render()` uses `this.adapter.storageGetAll()` → `this.#adapter.storageGetAll()`
- `save()` calls `this._validate()` → `this.#validate()`
- `save()` uses `this.fields` → `this.#fields`
- `save()` uses `this.onSave?.()` → `this.#onSave?.()` (the private field, bypassing getter — either works, use `this.#onSave?.()`)
- `_validate` (now `#validate`) body uses `this.fields` → `this.#fields`
- `_createField` (now `#createField`) body: no reference to adapter or fields
- `_injectStyles` (now `#injectStyles`) body: no reference to adapter or fields

The complete rewritten file:

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
import { CONFIG_FIELDS } from '../config-fields.js';
import { SETTINGS_STYLES } from './styles.js';

export class SettingsUI {
    #adapter;
    #fields;
    #cacheManager;
    #disabledClientsManager;
    #container = null;
    #onSave = null;

    get onSave() {
        return this.#onSave;
    }
    set onSave(fn) {
        this.#onSave = fn;
    }

    constructor(adapter, fields = CONFIG_FIELDS, cacheManager, disabledClientsManager) {
        this.#adapter = adapter;
        this.#fields = fields;
        this.#cacheManager = cacheManager;
        this.#disabledClientsManager = disabledClientsManager;
    }

    async render(container) {
        this.#container = container;
        this.#injectStyles();
        const settings = (await this.#adapter.storageGetAll()) || {};

        container.className = 'fm-settings-container';
        container.replaceChildren();

        const title = document.createElement('h1');
        title.textContent = 'FlixMonkey Settings';
        container.appendChild(title);

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'fm-fields';
        container.appendChild(fieldsContainer);

        const groups = this.#groupFields();
        for (const group of groups) {
            if (group.section) {
                const header = document.createElement('div');
                header.className = 'section-header';
                header.textContent = group.section;
                fieldsContainer.appendChild(header);
            }

            let parent = fieldsContainer;
            if (group.row) {
                const rowDiv = document.createElement('div');
                rowDiv.className = `field-row ${group.row}`;
                fieldsContainer.appendChild(rowDiv);
                parent = rowDiv;
            }

            for (const field of group.fields) {
                parent.appendChild(this.#createField(field, settings));
            }
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const saveBtn = document.createElement('button');
        saveBtn.id = 'fm-saveBtn';
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => this.save();
        actionsDiv.appendChild(saveBtn);

        const clearBtn = document.createElement('button');
        clearBtn.id = 'fm-clearCacheBtn';
        clearBtn.className = 'secondary';
        clearBtn.textContent = 'Clear Cache';
        clearBtn.title = 'Delete all cached ratings so they are fetched again.';
        clearBtn.onclick = () => this.clearCache();
        actionsDiv.appendChild(clearBtn);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'fm-resetClientsBtn';
        resetBtn.className = 'secondary';
        resetBtn.textContent = 'Reset Disabled Clients';
        resetBtn.title = 'Re-enable API providers that were turned off after repeated errors.';
        resetBtn.onclick = () => this.resetClients();
        actionsDiv.appendChild(resetBtn);

        container.appendChild(actionsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'fm-status';
        container.appendChild(statusDiv);
    }

    #groupFields() {
        const groups = [];
        for (const field of this.#fields) {
            const last = groups[groups.length - 1];
            if (field.row && last && last.row === field.row) {
                last.fields.push(field);
            } else {
                groups.push({ row: field.row, section: field.section, fields: [field] });
            }
        }
        return groups;
    }

    #createField(field, settings) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';

        const label = document.createElement('label');
        label.className = 'field-label';
        label.title = field.title || '';
        label.htmlFor = `fm-${field.key}`;

        if (field.labelUrl) {
            const link = document.createElement('a');
            link.href = field.labelUrl;
            link.target = '_blank';
            link.textContent = field.label;
            label.appendChild(link);
        } else {
            label.textContent = field.label;
        }

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.className = 'field-input';
            field.options.forEach(opt => {
                const option = document.createElement('option');
                if (Array.isArray(opt)) {
                    option.value = opt[0];
                    option.textContent = opt[1];
                } else {
                    option.value = opt;
                    option.textContent = opt;
                }
                input.appendChild(option);
            });
            input.value = settings[field.key] !== undefined ? settings[field.key] : field.default;
        } else if (field.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'field-input';
            input.checked = settings[field.key] !== undefined ? settings[field.key] : field.default;
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'field-input';
            input.value = settings[field.key] !== undefined ? settings[field.key] : field.default;
        }

        input.name = field.key;
        input.id = `fm-${field.key}`;

        if (field.labelHidden) {
            label.classList.add('visually-hidden');
        }

        if (field.type === 'checkbox') {
            fieldDiv.appendChild(input);
            fieldDiv.appendChild(label);
        } else {
            fieldDiv.appendChild(label);
            fieldDiv.appendChild(input);
        }

        return fieldDiv;
    }

    #validate() {
        let hasErrors = false;
        const allValues = {};
        this.#fields.forEach(field => {
            const input = this.#container.querySelector(`#fm-${field.key}`);
            if (!input) return;
            allValues[field.key] = input.type === 'checkbox' ? input.checked : input.value;
        });
        this.#fields.forEach(field => {
            const input = this.#container.querySelector(`#fm-${field.key}`);
            if (!input) return;

            const fieldValue = input.type === 'checkbox' ? input.checked : input.value;
            const errorMsg = field.validate ? field.validate(fieldValue, allValues) : null;
            let errorEl = input.parentElement.querySelector('.error-message');

            if (errorMsg) {
                hasErrors = true;
                if (!errorEl) {
                    errorEl = document.createElement('div');
                    errorEl.className = 'error-message';
                    input.parentElement.appendChild(errorEl);
                }
                errorEl.textContent = errorMsg;
                input.classList.add('error');
            } else {
                if (errorEl) {
                    errorEl.remove();
                }
                input.classList.remove('error');
            }
        });
        return !hasErrors;
    }

    async save() {
        const isValid = this.#validate();
        const statusDiv = this.#container.querySelector('#fm-status');

        if (!isValid) {
            statusDiv.textContent = 'Please fix errors before saving.';
            statusDiv.style.color = 'red';
            return;
        }

        const values = {};
        this.#fields.forEach(field => {
            const input = this.#container.querySelector(`#fm-${field.key}`);
            if (field.type === 'checkbox') {
                values[field.key] = input.checked;
            } else {
                values[field.key] = input.value;
            }
        });

        const saveBtn = this.#container.querySelector('#fm-saveBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            await this.#adapter.storageSetMany(values);
            statusDiv.textContent = 'Saved!';
            statusDiv.style.color = 'green';
            await this.#onSave?.();
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    async clearCache() {
        const statusDiv = this.#container.querySelector('#fm-status');
        try {
            await this.#cacheManager.clear();
            statusDiv.textContent = 'Cache cleared.';
            statusDiv.style.color = 'green';
        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
            statusDiv.style.color = 'red';
        }
    }

    async resetClients() {
        const statusDiv = this.#container.querySelector('#fm-status');
        try {
            const reenabled = await this.#disabledClientsManager.resetAll();
            statusDiv.textContent =
                reenabled.length > 0
                    ? `Re-enabled API clients: ${reenabled.join(', ')}`
                    : 'No disabled API clients found to re-enable.';
            statusDiv.style.color = 'green';
        } catch (err) {
            statusDiv.textContent = `Error: ${err.message}`;
            statusDiv.style.color = 'red';
        }
    }

    #injectStyles() {
        if (!document.getElementById('flixmonkey-settings-styles')) {
            const style = document.createElement('style');
            style.id = 'flixmonkey-settings-styles';
            style.textContent = SETTINGS_STYLES;
            document.head.appendChild(style);
        }
    }
}
```

Note: this is the final state of the file inclusive of the Task 5 changes (error handling in `clearCache`/`resetClients`) and the Task 8 change (no `setConfigData` call). If Tasks 5 and 8 have already been applied, only apply the renames; the error-handling bodies and the removed `setConfigData` line should already be in place.

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass. The test that previously called `ui._validate()` now calls `ui.save()` and passes.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
git commit -m "refactor(settings-ui): standardize all members to # private fields"
```

---

## Task 10: Coverage thresholds for branches and statements

**Files:**

- Modify: `vitest.config.js`

**Interfaces:**

- CI now enforces `statements ≥ 97%` and `branches ≥ 90%` in addition to the existing `lines ≥ 90%` and `functions ≥ 90%`

- [x] **Step 1: Add the thresholds in `vitest.config.js`**

Change line 10 from:

```js
thresholds: { lines: 90, functions: 90 },
```

to:

```js
thresholds: { lines: 90, functions: 90, statements: 97, branches: 90 },
```

- [x] **Step 2: Run tests to verify the thresholds pass**

```bash
npm test
```

Expected: all tests pass and coverage report shows no threshold failures. Current measured values are statements 97.2% and branches 91.8%, both above the new floors.

- [x] **Step 3: Commit**

```bash
git add vitest.config.js
git commit -m "chore(tests): add statements and branches coverage thresholds"
```
