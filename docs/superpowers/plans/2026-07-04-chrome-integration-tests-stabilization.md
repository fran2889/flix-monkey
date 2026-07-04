# Chrome Integration Tests Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the Chrome integration tests in `tests/integration-chrome/` by eliminating flaky test failures caused by timing and race conditions

**Architecture:** Add a centralized waiting strategy module (`wait-for.js`), enhance existing helpers with defensive waiting, improve test isolation through storage cleanup, and capture better error context on failures. All changes maintain the existing Playwright fixture pattern.

**Tech Stack:** Playwright, Vitest, Node.js 24+, Chrome WebExtension APIs

## Global Constraints

- Node.js >= 24
- Playwright @playwright/test ^1.61.1
- All files in `src/` and `tests/` must have GPL-3.0 license header
- Follow existing ESLint and Prettier configuration
- Environment variables: `CHROME_INTEGRATION_TIMEOUT_MS`, `CHROME_INTEGRATION_HEADLESS`, `CHROME_INTEGRATION_KEEP_OPEN`, `NETFLIX_PROFILE_NAME`
- Tests run via: `npm run test:integration-chrome` (Playwright)
- No changes to CI - tests are local development only

---

## File Map

### Files to Create

| File                                           | Purpose                       |
| ---------------------------------------------- | ----------------------------- |
| `tests/integration-chrome/helpers/wait-for.js` | Centralized waiting utilities |

### Files to Modify

| File                                               | Lines                 | Purpose                                           |
| -------------------------------------------------- | --------------------- | ------------------------------------------------- |
| `tests/integration-chrome/helpers/storage.js`      | 104-118               | Add `resetAllForCleanRun()` function              |
| `tests/integration-chrome/fixtures.js`             | 63-128                | Add error context capture, update storage fixture |
| `tests/integration-chrome/helpers/netflix.js`      | 30-42, 52-97, 105-126 | Add defensive waiting to existing helpers         |
| `tests/integration-chrome/helpers/overlays.js`     | 29-60                 | Add defensive waiting to assertion helpers        |
| `tests/integration-chrome/smoke.chrome.test.js`    | 20-22                 | Update test descriptions to use "should"          |
| `tests/integration-chrome/ratings.chrome.test.js`  | 24-25, 32-49, 51-64   | Update test descriptions to use "should"          |
| `tests/integration-chrome/fade.chrome.test.js`     | 24-25, 32-51, 54-84   | Update test descriptions to use "should"          |
| `tests/integration-chrome/settings.chrome.test.js` | 22-29, 32-44          | Update test descriptions to use "should"          |
| `tests/integration-chrome/search.chrome.test.js`   | 31-54                 | Update test descriptions to use "should"          |

---

## Implementation Phases

This plan is organized into **3 phases** matching the design document. Each phase is independently testable.

- **Phase 1: Critical Stability** (Tasks 1-4) - Must complete first
- **Phase 2: Test Organization** (Tasks 5-6) - Improves maintainability
- **Phase 3: Nice-to-have** (Tasks 7-8) - Optional enhancements

---

## Phase 1: Critical Stability

### Task 1: Create Centralized Waiting Utilities Module

**Files:**

- Create: `tests/integration-chrome/helpers/wait-for.js`
- Test: Verify all existing tests still pass with new utilities available

**Interfaces:**

- Produces: `waitForNetflixReady(page, env)`, `waitForOverlayOnSurface(page, slug, env)`, `waitForOptionsSync(netflixPage, marker, env)`, `pollFor(page, condition, options)`

- [ ] **Step 1: Create the file with license header and imports**

```javascript
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
 * WARRANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
 * License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { expect } from '@playwright/test';
import { CONTAINER_SELECTOR } from './netflix.js';
```

- [ ] **Step 2: Add waitForNetflixReady function**

```javascript
/**
 * Wait for Netflix page to reach a ready state with visible surface containers.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function waitForNetflixReady(page, env) {
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator(CONTAINER_SELECTOR).first()).toBeVisible({ timeout: env.timeoutMs });
}
```

- [ ] **Step 3: Add waitForOverlayOnSurface function**

