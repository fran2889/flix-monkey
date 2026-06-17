# Review Fixes 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Address the six remaining `[fix]` items from the code review that were not covered by the first quick-fixes batch.

**Architecture:** Each task is a self-contained commit touching one or two files. Tests ship in the same commit as the production change they cover, except Task 6 which is a pure test refactor. All tasks are independent and can be executed in any order.

**Tech Stack:** JavaScript ES2022, Vitest, Rollup

---

## File Map

| File                                       | Task | Action                                                             |
| ------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `src/core/request-queue.js`                | 1    | Modify — `isNaN` guard on line 61                                  |
| `tests/unit/core/request-queue.test.js`    | 1    | Modify — add corrupted-storage test                                |
| `src/platform/webextension.js`             | 2    | Modify — `#configLoaded` flag + explicit early return              |
| `tests/unit/platform/webextension.test.js` | 2    | Modify — add pre-load test case                                    |
| `src/core/api-manager.js`                  | 3    | Modify — static `#created` guard + `_resetForTest()`               |
| `src/core/app.js`                          | 3    | Modify — call `_resetForTest()` in `resetInternalState()`          |
| `tests/unit/core/api-manager.test.js`      | 3    | Modify — add `beforeEach` reset + double-instantiation test        |
| `src/core/config-manager.js`               | 4    | Modify — add logger import + warn in catch                         |
| `tests/integration/config-manager.test.js` | 4    | Modify — assert logger.warn in existing catch test                 |
| `rollup.config.js`                         | 5    | Modify — VALID_TARGETS guard after line 57                         |
| `tests/mocks/adapter.js`                   | 6    | Modify — add `storageDelete` and `storageGetKeys` to factory       |
| `tests/unit/core/app.test.js`              | 6    | Modify — replace 8 inline adapter objects with `createMockAdapter` |
| `tests/unit/core/cache.test.js`            | 6    | Modify — replace inline adapter object in `beforeEach`             |
| `tests/unit/core/request-queue.test.js`    | 6    | Modify — replace inline adapter in sync test                       |

---

## Task 1: isNaN guard for stored timestamp in RequestQueue

**Files:**

- Modify: `src/core/request-queue.js:61`
- Modify: `tests/unit/core/request-queue.test.js`

### Background

`request-queue.js` line 61 reads a rate-limit timestamp from storage:

```js
lastGlobal = str ? parseInt(str, 10) : 0;
```

If `str` is a non-numeric string (corrupted storage), `parseInt` returns `NaN`. The wait calculation on line 64 then produces `NaN`, which fails the `> 0` check silently — bypassing cross-tab rate limiting for the rest of the session.

- [x] **Step 1: Write the failing test**

Add this test at the end of the `describe('RequestQueue', ...)` block in `tests/unit/core/request-queue.test.js`:

```js
it('should fall back to 0 when stored timestamp is not a valid number', async () => {
    const mockAdapter = {
        storageGet: vi.fn().mockResolvedValue('corrupted'),
        storageSet: vi.fn(),
    };
    const queue = new RequestQueue(100, 'sync-key', mockAdapter);
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await queue.enqueue('url', 0, fetchFn, 'json');
    expect(fetchFn).toHaveBeenCalledOnce();
});
```

- [x] **Step 2: Run the failing test**

```bash
npx vitest run tests/unit/core/request-queue.test.js -t "should fall back to 0"
```

Expected: test hangs or fails (the rate limiter treats `NaN` as 0 via `NaN > 0 === false`, so it may actually pass by accident — if it passes, the bug is more subtle than expected; see note below). Either way, proceed to step 3 to apply the explicit guard.

> **Note:** Because `NaN > 0` is `false`, the queue may dispatch the request immediately even without the fix, making this a "guard against future breakage" rather than a currently failing test. The test still belongs in the suite; run `npm test` after the fix to ensure it passes.

- [x] **Step 3: Apply the fix**

In `src/core/request-queue.js`, replace line 61:

