# Review Fixes 2 — Design Spec

> Date: 2026-06-05

Six independent commits, each self-contained. Tests ship in the same commit as the production change they cover, except for the pure test refactor (commit 6). All commits must leave `npm test` green and `npm run lint` clean.

---

## Context

This spec covers the remaining `[fix]` items from `docs/code-review.md` that were not addressed by the first quick-fixes batch (see `docs/superpowers/specs/2026-06-05-quick-fixes-design.md`). Many items from the code review were already fixed in the quick-fixes implementation; only the six items below remain open.

---

## Commit 1 — `fix(request-queue): isNaN guard for stored timestamp`

**File:** `src/core/request-queue.js`

### Change

Line 61 reads the global timestamp from storage and parses it:

```js
lastGlobal = str ? parseInt(str, 10) : 0;
```

If `str` is a non-numeric string (e.g., a corrupted storage value such as `'[object Object]'`), `parseInt` returns `NaN`. The subsequent arithmetic in line 64 then produces `NaN`, which fails the `> 0` guard silently — bypassing rate limiting entirely.

Replace line 61 with:

```js
const parsed = parseInt(str, 10);
lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
```

### Test

In `tests/unit/core/request-queue.test.js`, add a test that passes a non-numeric string as the stored timestamp and verifies the queue still dispatches the request (i.e., does not block indefinitely):

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

---

## Commit 2 — `fix(platform): guard configGet against pre-load in WebExtensionAdapter`

**File:** `src/platform/webextension.js`

### Change

`#configData` starts as `{}`. If `configGet` is called before `setConfigData`, it silently returns `undefined` for all keys with no indication that the data hasn't loaded yet.

Add a `#configLoaded` private field, set it in `setConfigData`, and use it in `configGet` to return `undefined` explicitly before data is available — making the pre-load behaviour intentional rather than a side-effect of `{}[key]`:

```js
#configData = {};
#configLoaded = false;

setConfigData(data) {
    this.#configData = data;
    this.#configLoaded = true;
}

// setConfigData() must be called first (after reading browser.storage.local).
// Returns undefined for all keys until then; ConfigManager falls back to CONFIG_DEFAULTS.
configGet(key) {
    if (!this.#configLoaded) return undefined;
    return this.#configData[key];
}
```

### Test

In the platform adapter test suite (or a new `tests/unit/platform/webextension.test.js`), add two cases:

1. `configGet` returns `undefined` for any key before `setConfigData` is called.
2. `configGet` returns the correct value after `setConfigData` is called.

---

## Commit 3 — `fix(api-manager): prevent multiple ApiClientManager instantiations`

**File:** `src/core/api-manager.js`

### Change

Each `ApiClientManager` instance creates its own `RequestQueue` instances inside the API clients. If two `ApiClientManager` instances coexist, each has independent queues — breaking cross-tab rate-limit synchronisation for XMDB.

Add a static `#created` flag that throws if the constructor is called a second time, consistent with the `#initialised` guard pattern used in `app.js`:

```js
static #created = false;

constructor(cacheManager, disabledManager, adapter, config, client = null) {
    if (ApiClientManager.#created) throw new Error('ApiClientManager already instantiated');
    ApiClientManager.#created = true;
    // ... rest of constructor unchanged
}
```

### Test

In `tests/unit/core/api-manager.test.js` (create if it doesn't exist), add:

```js
it('should throw if instantiated more than once', () => {
    // Reset static flag before test
    ApiClientManager._reset?.(); // see note below
    new ApiClientManager(mockCache, mockDisabled, mockAdapter, mockConfig);
    expect(() => new ApiClientManager(mockCache, mockDisabled, mockAdapter, mockConfig)).toThrow(
        'ApiClientManager already instantiated'
    );
});
```

**Note on test reset:** To make the guard testable, add a package-private static reset method used only in tests:

```js
static _resetForTest() {
    ApiClientManager.#created = false;
}
```

Call it in `beforeEach` / `afterEach` in the test. Do not call it in production code.

---

## Commit 4 — `fix(config-manager): log warning in swallowed get() catch`

**File:** `src/core/config-manager.js`

### Change

The `catch` block in `get()` (line 36) is bare: it returns the fallback without logging anything. Storage errors, missing keys, and programming errors are silently conflated.

1. Add `import { logger } from './logger.js';` at the top.
2. Change the catch block:

```js
} catch (err) {
    logger.warn('ConfigManager.get error, using fallback', { key, err });
    return fallback ?? CONFIG_DEFAULTS[key];
}
```

### Test update

In `tests/integration/config-manager.test.js`, update the existing "should handle errors in the getter function and fall back" test to also assert the logger was called:

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

---

## Commit 5 — `build: fail fast on unrecognised TARGET env var`

**File:** `rollup.config.js`

### Change

Line 123–125:

```js
export default target
    ? allConfigs.filter(c => c._target === target).map(({ _target, ...rest }) => rest)
    : allConfigs.map(({ _target, ...rest }) => rest);
```

If `TARGET=foo`, the filter returns an empty array. Rollup exits silently producing no output. Add a guard immediately after line 57 (`const target = process.env.TARGET;`):

```js
const VALID_TARGETS = ['userscript', 'firefox', 'chrome'];
if (target && !VALID_TARGETS.includes(target)) {
    throw new Error(`Unknown TARGET "${target}". Valid values: ${VALID_TARGETS.join(', ')}`);
}
```

No test needed — this is a build-time guard exercised by the CI scripts.

---

## Commit 6 — `test: expand createMockAdapter and migrate inline adapter mocks`

**Files:** `tests/mocks/adapter.js`, `tests/unit/core/app.test.js`, `tests/unit/core/cache.test.js`, `tests/unit/core/request-queue.test.js`

### Change

`createMockAdapter` currently only stubs `httpFetch`, `storageGet`, and `storageSet`. Tests that need the full adapter shape (`storageDelete`, `storageGetKeys`) build their own inline objects instead.

1. **Expand `createMockAdapter`** to include the full storage API:

```js
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

2. **`app.test.js`** — replace each inline `{ storageGet: vi.fn()..., storageSet: vi.fn()..., httpFetch: vi.fn() }` object literal with `createMockAdapter(overrides)`. Import `createMockAdapter` from `../../mocks/adapter.js`.

3. **`cache.test.js`** — replace the inline mock object with `createMockAdapter(overrides)`. The existing test needs `storageGet`, `storageSet`, `storageDelete`, and `storageGetKeys`; all are now available from the shared factory.

4. **`request-queue.test.js`** — the cross-instance synchronisation test uses a dynamic closure for `storageGet`. Migrate to `createMockAdapter({ storageGet: vi.fn(async () => sharedTime), storageSet: vi.fn(...) })`.

The new test added in commit 1 should also use `createMockAdapter`.

---

## Cross-cutting constraint

All commits must leave `npm test` green and `npm run lint` clean. Commit messages use Conventional Commits format in imperative mood with no references to reviews, specs, or issue numbers.