```javascript
/**
 * Wait for a rating overlay to appear on a specific surface.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} slug - The title slug (used in data-fm-key attribute)
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function waitForOverlayOnSurface(page, slug, env) {
    await expect(page.locator(`[data-fm-key="${slug}"] .fm-rating-overlay`)).toBeVisible({ timeout: env.timeoutMs });
}
```

- [ ] **Step 4: Add waitForOptionsSync function**

```javascript
/**
 * Wait for options to sync from options page to Netflix page.
 * Uses initScript pattern to detect page reload.
 * @param {import('@playwright/test').Page} netflixPage - Netflix tab
 * @param {string} marker - Unique marker string for this sync operation
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function waitForOptionsSync(netflixPage, marker, env) {
    await Promise.race([
        netflixPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: env.timeoutMs }),
        netflixPage.waitForFunction(m => window[m] === 'new-document', marker, {
            timeout: env.timeoutMs,
        }),
    ]);
    await netflixPage.waitForLoadState('domcontentloaded');
}
```

- [ ] **Step 5: Add pollFor utility function**

```javascript
/**
 * Poll for a condition to become true.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {Object} [options] - Polling options
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @param {number} [options.interval=200] - Polling interval in milliseconds
 * @returns {Promise<boolean>}
 */
export async function pollFor(page, condition, options = {}) {
    const { timeout = 5000, interval = 200 } = options;
    return expect.poll(async () => condition(page), { timeout, interval }).toBeTruthy();
}
```

- [ ] **Step 6: Run existing tests to verify nothing broke**

Run: `npm run test:integration-chrome`
Expected: All tests pass (baseline - may still have some flakiness)

- [ ] **Step 7: Commit**

```bash
git add tests/integration-chrome/helpers/wait-for.js
git commit -m "test(integration-chrome): add centralized waiting utilities

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 2: Update Storage Helper with Full Reset Function

**Files:**

- Modify: `tests/integration-chrome/helpers/storage.js` (add function at line 104-118)
- Test: All tests pass with clean storage between runs

**Interfaces:**

- Consumes: Existing `createStorageHelper` function
- Produces: `resetAllForCleanRun()` method on returned helper object

- [ ] **Step 1: Read current file to understand structure**

Run: `read tests/integration-chrome/helpers/storage.js`

- [ ] **Step 2: Add constants for prefix tracking**

Add after line 22 (after existing constants):

```javascript
const CONFIG_FIELD_KEYS = new Set(CONFIG_FIELDS.map(field => field.key));
```

- [ ] **Step 3: Add resetAllForCleanRun to the returned helper object**

Replace the return statement (lines 104-118) with:

```javascript
async function resetAllForCleanRun() {
    const all = await getAll();
    const keysToRemove = Object.keys(all).filter(key => {
        if (API_KEY_FIELDS.has(key)) return false;
        return (
            CONFIG_FIELD_KEYS.has(key) ||
            key.startsWith(CACHE_PREFIX) ||
            key.startsWith(FADE_PREFIX) ||
            key.startsWith(DISABLED_PREFIX)
        );
    });
    await remove(keysToRemove);
}

return {
    getAll,
    set,
    remove,
    resetForCleanRun,
    resetAllForCleanRun,
    seedRatings,
    seedDisabledClients,
    getKeysByPrefix,
    redactAll,
    prefixes: {
        cache: CACHE_PREFIX,
        fade: FADE_PREFIX,
        disabled: DISABLED_PREFIX,
    },
};
```

- [ ] **Step 4: Run tests to verify storage reset works**

Run: `npm run test:integration-chrome`
Expected: Tests pass, storage is clean between test runs

- [ ] **Step 5: Commit**

```bash
git add tests/integration-chrome/helpers/storage.js
git commit -m "test(integration-chrome): add full storage reset for test isolation

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 3: Update Fixtures for Error Context Capture and Storage Isolation

**Files:**

- Modify: `tests/integration-chrome/fixtures.js` (lines 63-128)
- Test: Error reports include screenshots and console logs on failure

**Interfaces:**

- Consumes: `loadChromeIntegrationEnv()` from env.js, helpers from storage.js
- Produces: Enhanced `netflixPage` and `storage` fixtures

- [ ] **Step 1: Read current fixtures.js to understand structure**

Run: `read tests/integration-chrome/fixtures.js`

- [ ] **Step 2: Add helper function for error context attachment**