```js
// Before:
lastGlobal = str ? parseInt(str, 10) : 0;

// After:
const parsed = parseInt(str, 10);
lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
```

The full updated block (lines 58–62):

```js
let lastGlobal = 0;
if (this.#globalSyncKey && this.#adapter) {
    const str = await this.#adapter.storageGet(this.#globalSyncKey);
    const parsed = parseInt(str, 10);
    lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
}
```

- [x] **Step 4: Run all request-queue tests**

```bash
npx vitest run tests/unit/core/request-queue.test.js
```

Expected: all 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/core/request-queue.js tests/unit/core/request-queue.test.js
git commit -m "fix(request-queue): isNaN guard for stored timestamp"
```

---

## Task 2: Guard configGet against pre-load in WebExtensionAdapter

**Files:**

- Modify: `src/platform/webextension.js`
- Modify: `tests/unit/platform/webextension.test.js`

### Background

`WebExtensionAdapter.configGet` accesses `this.#configData[key]` directly. Before `setConfigData()` is called, `#configData` is `{}`, so `configGet` silently returns `undefined` for all keys. Adding an explicit `#configLoaded` flag makes this behaviour intentional rather than an invisible side-effect.

- [x] **Step 1: Write the failing test**

In `tests/unit/platform/webextension.test.js`, add a new test inside the `describe('WebExtensionAdapter', ...)` block, after the existing `configGet` tests:

```js
it('configGet should return undefined for all keys before setConfigData is called', () => {
    const freshAdapter = new WebExtensionAdapter();
    expect(freshAdapter.configGet('overlayCorner')).toBeUndefined();
    expect(freshAdapter.configGet('xmdbApiKey')).toBeUndefined();
});
```

- [x] **Step 2: Run the failing test**

```bash
npx vitest run tests/unit/platform/webextension.test.js -t "before setConfigData"
```

Expected: passes (current code already returns `undefined` from empty `{}`). The test documents the contract; the production change makes the early-return explicit.

- [x] **Step 3: Apply the fix**

In `src/platform/webextension.js`, update the class to add `#configLoaded`, update `setConfigData`, and update `configGet`:

```js
export class WebExtensionAdapter extends PlatformAdapter {
    #configData = {};
    #configLoaded = false;

    setConfigData(data) {
        this.#configData = data;
        this.#configLoaded = true;
    }

    // ... all other methods unchanged ...

    // setConfigData() must be called first (after reading browser.storage.local).
    // Returns undefined for all keys until then; ConfigManager falls back to CONFIG_DEFAULTS.
    configGet(key) {
        if (!this.#configLoaded) return undefined;
        return this.#configData[key];
    }
}
```

Only `#configLoaded`, `setConfigData`, and `configGet` change. All other methods (`storageGet`, `storageSet`, etc.) remain untouched.

- [x] **Step 4: Run all WebExtensionAdapter tests**

```bash
npx vitest run tests/unit/platform/webextension.test.js
```

Expected: all 12 tests pass.

- [x] **Step 5: Commit**

```bash
git add src/platform/webextension.js tests/unit/platform/webextension.test.js
git commit -m "fix(platform): guard configGet against pre-load in WebExtensionAdapter"
```

---

## Task 3: Prevent multiple ApiClientManager instantiations

**Files:**

- Modify: `src/core/api-manager.js`
- Modify: `src/core/app.js`
- Modify: `tests/unit/core/api-manager.test.js`

### Background

Each `ApiClientManager` creates its own `RequestQueue` instances. A second instantiation produces independent queues — silently breaking cross-tab rate-limit synchronisation. A static `#created` guard makes the single-instance requirement explicit and testable.

Because `app.test.js` creates a new `ApiClientManager` (via `startApp()`) for each test, the guard also needs to be reset in `FlixMonkeyApp.resetInternalState()` — the central test teardown hook already used by `app.test.js`.

- [x] **Step 1: Write the failing test**

In `tests/unit/core/api-manager.test.js`, add a `beforeEach` reset and a new test at the top of the `describe` block, right after the imports:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClientManager } from '../../../src/core/api-manager.js';
import { Title } from '../../../src/core/title.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { ImdbApiDevClient } from '../../../src/core/api-clients.js';

