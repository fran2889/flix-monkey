# Chrome Integration Tests Stabilization Design

**Date:** 2026-07-04  
**Status:** Approved  
**Author:** Mistral Vibe (with Fran)  
**Scope:** `tests/integration-chrome/`

---

## 1. Overview

### 1.1 Purpose

This document specifies the design for stabilizing the Chrome integration tests in the FlixMonkey project. The tests use Playwright to validate the Chrome extension in a real browser environment against the live Netflix site.

### 1.2 Goals

- **Primary:** Eliminate flaky test failures caused by timing and race conditions
- **Secondary:** Improve test maintainability through consistent conventions
- **Tertiary:** Enhance error diagnostics to reduce debugging time

### 1.3 Non-Goals

- Running tests in CI (tests are local development only)
- Adding new test coverage (focus is on stabilizing existing tests)
- Refactoring the extension code itself
- Changing the test runner (Playwright remains the runner)

### 1.4 Current State

The `tests/integration-chrome/` directory contains 6 test files and 5 helper modules using Playwright's fixture system. Recent issues include:

- Double reload race conditions (fixed in commit fee712d)
- Timing issues with overlay visibility
- Exact rating value assertions (fixed in commit 9a1f266)
- Unreliable selectors (improved by using `data-fm-key`)
- Hover action timing for mini-modal

---

## 2. Architecture and Structure

### 2.1 Directory Structure

```
tests/integration-chrome/
├── env.js                      # Environment configuration loading
├── fixtures.js                 # Playwright test fixtures
├── global-setup.js             # Pre-test global setup
├── playwright.integration-chrome.config.js  # Playwright configuration
├── helpers/
│   ├── netflix.js              # Netflix page interactions
│   ├── options-page.js         # Options page interactions
│   ├── overlays.js             # Overlay assertion helpers
│   ├── storage.js              # Extension storage helpers
│   ├── test-data.js            # Test data constants
│   └── wait-for.js             # NEW: Centralized waiting strategies
├── smoke.chrome.test.js        # Basic connectivity test
├── ratings.chrome.test.js      # Rating display tests
├── fade.chrome.test.js         # Fade functionality tests
├── settings.chrome.test.js     # Settings UI tests
├── search.chrome.test.js       # Search page tests
└── helpers/                    # (existing helpers)
```

### 2.2 Key Principles

1. **Keep the existing fixture pattern** - It works well and Playwright's dependency injection is a strength
2. **Add, don't replace** - New helpers supplement existing ones
3. **Single responsibility** - Each helper does one thing well
4. **Explicit over implicit** - Always wait for expected state, never assume

---

## 3. Waiting Strategy (Approach A)

### 3.1 Philosophy

**Defensive Waiting:** Never assume an element or state is ready. Explicitly wait for it at every transition point between test steps.

### 3.2 New Helper Module: `helpers/wait-for.js`

```javascript
/**
 * Wait for Netflix page to reach a ready state with visible surface containers.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} env - Environment configuration
 * @param {number} env.timeoutMs - Timeout in milliseconds
 */
export async function waitForNetflixReady(page, env) {
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator(CONTAINER_SELECTOR).first()).toBeVisible({ timeout: env.timeoutMs });
}

/**
 * Wait for a rating overlay to appear on a specific surface.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} slug - The title slug (used in data-fm-key attribute)
 * @param {Object} env - Environment configuration
 */
export async function waitForOverlayOnSurface(page, slug, env) {
    await expect(page.locator(`[data-fm-key="${slug}"] .fm-rating-overlay`)).toBeVisible({ timeout: env.timeoutMs });
}

/**
 * Wait for options to sync from options page to Netflix page.
 * Uses initScript pattern to detect page reload.
 * @param {import('@playwright/test').Page} netflixPage - Netflix tab
 * @param {string} marker - Unique marker string for this sync
 * @param {Object} env - Environment configuration
 */
export async function waitForOptionsSync(netflixPage, marker, env) {
    await Promise.race([
        netflixPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: env.timeoutMs }),
        netflixPage.waitForFunction(marker => window[marker] === 'new-document', marker, {
            timeout: env.timeoutMs,
        }),
    ]);
    await netflixPage.waitForLoadState('domcontentloaded');
}

/**
 * Poll for a condition to become true.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {Object} options - Polling options
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @param {number} [options.interval=200] - Polling interval in milliseconds
 * @returns {Promise<boolean>}
 */
export async function pollFor(page, condition, options = {}) {
    const { timeout = 5000, interval = 200 } = options;
    return expect.poll(async () => condition(page), { timeout, interval }).toBeTruthy();
}
```

### 3.3 Updated Existing Helpers

**`helpers/netflix.js`:**