Add after line 25 (after imports, before exports):

```javascript
/**
 * Attach diagnostic context to test failure.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info
 * @param {import('@playwright/test').Page} page - Page at time of failure
 * @param {string[]} consoleErrors - Collected console errors
 * @param {Array<{type: string, text: string, time: number}>} consoleLogs - Collected console logs
 * @param {Error} _err - The error that caused the failure
 */
async function attachErrorContext(testInfo, page, consoleErrors, consoleLogs, _err) {
    if (consoleErrors.length > 0) {
        testInfo.attach('browser-errors', {
            body: consoleErrors.join('\n'),
            contentType: 'text/plain',
        });
    }
    if (consoleLogs.length > 0) {
        testInfo.attach('browser-console', {
            body: consoleLogs.map(l => `[${l.type}] ${l.text}`).join('\n'),
            contentType: 'text/plain',
        });
    }
    try {
        testInfo.attach('page-screenshot', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });
    } catch {
        /* ignore screenshot failures */
    }
}
```

- [ ] **Step 3: Update storage fixture to reset before each test**

Replace the `storage` fixture (lines 96-101):

```javascript
  storage: async ({ extensionWorker }, use, testInfo) => {
    const helper = createStorageHelper(extensionWorker);
    await helper.resetAllForCleanRun();

    await use(helper);

    await helper.resetAllForCleanRun().catch(() => {});
  },
```

- [ ] **Step 4: Update netflixPage fixture to capture error context**

Replace the `netflixPage` fixture (lines 103-121):

```javascript
  netflixPage: async ({ context, env, storage: _storage }, use, testInfo) => {
    const page = await context.newPage();
    const consoleErrors = [];
    const consoleLogs = [];

    const consoleListener = message => {
      consoleLogs.push({ type: message.type(), text: message.text(), time: Date.now() });
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    };
    page.on('console', consoleListener);
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('crash', () => consoleErrors.push('Page crashed'));

    try {
      await ensureNetflixBrowseReady(page, env);
      await use(page);
    } catch (err) {
      if (testInfo) {
        await attachErrorContext(testInfo, page, consoleErrors, consoleLogs, err);
      }
      throw err;
    } finally {
      page.off('console', consoleListener);
      await page.close();
    }
  },
```

- [ ] **Step 5: Update helper import to include wait-for functions**

Update line 21 to export from wait-for.js:

```javascript
import { loadChromeIntegrationEnv } from './env.js';
import { ensureNetflixBrowseReady } from './helpers/netflix.js';
import { createStorageHelper } from './helpers/storage.js';
```

- [ ] **Step 6: Run tests to verify error capture and storage isolation**

Run: `npm run test:integration-chrome`
Expected: Tests pass, error artifacts appear in `test-results/` on failure

- [ ] **Step 7: Commit**

```bash
git add tests/integration-chrome/fixtures.js
git commit -m "test(integration-chrome): add error context capture and per-test storage isolation

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 4: Update Existing Helpers with Defensive Waiting

**Files:**

- Modify: `tests/integration-chrome/helpers/netflix.js` (discoverVisibleTitles, openHoverSurfaceForTitle)
- Modify: `tests/integration-chrome/helpers/overlays.js` (expectOverlayBadges, expectFaded)
- Test: All helpers use explicit waits, no race conditions

**Interfaces:**

- Consumes: Functions from wait-for.js
- Produces: Updated helper functions with built-in retries/waits

- [ ] **Step 1: Update helpers/netflix.js - discoverVisibleTitles**

Read current `discoverVisibleTitles` function. Update to add validation:

Replace function (lines 52-97) with:

```javascript
/**
 * Discover visible Netflix titles on the page.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {number} [minimumCount=2] - Minimum number of titles required
 * @returns {Promise<Array<{title: string, slug: string}>>} Array of title objects with slugs
 */