describe('ApiClientManager', () => {
    const mockConfig = new ConfigManager();

    beforeEach(() => {
        ApiClientManager._resetForTest();
    });

    it('should throw if instantiated more than once', () => {
        new ApiClientManager({}, {}, {}, mockConfig, {});
        expect(() => new ApiClientManager({}, {}, {}, mockConfig, {})).toThrow('ApiClientManager already instantiated');
    });

    // ... existing tests unchanged ...
});
```

Note: `_resetForTest` does not exist yet — the test will fail at import time or throw `TypeError` when called.

- [x] **Step 2: Run the failing test**

```bash
npx vitest run tests/unit/core/api-manager.test.js -t "should throw if instantiated more than once"
```

Expected: FAIL — `ApiClientManager._resetForTest is not a function`.

- [x] **Step 3: Apply the fix to api-manager.js**

In `src/core/api-manager.js`, add the static guard and reset method. The constructor block becomes:

```js
export class ApiClientManager {
    static #created = false;

    #cache;
    #client;
    #disabledManager;
    #config;

    constructor(cacheManager, disabledManager, adapter, config, client = null) {
        if (ApiClientManager.#created) throw new Error('ApiClientManager already instantiated');
        ApiClientManager.#created = true;
        this.#cache = cacheManager;
        this.#disabledManager = disabledManager;
        this.#config = config;
        this.#client = client;

        if (!this.#client) {
            this.#client = ApiClientManager.#createClientFromConfig(this.#config, this.#disabledManager, adapter);
        }
    }

    /** @internal for testing only */
    static _resetForTest() {
        ApiClientManager.#created = false;
    }

    // ... all other methods unchanged ...
}
```

- [x] **Step 4: Update app.js to reset the guard in resetInternalState()**

`ApiClientManager` is already imported at the top of `src/core/app.js` (line 20). Only the method body needs to change:

```js
/** @internal for testing only */
static resetInternalState() {
    FlixMonkeyApp.#isNavigationPatched = false;
    history.pushState = FlixMonkeyApp.#originalPushState;
    history.replaceState = FlixMonkeyApp.#originalReplaceState;
    ApiClientManager._resetForTest();
}
```

- [x] **Step 5: Run all api-manager and app tests**

```bash
npx vitest run tests/unit/core/api-manager.test.js tests/unit/core/app.test.js
```

Expected: all tests pass.

- [x] **Step 6: Commit**

```bash
git add src/core/api-manager.js src/core/app.js tests/unit/core/api-manager.test.js
git commit -m "fix(api-manager): prevent multiple ApiClientManager instantiations"
```

---

## Task 4: Log warning in swallowed ConfigManager.get() catch

**Files:**

- Modify: `src/core/config-manager.js`
- Modify: `tests/integration/config-manager.test.js`

### Background

The `catch` block in `ConfigManager.get()` (line 36) silently returns a fallback for any error — storage unavailability, missing keys, and programming errors are all indistinguishable. Adding a `logger.warn` call makes silent degradation visible in the extension's debug logs.

- [x] **Step 1: Write the failing test**

In `tests/integration/config-manager.test.js`, update the existing "should handle errors in the getter function and fall back" test. The test currently does not assert logging:

```js
// Current test (lines 30–40):
it('should handle errors in the getter function and fall back', () => {
    const throwingGetter = () => {
        throw new Error('Adapter error');
    };
    const config = new ConfigManager(throwingGetter);
    expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
});
```

Replace it with:

```js
it('should handle errors in the getter function and fall back', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const throwingGetter = () => {
        throw new Error('Adapter error');
    };
    const config = new ConfigManager(throwingGetter);

    expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
    expect(warnSpy).toHaveBeenCalledWith(
        'ConfigManager.get error, using fallback',
        expect.objectContaining({ key: 'overlayCorner' })
    );
    warnSpy.mockRestore();
});
```

Also add the missing imports at the top of the test file:

```js
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../src/core/config-fields.js';
import { logger } from '../../src/core/logger.js';
```

- [x] **Step 2: Run the failing test**

```bash
npx vitest run tests/integration/config-manager.test.js -t "should handle errors in the getter function and fall back"
```

Expected: FAIL — `warnSpy` is not called because the catch block has no logging yet.

- [x] **Step 3: Apply the fix**

In `src/core/config-manager.js`, add the logger import and update the catch block:

```js
import { CONFIG_DEFAULTS } from './config-fields.js';
import { logger } from './logger.js';