- `discoverVisibleTitles()`: Add internal retries, validate minimum count before returning
- `openHoverSurfaceForTitle()`: Improve mini-modal wait logic, add overlay visibility check
- `ensureNetflixBrowseReady()`: Use `waitForNetflixReady()` internally

**`helpers/overlays.js`:**

- `expectOverlayBadges()`: Wait for overlay to be visible before checking badge count
- `expectOverlayCorner()`: Use polling for position checks
- `expectFaded()`: Use polling for class presence

**`helpers/options-page.js`:**

- `saveOptionsAndWaitForNetflixReload()`: Use `waitForOptionsSync()` internally, add error handling

### 3.4 Timeout Strategy

| Action Type                   | Timeout         | Rationale                                   |
| ----------------------------- | --------------- | ------------------------------------------- |
| Element actions (click, fill) | 5000ms          | Fast user interactions                      |
| Navigation (page load)        | `env.timeoutMs` | Netflix is slow, configurable               |
| Assertions (expected state)   | `env.timeoutMs` | Wait for async effects                      |
| Polling interval              | 200ms           | Balance between responsiveness and overhead |

### 3.5 Environment Configuration

Keep existing environment-based timeout configuration:

- `CHROME_INTEGRATION_TIMEOUT_MS`: Default 30000ms, configurable per developer
- `CHROME_INTEGRATION_HEADLESS`: Boolean, default false
- `CHROME_INTEGRATION_KEEP_OPEN`: Boolean, default false
- `NETFLIX_PROFILE_NAME`: Required, no default

---

## 4. Test Isolation (Approach B)

### 4.1 Problem Statement

Tests interfere with each other through:

1. **Shared extension storage** (cache, config, disabled clients)
2. **Netflix page state** (logged in profile, current URL, scroll position)
3. **Extension service worker state** (in-memory state)

### 4.2 Storage Isolation

**Update `helpers/storage.js`:**

```javascript
/**
 * Reset ALL extension state for a clean test run.
 * Removes cache, fade overrides, and disabled client flags.
 * Preserves API keys.
 */
async function resetAllForCleanRun() {
    const all = await this.getAll();
    const keysToRemove = Object.keys(all).filter(key => {
        // Preserve API keys
        if (API_KEY_FIELDS.has(key)) return false;
        // Remove config, cache, fade, and disabled entries
        return (
            CONFIG_FIELD_KEYS.has(key) ||
            key.startsWith(this.prefixes.cache) ||
            key.startsWith(this.prefixes.fade) ||
            key.startsWith(this.prefixes.disabled)
        );
    });
    await this.remove(keysToRemove);
}
```

**Update `fixtures.js` storage fixture:**

```javascript
storage: async ({ extensionWorker }, use, testInfo) => {
  const helper = createStorageHelper(extensionWorker);

  // Reset ALL extension state before each test
  await helper.resetAllForCleanRun();

  await use(helper);

  // Defensive cleanup after test
  await helper.resetAllForCleanRun().catch(() => {});
},
```

### 4.3 Netflix Page Isolation

**Update `fixtures.js` netflixPage fixture:**

```javascript
netflixPage: (async ({ context, env, storage }, use, testInfo) => {
    const page = await context.newPage();
    const consoleErrors = [];
    const consoleLogs = [];

    // Capture console output for diagnostics
    page.on('console', msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() });
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('crash', () => consoleErrors.push('Page crashed'));

    try {
        await ensureNetflixBrowseReady(page, env);
        await use(page);
    } catch (err) {
        // Attach context to test failure
        if (testInfo) {
            attachErrorContext(testInfo, page, consoleErrors, consoleLogs, err);
        }
        throw err;
    } finally {
        await page.close();
    }
},
    async function attachErrorContext(testInfo, page, consoleErrors, consoleLogs, err) {
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
    });
```

### 4.4 Config Isolation

Each test that modifies configuration should reset to known defaults in `afterEach`:

```javascript
test.afterEach(async ({ storage }) => {
    // Reset to default config
    await storage.set(Object.fromEntries(Object.entries(CONFIG_DEFAULTS).map(([key, value]) => [key, value])));
});
```

Or use `beforeEach` to establish known state:

```javascript
test.beforeEach(async ({ storage }) => {
    // Set known-good config state
    await storage.set({ showRtRating: true, showMcRating: true });
});
```

---

## 5. Conventions and Patterns (Elements of Approach C)

### 5.1 Test File Structure Template

