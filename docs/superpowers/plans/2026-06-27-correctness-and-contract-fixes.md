# Correctness & Contract Fixes 1–4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four independent correctness and contract issues across overlay rendering, the API client disabled gate, and the platform storage adapter.

**Architecture:** Each issue is a self-contained change landing in its own PR. Issues 2 and 3 both touch `BaseApiClient.fetch()` — apply PR 2 before PR 3 so the mid-fetch check is added after the initial check is already gone.

**Tech Stack:** Vanilla JS ES modules, Vitest, webextension-polyfill.

## Global Constraints

- No new dependencies.
- All tests run via `npm run test:unit` (or `npx vitest run <file>` for single-file runs).
- Every PR passes `npm test` (unit + UI) before merge.
- Commit messages follow conventional commits: `fix(scope): description`.

---

## PR 1 — Unified visual-settings redecoration

### Task 1: `OverlayRenderer.clearAllOverlays()`

**Files:**

- Modify: `src/core/overlay.js`
- Test: `tests/unit/core/overlay.test.js`

**Interfaces:**

- Produces: `OverlayRenderer.clearAllOverlays(): void` — removes every `.fm-rating-overlay` element from the live document.

- [ ] **Step 1: Write the failing test**

Add inside the `describe('OverlayRenderer', ...)` block in `tests/unit/core/overlay.test.js`:

```js
it('should remove all overlay elements from the document', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    document.body.innerHTML =
        '<div class="fm-rating-overlay"></div>' + '<div class="fm-rating-overlay"></div>' + '<div class="other"></div>';
    renderer.clearAllOverlays();
    expect(document.querySelectorAll('.fm-rating-overlay')).toHaveLength(0);
    expect(document.querySelectorAll('.other')).toHaveLength(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/core/overlay.test.js
```

Expected: FAIL — `renderer.clearAllOverlays is not a function`.

- [ ] **Step 3: Add `clearAllOverlays()` to `OverlayRenderer`**

In `src/core/overlay.js`, add after `injectStyles()`:

```js
clearAllOverlays() {
    document.querySelectorAll(`.${this.#OVERLAY_CLASS}`).forEach(el => el.remove());
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/core/overlay.test.js
```

Expected: all overlay tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/overlay.js tests/unit/core/overlay.test.js
git commit -m "fix(overlay): add clearAllOverlays method"
```

---

### Task 2: `redecorate()` and unified visual-settings handler

**Files:**

- Modify: `src/core/app.js`
- Modify: `src/targets/extension/content.js`
- Test: `tests/unit/targets/content.test.js`

**Interfaces:**

- Consumes: `OverlayRenderer.clearAllOverlays()` from Task 1.
- Produces: `FlixMonkeyApp.redecorate(): void`; `startApp()` handle gains `redecorate`, loses `refreshStyles`.

- [ ] **Step 1: Update content.test.js to use `redecorate`**

In `tests/unit/targets/content.test.js`:

Replace `refreshStyles: vi.fn()` with `redecorate: vi.fn()` in the `mockAppHandle` object inside `beforeEach`:

```js
mockAppHandle = {
    redecorate: vi.fn(),
    clearCache: vi.fn(),
    disconnect: vi.fn(),
};
```

Replace the two existing visual-settings tests and add four more:

```js
it('should call redecorate when overlayCorner changes', () => {
    onChangedListener({ overlayCorner: { newValue: 'bottom-left' } });
    expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
});

it('should call redecorate when showRtRating changes', () => {
    onChangedListener({ showRtRating: { newValue: true } });
    expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
});

it('should call redecorate when showMcRating changes', () => {
    onChangedListener({ showMcRating: { newValue: false } });
    expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
});

it('should call redecorate when enableFadeUnderRating changes', () => {
    onChangedListener({ enableFadeUnderRating: { newValue: true } });
    expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
});

it('should call redecorate when fadeRatingThreshold changes', () => {
    onChangedListener({ fadeRatingThreshold: { newValue: 50 } });
    expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
});

it('should not call redecorate when an unrelated key changes', () => {
    onChangedListener({ someOtherKey: { newValue: 'value' } });
    expect(mockAppHandle.redecorate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/targets/content.test.js
```

Expected: FAIL — `redecorate` tests fail because `content.js` still calls `refreshStyles`.

- [ ] **Step 3: Add `redecorate()` to `FlixMonkeyApp` in `src/core/app.js`**

Add after the `#decorateContainer` method (before `decorateRoot`):

```js
redecorate() {
    this.#renderer.injectStyles();
    this.#renderer.clearAllOverlays();
    this.decorateRoot(document);
}
```

- [ ] **Step 4: Update `startApp()` in `src/core/app.js`**

Replace:

```js
refreshStyles: () => renderer.injectStyles(),
```

With:

```js
redecorate: () => app.redecorate(),
```

- [ ] **Step 5: Update `content.js`**

Replace the entire `storage.onChanged.addListener` block (lines 32–39) in `src/targets/extension/content.js` with:

```js
const VISUAL_SETTINGS = new Set([
    'overlayCorner',
    'showRtRating',
    'showMcRating',
    'enableFadeUnderRating',
    'fadeRatingThreshold',
]);

browser.storage.onChanged.addListener(changes => {
    Object.entries(changes).forEach(([k, v]) => {
        stored[k] = v.newValue;
    });
    if (Object.keys(changes).some(k => VISUAL_SETTINGS.has(k))) {
        appRef.app?.redecorate();
    }
});
```

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/app.js src/targets/extension/content.js tests/unit/targets/content.test.js
git commit -m "fix(content): redecorate on any visual setting change"
```

---

## PR 2 — Single-ownership disabled gate

> Applies to `BaseApiClient.fetch()`. No new tests; the stale test that relied on the removed behaviour is deleted here.

### Task 3: Remove initial `isDisabled()` from `fetch()`

**Files:**

- Modify: `src/core/api-clients.js`
- Modify: `tests/unit/core/api-clients.test.js`

- [ ] **Step 1: Delete the stale test**

Remove the following test from `tests/unit/core/api-clients.test.js` (currently in `describe('BaseApiClient (via XmdbApiClient)', ...)`):

```js
it('should return null if client is disabled', async () => {
    const client = new XmdbApiClient({ isDisabled: vi.fn().mockResolvedValue(true) }, {}, {}, createMockLogger());
    const result = await client.fetch('Movie 1');
    expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify the suite is still green**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

Expected: PASS (deleted test is gone, remaining tests unaffected).

- [ ] **Step 3: Remove `isDisabled()` check from `fetch()` and add JSDoc note**

In `src/core/api-clients.js`, update `BaseApiClient.fetch()`:

Replace:

```js
async fetch(displayTitle) {
    if (await this.isDisabled()) return null;
    const match = await this.search(displayTitle);
```

With:

```js
/**
 * Fetches ratings for a Netflix title by running the search → details pipeline.
 * Callers must gate through {@link getStatus} before invoking.
 *
 * @param {string} displayTitle - Title as shown on the Netflix UI.
 * @returns {Promise<Title|null>} Hydrated `Title` with ratings, or `null` if the
 *   title was not found.
 */
async fetch(displayTitle) {
    const match = await this.search(displayTitle);
```

(Keep the rest of the method body unchanged.)

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "fix(api-clients): remove redundant isDisabled check from fetch"
```

---

## PR 3 — Mid-fetch disable guard

> Applies after PR 2. Adds the single `isDisabled()` check back inside `fetch()`, but positioned between `search()` and `getDetails()`.

### Task 4: Add mid-fetch `isDisabled()` check

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

- [ ] **Step 1: Write the failing test**

Add inside `describe('BaseApiClient (via XmdbApiClient)', ...)` in `tests/unit/core/api-clients.test.js`:

```js
it('should abort and return null if disabled between search and getDetails', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            results: [{ type: 'title', id: 'tt123', title: 'Test' }],
        }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(true) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.fetch('Test Movie');
    expect(result).toBeNull();
    // search httpFetch ran; getDetails httpFetch did not
    expect(mockAdapter.httpFetch).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

Expected: FAIL — `fetch()` calls `getDetails()`, causing a second `httpFetch` call, and `httpFetch` returns search data rather than details data causing an error or wrong result.

- [ ] **Step 3: Add the mid-fetch check to `fetch()` and update `disable()` JSDoc**

In `src/core/api-clients.js`, update `BaseApiClient.fetch()`:

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

Also update the `disable()` JSDoc to add a `@note` after the `@returns` line:

```js
/**
 * Disables this client, purges its queued requests, and logs a warning.
 *
 * @param {number} [durationMs=CLIENT_DISABLE_DURATION] - Lockout duration in milliseconds.
 * @returns {Promise<void>}
 * @note Any HTTP request already executing at the network level when `disable()` is called
 *   cannot be aborted and may complete, but its result is discarded by the caller.
 */
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "fix(api-clients): guard against disable between search and getDetails"
```

---

## PR 4 — `storageGet` contract alignment

### Task 5: Align `PlatformAdapter` JSDoc and add missing userscript test

**Files:**

- Modify: `src/platform/adapter.js`
- Test: `tests/unit/platform/userscript.test.js`

**Note:** `tests/unit/platform/webextension.test.js` already has a "storageGet should return null if key is not found" test — no changes needed there.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/platform/userscript.test.js` inside `describe('UserscriptAdapter', ...)`:

```js
it('storageGet should return null if key is not found', async () => {
    GM_getValue.mockReturnValue(undefined);
    const result = await adapter.storageGet('nonexistent');
    expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it passes immediately**

```bash
npx vitest run tests/unit/platform/userscript.test.js
```

Expected: PASS — `GM_getValue` returns `undefined`, `?? null` converts it to `null`. This test documents existing correct behaviour.

- [ ] **Step 3: Update `adapter.js` JSDoc**

In `src/platform/adapter.js`, update the `storageGet` JSDoc:

Replace:

```js
 * @returns {Promise<string|undefined>} The stored value, or `undefined` if the key does not exist.
```

With:

```js
 * @returns {Promise<string|null>} The stored value, or `null` if the key does not exist.
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/adapter.js tests/unit/platform/userscript.test.js
git commit -m "fix(platform): align storageGet contract to return null for missing keys"
```