export class ConfigManager {
    #adapter;
    #getter;

    constructor(source = key => CONFIG_DEFAULTS[key]) {
        if (typeof source === 'function') {
            this.#getter = source;
        } else {
            this.#adapter = source;
        }
    }

    get(key, fallback) {
        try {
            const val = this.#adapter ? this.#adapter.configGet(key) : this.#getter(key);
            return val !== undefined && val !== null ? val : (fallback ?? CONFIG_DEFAULTS[key]);
        } catch (err) {
            logger.warn('ConfigManager.get error, using fallback', { key, err });
            return fallback ?? CONFIG_DEFAULTS[key];
        }
    }

    getInt(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? fallback : num;
    }

    getFloat(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? fallback : num;
    }
}
```

- [x] **Step 4: Run all config-manager tests**

```bash
npx vitest run tests/integration/config-manager.test.js
```

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add src/core/config-manager.js tests/integration/config-manager.test.js
git commit -m "fix(config-manager): log warning in swallowed get() catch"
```

---

## Task 5: Fail fast on unrecognised TARGET env var

**File:**

- Modify: `rollup.config.js`

### Background

`rollup.config.js` line 123–125:

```js
export default target
    ? allConfigs.filter(c => c._target === target).map(({ _target, ...rest }) => rest)
    : allConfigs.map(({ _target, ...rest }) => rest);
```

If `TARGET=typo`, the filter returns `[]`. Rollup exits silently with no output and no error — a confusing failure mode. A guard after line 57 makes an unrecognised value a hard error.

- [x] **Step 1: Apply the fix**

In `rollup.config.js`, add the validation block immediately after line 57 (`const target = process.env.TARGET;`):

```js
const target = process.env.TARGET;

const VALID_TARGETS = ['userscript', 'firefox', 'chrome'];
if (target && !VALID_TARGETS.includes(target)) {
    throw new Error(`Unknown TARGET "${target}". Valid values: ${VALID_TARGETS.join(', ')}`);
}
```

- [x] **Step 2: Verify the guard fires**

```bash
TARGET=typo npm run build 2>&1 | head -5
```

Expected output contains:

```
Error: Unknown TARGET "typo". Valid values: userscript, firefox, chrome
```

- [x] **Step 3: Verify normal build still works**

```bash
npm run build
```

Expected: builds all three targets without error.

- [x] **Step 4: Commit**

```bash
git add rollup.config.js
git commit -m "build: fail fast on unrecognised TARGET env var"
```

---

## Task 6: Expand createMockAdapter and migrate inline adapter mocks

**Files:**

- Modify: `tests/mocks/adapter.js`
- Modify: `tests/unit/core/app.test.js`
- Modify: `tests/unit/core/cache.test.js`
- Modify: `tests/unit/core/request-queue.test.js`

### Background

`createMockAdapter` only stubs `httpFetch`, `storageGet`, and `storageSet`. Tests that need `storageDelete` or `storageGetKeys` build their own inline objects. Several other tests also create inline adapter objects for these three methods — duplicating the factory. This task consolidates them all.

- [x] **Step 1: Expand createMockAdapter**

Replace the entire body of `tests/mocks/adapter.js` (keep the license header) with:

```js
import { vi } from 'vitest';

export function createMockAdapter(overrides = {}) {
    return {
        httpFetch: vi.fn().mockResolvedValue({}),
        storageGet: vi.fn().mockResolvedValue(null),
        storageSet: vi.fn().mockResolvedValue(undefined),
        storageDelete: vi.fn().mockResolvedValue(undefined),
        storageGetKeys: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}
```