```javascript
/**
 * @file [Brief description of what these tests validate]
 * Tests: should [behavior] when [condition]
 */

import { test, expect } from './fixtures.js';
import { helper1, helper2 } from './helpers/netflix.js';
import { helper3 } from './helpers/overlays.js';
import { TEST_DATA } from './helpers/test-data.js';

// Test data specific to this file
const LOCAL_TEST_DATA = { ... };

// --- Setup/Teardown ---

test.beforeEach(async ({ storage, netflixPage }) => {
  // Reset to known state
  await storage.resetAllForCleanRun();
});

test.afterEach(async ({ storage }) => {
  // Additional cleanup if needed
});

// --- Tests ---

test('should X when Y', async ({ env, netflixPage, storage, optionsPage }) => {
  // Arrange
  const titles = await discoverVisibleTitles(netflixPage, 2);
  await storage.seedRatings(titles, LOCAL_TEST_DATA);

  // Act
  await setOptionAndSave(optionsPage, netflixPage, 'showRtRating', true, env);

  // Assert
  await expectOverlayBadges(netflixPage, titles[0], { rt: true, mc: false });
});
```

### 5.2 Naming Conventions

| Type                | Pattern                              | Example                                          |
| ------------------- | ------------------------------------ | ------------------------------------------------ |
| Test files          | `<feature>.chrome.test.js`           | `ratings.chrome.test.js`                         |
| Test titles         | `should X when Y`                    | `should show RT badge when showRtRating is true` |
| Helper functions    | `verbObject()` or `verbObjectForX()` | `waitForOverlay()`, `expectFaded()`              |
| Helper modules      | Plural noun describing domain        | `netflix.js`, `overlays.js`, `storage.js`        |
| Test data constants | `UPPER_SNAKE_CASE`                   | `DEFAULT_RATINGS`, `LOW_RATING`                  |

### 5.3 Helper Function Signatures

All helpers that interact with pages must accept `page` as the **first parameter**:

```javascript
// Good
export async function waitForOverlay(page, slug, env) { ... }

// Also good (when page is from fixture)
export async function expectOverlayBadges(page, seededTitle, badges) { ... }

// Bad - page not first
export async function expectOverlayBadges(seededTitle, page, badges) { ... }
```

### 5.4 Assertion Style Guide

| Purpose        | Recommended Matcher                   | Avoid                       |
| -------------- | ------------------------------------- | --------------------------- |
| Existence      | `toBeVisible()`, `toExist()`          | `toBeTruthy()` on locator   |
| Count          | `toHaveCount(n)`                      | Custom length checks        |
| Text content   | `toContainText()`, `toHaveText()`     | Regex unless necessary      |
| CSS classes    | `toHaveClass()`                       | Manual class string parsing |
| Eventual truth | `expect.poll()`                       | Custom polling loops        |
| Negation       | `toHaveCount(0)`, `not.toBeVisible()` | `toBeFalsy()`               |

### 5.5 Import Ordering

```javascript
// 1. Playwright/test imports
import { test, expect } from './fixtures.js';

// 2. Helper imports (grouped by domain)
import { discoverVisibleTitles, openHoverSurfaceForTitle } from './helpers/netflix.js';
import { setCheckbox, saveOptionsAndWaitForNetflixReload } from './helpers/options-page.js';
import { expectOverlayBadges } from './helpers/overlays.js';

// 3. Test data
import { DEFAULT_RATINGS } from './helpers/test-data.js';

// 4. Local test data (if any)
const LOCAL_DATA = { ... };
```

---

## 6. Error Handling and Reporting

### 6.1 Automatic Context Capture

Implement automatic capture of diagnostic information on test failure:

- Browser console errors and warnings
- Page screenshots
- Page URL at time of failure
- Browser console log (all messages)

This is implemented in the updated `netflixPage` fixture (see Section 4.3).

### 6.2 Custom Error Classes

Create `helpers/errors.js` for descriptive test assertion errors:

```javascript
/**
 * Error thrown when an element is not found within expected timeout.
 */
export class ElementNotFoundError extends Error {
    /**
     * @param {string} selector - CSS selector that wasn't found
     * @param {string} pageUrl - URL of the page when error occurred
     * @param {Object} [context] - Additional context for debugging
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
     * @param {Object} [context] - Additional context for debugging
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
     * @param {Object} [context] - Additional context
     */
    constructor(message, context = {}) {
        super(message);
        this.name = 'NetflixStateError';
        this.context = context;
    }
}
```

### 6.3 Enhanced Helper Error Messages

Update helpers to throw descriptive errors with context:

```javascript
// helpers/netflix.js
export async function waitForOverlayOnSurface(page, slug, env) {
    const locator = page.locator(`[data-fm-key="${slug}"] .fm-rating-overlay`);

    try {
        await expect(locator).toBeVisible({ timeout: env.timeoutMs });
    } catch (err) {
        const pageUrl = page.url();
        const overlayExists = await locator.count();
        const containerExists = await page.locator(`[data-fm-key="${slug}"]`).count();

        throw new ElementNotFoundError('.fm-rating-overlay', pageUrl, {
            slug,
            overlayCount: overlayExists,
            containerCount: containerExists,
            suggestion:
                containerExists > 0
                    ? 'Overlay not injected. Check if extension is loaded and title is seeded.'
                    : 'Container not found. Check if Netflix surface discovery is working.',
        });
    }
}
```