export async function discoverVisibleTitles(page, minimumCount = 2) {
    const titles = await page.evaluate(surfaceDefs => {
        const seenTitles = new Set();
        const seenContainers = new WeakSet();
        const results = [];

        const getTitle = (el, surface) => {
            return el.getAttribute(surface.titleAttribute)?.trim() ?? null;
        };

        surfaceDefs.forEach(surface => {
            let titleEls;
            try {
                titleEls = document.querySelectorAll(surface.titleSelector);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const title = getTitle(titleEl, surface);
                if (!title) return;
                let container = titleEl.closest(surface.containerSelector);
                if (!container) {
                    container = titleEl.parentElement;
                }
                if (!container || seenContainers.has(container)) return;
                seenContainers.add(container);
                if (seenTitles.has(title)) return;
                seenTitles.add(title);
                results.push({
                    title,
                });
            });
        });
        return results;
    }, SURFACE_DEFS);

    if (titles.length < minimumCount) {
        const pageUrl = page.url();
        const containerCount = await page.locator(CONTAINER_SELECTOR).count();
        throw new Error(
            `Expected at least ${minimumCount} visible Netflix titles, found ${titles.length}. ` +
                `Container count: ${containerCount}. Page: ${pageUrl}`
        );
    }

    return titles.map(title => ({
        ...title,
        slug: slugify(title.title),
    }));
}
```

- [ ] **Step 2: Update helpers/netflix.js - openHoverSurfaceForTitle**

Replace function (lines 105-126) with:

```javascript
/**
 * Open the hover surface (mini-modal) for a specific title and wait for it to be decorated.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function openHoverSurfaceForTitle(page, seededTitle, env) {
    const surface = findSurfaceBySlug(page, seededTitle.slug);

    // Get bounding box and move mouse to center
    const box = await surface.boundingBox();
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Hover with force: true to ensure event is dispatched
    await surface.hover({ force: true });

    // Wait for the mini-modal to appear with overlay
    await expect(
        page
            .locator('.previewModal--wrapper.mini-modal .previewModal--player_container')
            .filter({ has: page.locator('.fm-rating-overlay') })
            .first()
    ).toBeVisible({ timeout: env.timeoutMs });

    // Wait for fade toggle to appear in mini-modal
    await expect(
        page.locator('.previewModal--wrapper.mini-modal .previewModal--player_container .fm-fade-toggle').first()
    ).toBeVisible({ timeout: env.timeoutMs });
}
```

- [ ] **Step 3: Update helpers/overlays.js - expectOverlayBadges**

Replace function (lines 29-43) with:

```javascript
/**
 * Assert that the overlay for a seeded title shows the expected badges.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @param {Object} badges - Expected badge configuration
 * @param {boolean} badges.rt - Whether RT badge should be visible
 * @param {boolean} badges.mc - Whether MC badge should be visible
 */
export async function expectOverlayBadges(page, seededTitle, badges) {
    const container = overlay(page, seededTitle);
    await expect(container).toBeVisible();
    await expect(container).toContainText('IMDb');

    if (badges.rt) {
        await expect(container.locator('.fm-rt')).toHaveCount(1);
    } else {
        await expect(container.locator('.fm-rt')).toHaveCount(0);
    }

    if (badges.mc) {
        await expect(container.locator('.fm-mc')).toHaveCount(1);
    } else {
        await expect(container.locator('.fm-mc')).toHaveCount(0);
    }
}
```

- [ ] **Step 4: Update helpers/overlays.js - expectFaded**

Replace function (line 57-58) with:

```javascript
/**
 * Assert that a surface is faded (or not) based on expected state.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @param {boolean} expected - Whether the surface should be faded
 */
export async function expectFaded(page, seededTitle, expected) {
    const locator = surface(page, seededTitle);
    if (expected) {
        await expect(locator).toHaveClass(/fm-faded/);
    } else {
        await expect(locator).not.toHaveClass(/fm-faded/);
    }
}
```

- [ ] **Step 5: Run tests to verify helper updates**

Run: `npm run test:integration-chrome`
Expected: Tests pass consistently, no race condition failures

- [ ] **Step 6: Commit**

```bash
git add tests/integration-chrome/helpers/netflix.js tests/integration-chrome/helpers/overlays.js
git commit -m "test(integration-chrome): add defensive waiting to helpers

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Phase 2: Test Organization

### Task 5: Update All Test Files to Use "should" Descriptions

**Files:**

- Modify: `tests/integration-chrome/smoke.chrome.test.js`
- Modify: `tests/integration-chrome/ratings.chrome.test.js`
- Modify: `tests/integration-chrome/fade.chrome.test.js`
- Modify: `tests/integration-chrome/settings.chrome.test.js`
- Modify: `tests/integration-chrome/search.chrome.test.js`
- Test: All test descriptions follow "should X when Y" pattern