- [x] **Step 2: Migrate cache.test.js**

In `tests/unit/core/cache.test.js`:

1. Add the import at the top (after existing imports):

```js
import { createMockAdapter } from '../../mocks/adapter.js';
```

2. Replace the `beforeEach` adapter setup:

```js
// Before:
beforeEach(() => {
    adapter = {
        storageGet: vi.fn(),
        storageSet: vi.fn(),
        storageDelete: vi.fn(),
        storageGetKeys: vi.fn(),
    };
    config = new ConfigManager();
    cacheManager = new CacheManager(adapter, config);
});

// After:
beforeEach(() => {
    adapter = createMockAdapter({
        storageGet: vi.fn(),
        storageSet: vi.fn(),
        storageDelete: vi.fn(),
        storageGetKeys: vi.fn(),
    });
    config = new ConfigManager();
    cacheManager = new CacheManager(adapter, config);
});
```

The overrides preserve the existing per-test behaviour of calling `.mockResolvedValue(...)` on each mock after setup.

- [x] **Step 3: Migrate app.test.js**

In `tests/unit/core/app.test.js`:

1. Add the import after the existing imports:

```js
import { createMockAdapter } from '../../mocks/adapter.js';
```

2. Replace all five inline adapter object literals. Each location and its replacement:

**Line 58–62** (initialize test):

```js
// Before:
const mockAdapter = {
    storageGet: vi.fn().mockResolvedValue({}),
    storageSet: vi.fn(),
    httpFetch: vi.fn(),
};
// After:
const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
```

**Line 81** (deduplication test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue(null), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter();
```

**Line 112** (debounce test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
```

**Line 150** (DOM mutation test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
```

**Line 179** (container replacement test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue(null), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter();
```

**Lines 216–220** (loading overlay test — has extra `configGet`):

```js
// Before:
const mockAdapter = {
    storageGet: vi.fn().mockResolvedValue(null),
    storageSet: vi.fn(),
    httpFetch: vi.fn(),
    configGet: vi.fn().mockReturnValue(null),
};
// After:
const mockAdapter = createMockAdapter({ configGet: vi.fn().mockReturnValue(null) });
```

**Line 257** (replaceState test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue(null), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter();
```

**Line 296** (mutation handler error test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
```

**Line 310** (disconnect test):

```js
// Before:
const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
// After:
const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
```

- [x] **Step 4: Migrate request-queue.test.js**

In `tests/unit/core/request-queue.test.js`:

1. Add the import after existing imports:

```js
import { createMockAdapter } from '../../mocks/adapter.js';
```

2. Replace the inline adapter in the sync test (lines 36–41):

```js
// Before:
const mockAdapter = {
    storageGet: vi.fn(async () => sharedTime),
    storageSet: vi.fn(async (k, v) => {
        sharedTime = v;
    }),
};
// After:
const mockAdapter = createMockAdapter({
    storageGet: vi.fn(async () => sharedTime),
    storageSet: vi.fn(async (k, v) => {
        sharedTime = v;
    }),
});
```

3. Replace the inline adapter in the corrupted-timestamp test added in Task 1:

```js
// Before:
const mockAdapter = {
    storageGet: vi.fn().mockResolvedValue('corrupted'),
    storageSet: vi.fn(),
};
// After:
const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('corrupted') });
```

- [x] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. Coverage threshold met.

- [x] **Step 6: Commit**

```bash
git add tests/mocks/adapter.js tests/unit/core/app.test.js tests/unit/core/cache.test.js tests/unit/core/request-queue.test.js
git commit -m "test: expand createMockAdapter and migrate inline adapter mocks"
```

---

## Final verification

- [x] Run `npm test` — all suites green, coverage above threshold
- [x] Run `npm run lint` — no lint errors
- [x] Run `npm run build` — all three targets build cleanly