### 6.4 Playwright Configuration Enhancements

Update `playwright.integration-chrome.config.js`:

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

---

## 7. Implementation Phases

### Phase 1: Critical Stability (Highest Priority)

**Goal:** Address immediate flakiness issues

1. **Create `helpers/wait-for.js`** with core waiting utilities
    - `waitForNetflixReady()`
    - `waitForOverlayOnSurface()`
    - `waitForOptionsSync()`
    - `pollFor()`

2. **Update existing helpers** to use defensive waiting:
    - `discoverVisibleTitles()` in `netflix.js`
    - `openHoverSurfaceForTitle()` in `netflix.js`
    - `expectOverlayBadges()` in `overlays.js`
    - `expectFaded()` in `overlays.js`

3. **Enhance storage isolation** in `fixtures.js`:
    - Add `resetAllForCleanRun()` to `storage.js`
    - Call it before each test in storage fixture

4. **Add error context capture** in `fixtures.js`:
    - Console errors, page errors, screenshots on failure

**Deliverables:**

- `helpers/wait-for.js` (new file)
- Updated `helpers/netflix.js`
- Updated `helpers/overlays.js`
- Updated `helpers/storage.js`
- Updated `fixtures.js`

**Success criteria:**

- All existing tests pass consistently
- No race condition-related failures
- Error messages provide actionable context

---

### Phase 2: Test Organization (Medium Priority)

**Goal:** Improve maintainability and consistency

5. **Update all test files** to follow the template:
    - Standardized structure (Arrange-Act-Assert)
    - "should..." test descriptions
    - Consistent import ordering

6. **Consolidate helper functions** where duplicate logic exists

7. **Add JSDoc comments** to all helpers

**Deliverables:**

- Updated `smoke.chrome.test.js`
- Updated `ratings.chrome.test.js`
- Updated `fade.chrome.test.js`
- Updated `settings.chrome.test.js`
- Updated `search.chrome.test.js`

**Success criteria:**

- All tests follow the same patterns
- Code is self-documenting
- Easy to add new tests

---

### Phase 3: Nice-to-have (Lowest Priority)

**Goal:** Further improve developer experience

8. **Custom error classes** in `helpers/errors.js`

9. **Test data sandboxing** with unique keys per test

10. **Playwright config** minor enhancements

**Deliverables:**

- `helpers/errors.js` (new file)
- Updated test files to use custom errors

**Success criteria:**

- Error messages are more descriptive
- Tests can run with overlapping data without conflicts

---

## 8. Testing the Changes

### 8.1 Validation Strategy

1. **Run all integration-chrome tests locally:**

    ```bash
    npm run test:integration-chrome
    ```

2. **Run individual test files:**

    ```bash
    npx playwright test tests/integration-chrome/ratings.chrome.test.js
    ```

3. **Verify in headless mode:**

    ```bash
    CHROME_INTEGRATION_HEADLESS=true npm run test:integration-chrome
    ```

4. **Test with reduced timeout to verify waiting logic:**
    ```bash
    CHROME_INTEGRATION_TIMEOUT_MS=10000 npm run test:integration-chrome
    ```

### 8.2 Success Criteria

- [ ] All 6 test files pass consistently (10 consecutive runs without flakiness)
- [ ] No race condition errors in console output
- [ ] Error messages are descriptive when tests fail
- [ ] Tests complete within timeout even with reduced timeout values
- [ ] Screenshots and logs are captured on failure

---

## 9. Open Questions

None at this time. All design decisions have been validated with the user.

---

## 10. Appendix

### 10.1 Glossary

| Term           | Definition                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| Playwright     | Browser automation library used for integration tests                              |
| Fixture        | Playwright's dependency injection system for test setup                            |
| Service Worker | Chrome extension background script that handles fetch proxying                     |
| data-fm-key    | Attribute added by FlixMonkey to Netflix surface containers for reliable selection |

### 10.2 Related Files

- `src/core/surfaces.js` - Surface definitions used for Netflix DOM discovery
- `src/targets/chrome/service-worker.js` - Chrome extension service worker
- `src/targets/chrome/manifest.json` - Chrome extension manifest
- `src/targets/extension/content.js` - Content script entry point

### 10.3 References

- [Playwright Test Documentation](https://playwright.dev/docs/test-intro)
- [FlixMonkey AGENTS.md](../AGENTS.md) - Project conventions