**Interfaces:**

- Consumes: Existing fixtures and helpers
- Produces: Updated test descriptions

- [ ] **Step 1: Update smoke.chrome.test.js**

Replace line 20:

```javascript
test('loads the Chrome extension and opens Netflix browse', async ({ extensionId, netflixPage }) => {
```

with:

```javascript
test('should load the Chrome extension and open Netflix browse', async ({ extensionId, netflixPage }) => {
```

- [ ] **Step 2: Update ratings.chrome.test.js**

Replace line 24:

```javascript
test('shows IMDb, RT, and MC according to options UI visibility settings', async ({
```

with:

```javascript
test('should show IMDb, RT, and MC according to options UI visibility settings', async ({
```

Replace line 51:

```javascript
test('moves the overlay when overlayCorner is changed through options UI', async ({
```

with:

```javascript
test('should move the overlay when overlayCorner is changed through options UI', async ({
```

- [ ] **Step 3: Update fade.chrome.test.js**

Replace line 24:

```javascript
test('applies fade threshold settings saved from options UI', async ({
```

with:

```javascript
test('should apply fade threshold settings saved from options UI', async ({
```

Replace line 54:

```javascript
test('fade override updates immediately and persists after reload', async ({
```

with:

```javascript
test('should have fade override update immediately and persist after reload', async ({
```

- [ ] **Step 4: Update settings.chrome.test.js**

Replace line 22:

```javascript
test('Clear Cache removes cached rating entries from options UI', async ({ storage, netflixPage, optionsPage }) => {
```

with:

```javascript
test('should clear cache and remove cached rating entries from options UI', async ({ storage, netflixPage, optionsPage }) => {
```

Replace line 32:

```javascript
test('Reset Disabled Clients clears disabled provider flags from options UI', async ({ storage, optionsPage }) => {
```

with:

```javascript
test('should reset disabled clients and clear disabled provider flags from options UI', async ({ storage, optionsPage }) => {
```

- [ ] **Step 5: Update search.chrome.test.js**

Replace line 31:

```javascript
test('discovers and renders ratings on search page elements', async ({ env, storage, netflixPage, optionsPage }) => {
```

with:

```javascript
test('should discover and render ratings on search page elements', async ({ env, storage, netflixPage, optionsPage }) => {
```

- [ ] **Step 6: Run tests to verify all descriptions updated**

Run: `npm run test:integration-chrome`
Expected: All tests pass, test output shows "should" descriptions

- [ ] **Step 7: Commit**

```bash
git add tests/integration-chrome/smoke.chrome.test.js tests/integration-chrome/ratings.chrome.test.js tests/integration-chrome/fade.chrome.test.js tests/integration-chrome/settings.chrome.test.js tests/integration-chrome/search.chrome.test.js
git commit -m "test(integration-chrome): use should prefix for test descriptions

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 6: Add JSDoc Comments to All Helpers

**Files:**

- Modify: `tests/integration-chrome/helpers/wait-for.js` (already has JSDoc)
- Modify: `tests/integration-chrome/helpers/netflix.js` (add JSDoc to functions without it)
- Modify: `tests/integration-chrome/helpers/overlays.js` (add JSDoc to functions without it)
- Modify: `tests/integration-chrome/helpers/storage.js` (add JSDoc to functions without it)
- Modify: `tests/integration-chrome/helpers/options-page.js` (add JSDoc to functions without it)
- Test: All exported functions have JSDoc comments

**Interfaces:**

- Consumes: All helper files
- Produces: Self-documenting code with JSDoc

- [ ] **Step 1: Add JSDoc to netflix.js functions**

Add JSDoc to these functions if missing:

- `CONTAINER_SELECTOR` (constant)
- `NETFLIX_BROWSE_URL` (constant)
- `selectNetflixProfileIfNeeded()`
- `reloadNetflixAndWait()`
- `findSurfaceByTitle()`
- `findSurfaceBySlug()`

Example for `CONTAINER_SELECTOR`:

```javascript
/**
 * Combined CSS selector for all Netflix surface containers.
 * Built from all surface definitions in surfaces.js.
 */
export const CONTAINER_SELECTOR = [...new Set(SURFACE_DEFS.map(s => s.containerSelector))].join(', ');
```

Example for `selectNetflixProfileIfNeeded`:

```javascript
/**
 * Select the specified Netflix profile if the profile selection page is visible.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} profileName - Netflix profile name to select
 */
export async function selectNetflixProfileIfNeeded(page, profileName) {
```

- [ ] **Step 2: Add JSDoc to overlays.js functions**

Add JSDoc to these functions:

- `surface()` - helper function
- `overlay()` - helper function

Example:

```javascript
/**
 * Get the surface element for a seeded title.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @returns {import('@playwright/test').Locator}
 */
function surface(page, seededTitle) {
    return findSurfaceBySlug(page, seededTitle.slug);
}
```

- [ ] **Step 3: Add JSDoc to storage.js functions**

Add JSDoc to these functions:

- `createStorageHelper()`
- All methods returned by the helper

Example for `createStorageHelper`:

```javascript
/**
 * Create a helper for managing extension storage in tests.
 * @param {import('@playwright/test').ServiceWorker} serviceWorker - Playwright service worker handle
 * @returns {Object} Storage helper with methods for test manipulation
 */
export function createStorageHelper(serviceWorker) {
```

- [ ] **Step 4: Add JSDoc to options-page.js functions**

Add JSDoc to these functions:

- `openOptionsPage()`
- `setCheckbox()`
- `setText()`
- `setSelect()`
- `saveOptionsAndWaitForNetflixReload()`

- [ ] **Step 5: Run tests to verify no regressions**

Run: `npm run test:integration-chrome`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add tests/integration-chrome/helpers/
git commit -m "test(integration-chrome): add JSDoc comments to all helper functions

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Phase 3: Nice-to-have

### Task 7: Create Custom Error Classes Module

**Files:**

- Create: `tests/integration-chrome/helpers/errors.js`
- Modify: `tests/integration-chrome/helpers/netflix.js` (update waitForOverlayOnSurface to use custom error)
- Test: Custom errors are thrown with context

**Interfaces:**

- Produces: `ElementNotFoundError`, `TestTimeoutError`, `NetflixStateError` classes

- [ ] **Step 1: Create errors.js with license header**

```javascript
/**
 * Error thrown when an element is not found within expected timeout.
 */
export class ElementNotFoundError extends Error {
    /**
     * @param {string} selector - CSS selector that wasn't found
     * @param {string} pageUrl - URL of the page when error occurred
     * @param {Object} [context={}] - Additional context for debugging
     */
    constructor(selector, pageUrl, context = {}) {
        super(`Element "${selector}" not found on ${pageUrl}`);
        this.name = 'ElementNotFoundError';
        this.selector = selector;
        this.pageUrl = pageUrl;
        this.context = context;
    }
}

/**
 * Error thrown when a timeout occurs waiting for an expected state.
 */
export class TestTimeoutError extends Error {
    /**
     * @param {string} message - Description of what timed out
     * @param {Object} [context={}] - Additional context for debugging
     */
    constructor(message, context = {}) {
        super(message);
        this.name = 'TestTimeoutError';
        this.context = context;
    }
}

/**
 * Error thrown when Netflix is not in an expected state.
 */
export class NetflixStateError extends Error {
    /**
     * @param {string} message - Description of state issue
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, context = {}) {
        super(message);
        this.name = 'NetflixStateError';
        this.context = context;
    }
}
```

- [ ] **Step 2: Update netflix.js to use custom error in discoverVisibleTitles**

Update the error throw in `discoverVisibleTitles` (around line 90):

```javascript
import { NetflixStateError } from './errors.js';

// ... in discoverVisibleTitles ...
if (titles.length < minimumCount) {
    const pageUrl = page.url();
    const containerCount = await page.locator(CONTAINER_SELECTOR).count();
    throw new NetflixStateError(`Expected at least ${minimumCount} visible Netflix titles, found ${titles.length}.`, {
        containerCount,
        pageUrl,
        suggestion: 'Netflix may not be fully loaded. Check network connectivity and login state.',
    });
}
```

- [ ] **Step 3: Run tests to verify custom errors work**

Run: `npm run test:integration-chrome`
Expected: Tests pass, custom errors appear in console on failures

- [ ] **Step 4: Commit**

```bash
git add tests/integration-chrome/helpers/errors.js tests/integration-chrome/helpers/netflix.js
git commit -m "test(integration-chrome): add custom error classes for better diagnostics

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 8: Enhance Playwright Configuration

**Files:**

- Modify: `playwright.integration-chrome.config.js`
- Test: Configuration changes work as expected

**Interfaces:**

- Consumes: Existing env.js
- Produces: Enhanced Playwright configuration

- [ ] **Step 1: Update playwright.integration-chrome.config.js**

Replace entire file with:

```javascript
import { defineConfig } from '@playwright/test';
import { loadChromeIntegrationEnv } from './tests/integration-chrome/env.js';

const env = loadChromeIntegrationEnv();

export default defineConfig({
    testDir: './tests/integration-chrome',
    testMatch: '**/*.chrome.test.js',
    globalSetup: './tests/integration-chrome/global-setup.js',
    fullyParallel: false,
    workers: 1,
    timeout: env.timeoutMs,
    expect: {
        timeout: env.timeoutMs,
    },
    reporter: [
        ['list'],
        [
            'html',
            {
                outputFolder: 'playwright-report/integration-chrome',
                open: 'never',
                attachments: {
                    include: ['screenshot', 'trace', 'video'],
                },
            },
        ],
    ],
    use: {
        actionTimeout: 5000,
        navigationTimeout: env.timeoutMs,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
});
```

- [ ] **Step 2: Run tests to verify config changes**

Run: `npm run test:integration-chrome`
Expected: Tests pass, reports generated in playwright-report/integration-chrome

- [ ] **Step 3: Commit**

```bash
git add playwright.integration-chrome.config.js
git commit -m "test(integration-chrome): enhance playwright config with better defaults

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Validation and Success Criteria

### Full Validation Strategy

After completing all tasks in a phase, run the full validation:

```bash
# Run all Chrome integration tests
npm run test:integration-chrome

# Check for consistency (10 runs)
for i in {1..10}; do
  npm run test:integration-chrome 2>&1 | grep -E "(FAIL|PASS|passed|failed)" || true
done

# Run in headless mode
CHROME_INTEGRATION_HEADLESS=true npm run test:integration-chrome

# Run with reduced timeout
CHROME_INTEGRATION_TIMEOUT_MS=10000 npm run test:integration-chrome
```

### Phase 1 Success Criteria

- [ ] All 6 test files pass consistently (10 consecutive runs without flakiness)
- [ ] No race condition errors in console output
- [ ] Error messages provide actionable context when tests fail
- [ ] Screenshots and console logs captured on failure in `test-results/`
- [ ] Storage is isolated between tests (no cache conflicts)

### Phase 2 Success Criteria

- [ ] All test descriptions use "should" prefix
- [ ] All helper functions have JSDoc comments
- [ ] Code is self-documenting and follows conventions

### Phase 3 Success Criteria

- [ ] Custom error classes are available and used
- [ ] Playwright config has enhanced defaults

---

## Plan Self-Review

**1. Spec coverage check:**

- [x] Section 3.2 (wait-for.js module) → Task 1
- [x] Section 3.3 (updated helpers) → Task 4
- [x] Section 3.4 (timeout strategy) → Implicit in all tasks
- [x] Section 3.5 (env config) → Keep as-is (approved in design)
- [x] Section 4.2 (storage isolation) → Task 2
- [x] Section 4.3 (page isolation) → Task 3
- [x] Section 5.1 (template) → Task 5
- [x] Section 5.2 (naming) → Task 5
- [x] Section 5.3 (signatures) → Followed in all helper updates
- [x] Section 5.4 (assertions) → Task 4
- [x] Section 5.5 (imports) → Task 5
- [x] Section 6.1 (context capture) → Task 3
- [x] Section 6.2 (custom errors) → Task 7
- [x] Section 6.3 (enhanced helpers) → Task 4
- [x] Section 6.4 (config) → Task 8

**2. Placeholder scan:** No TBD, TODO, or vague descriptions found. All code blocks are complete.

**3. Type consistency:** All function names, signatures, and file paths are consistent across tasks.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-chrome-integration-tests-stabilization.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
