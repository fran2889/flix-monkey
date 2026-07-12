# Correctness Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven correctness bugs in the FlixMonkey core, each committed separately.

**Architecture:** Every fix is a targeted, self-contained edit to one or two files; no new files are created. Tests are added to the existing `tests/unit/core/` test files that already cover each module.

**Tech Stack:** Vanilla JS (ESM), Vitest (jsdom environment), `tests/mocks/adapter.js` and `tests/mocks/logger.js` for shared mock factories.

## Global Constraints

- Test runner: `npm run test:unit` (runs `vitest run tests/unit`)
- Single-file run: `npx vitest run tests/unit/core/<file>.test.js`
- All test files use `import { describe, it, expect, vi } from 'vitest'` (no globals)
- Mock adapter: `createMockAdapter(overrides?)` from `tests/mocks/adapter.js`
- Mock logger: `createMockLogger()` from `tests/mocks/logger.js`
- Commit message format: `fix(<scope>): <description>` (conventional commits)
- No new files; no comments explaining the fix; no unrelated cleanup

---

### Task 1: Re-read storage before claiming timeslot on no-wait path

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "Cross-tab rate-limit race in the request queue"

**Files:**

- Modify: `src/core/request-queue.js:71-75`
- Test: `tests/unit/core/request-queue.test.js`

**Interfaces:**

- Consumes: `RequestQueue(minInterval, globalSyncKey, adapter)` constructor — unchanged
- Produces: same public API; internal `#process` now calls `adapter.storageGet` twice per request on the no-wait path when a sync key is configured

- [x] **Step 1: Add two new failing tests to `tests/unit/core/request-queue.test.js`**

Add inside the existing `describe('RequestQueue', () => { ... })` block, after the last test:

```js
it('should re-read global storage before claiming timeslot on no-wait path', async () => {
    const mockAdapter = createMockAdapter({
        storageGet: vi.fn().mockResolvedValue('0'),
        storageSet: vi.fn().mockResolvedValue(undefined),
    });
    const queue = new RequestQueue(0, 'sync-key', mockAdapter);
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await queue.enqueue('url', 0, fetchFn, 'json');
    // Two reads per request: one at loop start, one pre-claim
    expect(mockAdapter.storageGet).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledOnce();
});

it('should re-loop when pre-claim read shows another tab fired recently', async () => {
    let callCount = 0;
    const recentTime = Date.now();
    const staleTime = (recentTime - 2000).toString();
    const mockAdapter = createMockAdapter({
        storageGet: vi.fn(async () => {
            callCount++;
            // 2nd call is the pre-claim re-read — simulate another tab just fired
            return callCount === 2 ? recentTime.toString() : staleTime;
        }),
        storageSet: vi.fn().mockResolvedValue(undefined),
    });
    const queue = new RequestQueue(100, 'sync-key', mockAdapter);
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await queue.enqueue('url', 0, fetchFn, 'json');
    // loop1-start → stale (wait=0), pre-claim → recent (re-loop),
    // loop2-start → stale (wait=0), pre-claim → stale (Date.now()-stale>100 → proceed)
    expect(mockAdapter.storageGet).toHaveBeenCalledTimes(4);
    expect(fetchFn).toHaveBeenCalledOnce();
});
```

- [x] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/unit/core/request-queue.test.js
```

Expected: two new tests FAIL with `storageGet` call count mismatches; all other tests in the file PASS.

- [x] **Step 3: Implement the fix in `src/core/request-queue.js`**

Replace lines 71-77 (the no-wait section) with:

```js
            // Re-read storage before claiming the timeslot to reduce cross-tab races
            if (this.#globalSyncKey && this.#adapter) {
                const str = await this.#adapter.storageGet(this.#globalSyncKey);
                const parsed = parseInt(str, 10);
                const freshGlobal = Number.isNaN(parsed) ? 0 : parsed;
                if (Date.now() - freshGlobal < this.#minInterval) continue;
            }

            this.#lastLocalReqTime = Date.now();
            if (this.#globalSyncKey && this.#adapter) {
                await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
            }
```

The full `while` body in `#process` now reads:

```js
while (this.#queue.length > 0) {
    const now = Date.now();
    let lastGlobal = 0;
    if (this.#globalSyncKey && this.#adapter) {
        const str = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsed = parseInt(str, 10);
        lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
    }

    const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
    if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
        // Re-read storage after waiting, then restart loop
        continue;
    }

    // Re-read storage before claiming the timeslot to reduce cross-tab races
    if (this.#globalSyncKey && this.#adapter) {
        const str = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsed = parseInt(str, 10);
        const freshGlobal = Number.isNaN(parsed) ? 0 : parsed;
        if (Date.now() - freshGlobal < this.#minInterval) continue;
    }

    this.#lastLocalReqTime = Date.now();
    if (this.#globalSyncKey && this.#adapter) {
        await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
    }

    const { url, resolve, reject, fetchFn, responseType } = this.#queue.shift();
    try {
        const result = await fetchFn(url, responseType);
        resolve(result);
    } catch (err) {
        reject(err);
    }
}
```

- [x] **Step 4: Update the existing test whose expected call count changed**

In `tests/unit/core/request-queue.test.js`, find and update the test "should read global storage only once per request when no wait is needed":

```js
// BEFORE
it('should read global storage only once per request when no wait is needed', async () => {
    // ...
    // With interval=0 and no wait needed, storageGet should be called once per request
    expect(mockAdapter.storageGet).toHaveBeenCalledTimes(2);
});

// AFTER
it('should read global storage twice per request when no wait is needed', async () => {
    const mockAdapter = createMockAdapter({
        storageGet: vi.fn().mockResolvedValue('0'),
        storageSet: vi.fn().mockResolvedValue(undefined),
    });
    const queue = new RequestQueue(0, 'sync-key', mockAdapter);
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });

    await queue.enqueue('url1', 0, fetchFn, 'json');
    await queue.enqueue('url2', 0, fetchFn, 'json');

    // Two reads per request (loop-start + pre-claim), two requests = four total
    expect(mockAdapter.storageGet).toHaveBeenCalledTimes(4);
});
```

- [x] **Step 5: Run all tests to verify everything passes**

```
npx vitest run tests/unit/core/request-queue.test.js
```

Expected: all tests in the file PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/request-queue.js tests/unit/core/request-queue.test.js
git commit -m "fix(request-queue): re-read storage before claiming timeslot on no-wait path"
```

---

### Task 2: Extract slugify helper and align dedup key with cache key

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "In-flight dedup key ≠ cache key"

**Files:**

- Modify: `src/core/utils.js` (add `slugify` export)
- Modify: `src/core/cache.js` (import and use `slugify`)
- Modify: `src/core/app.js` (import and use `slugify` for `dedupKey`)
- Test: `tests/unit/core/utils.test.js`, `tests/unit/core/cache.test.js`, `tests/unit/core/app.test.js`

**Interfaces:**

- Produces: `slugify(str: string): string` exported from `src/core/utils.js`
    - Lowercases, replaces `[^a-z0-9]+` with `_`, trims leading/trailing `_`
    - Example: `slugify("Schitt's Creek")` → `"schitts_creek"`
    - Example: `slugify("Test: Movie")` → `"test_movie"`

- [x] **Step 1: Add `slugify` tests to `tests/unit/core/utils.test.js`**

Extend the existing static import at the top of `tests/unit/core/utils.test.js`:

```js
// BEFORE
import { debounce, runIdle } from '../../../src/core/utils.js';

// AFTER
import { debounce, runIdle, slugify } from '../../../src/core/utils.js';
```

Add a new `describe('slugify', ...)` block inside the existing `describe('core/utils', () => { ... })`, after the `runIdle` block:

```js
describe('slugify', () => {
    it('should lowercase and replace non-alphanumeric sequences with underscores', () => {
        expect(slugify("Schitt's Creek")).toBe('schitts_creek');
        expect(slugify('Test: Movie')).toBe('test_movie');
        expect(slugify('Hello World')).toBe('hello_world');
    });

    it('should trim leading and trailing underscores', () => {
        expect(slugify('  Hello  ')).toBe('hello');
        expect(slugify('!Movie!')).toBe('movie');
    });

    it('should produce the same slug for titles differing only by punctuation', () => {
        expect(slugify('Test: Movie')).toBe(slugify('Test Movie'));
    });
});
```

Add to `tests/unit/core/cache.test.js`, inside the existing `describe('CacheManager', ...)` block:

```js
it('should produce the same cache key for titles that differ only by punctuation', async () => {
    const title = new Title({ apiTitle: 'Test Title' });
    await cacheManager.write('Test: Title', title);
    const key1 = adapter.storageSet.mock.calls[0][0];
    adapter.storageSet.mockClear();
    await cacheManager.write('Test Title', title);
    const key2 = adapter.storageSet.mock.calls[0][0];
    expect(key1).toBe(key2);
    expect(key1).toBe('fmc:test_title');
});
```

Add to `tests/unit/core/app.test.js`, inside the existing `describe('App', ...)` block (the test uses the same `beforeEach`/`afterEach` setup already present):

```js
it('should deduplicate in-flight requests for titles that differ only by punctuation', async () => {
    const mockAdapter = createMockAdapter();
    document.body.innerHTML = `
        <div id="container">
            <div class="title-card" id="card1"><div class="fallback-text">Test: Movie</div></div>
            <div class="title-card" id="card2"><div class="fallback-text">Test Movie</div></div>
        </div>
    `;
    const getDataSpy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        apiTitle: 'Test Movie',
        rating: 7.0,
    });
    appRef = startApp(mockAdapter);
    await vi.waitFor(() => {
        if (getDataSpy.mock.calls.length === 0) throw new Error('Not called yet');
    });
    expect(getDataSpy.mock.calls.length).toBeLessThanOrEqual(1);
    getDataSpy.mockRestore();
});
```

- [x] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/unit/core/utils.test.js tests/unit/core/cache.test.js tests/unit/core/app.test.js
```

Expected: `slugify` tests in utils FAIL (not exported), cache key collision test PASSES (coincidentally same slug already), app punctuation dedup test FAILS (two separate in-flight requests because dedupKeys differ).

- [x] **Step 3: Implement `slugify` in `src/core/utils.js`**

Add after the `runIdle` function:

```js
export function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}
```

- [x] **Step 4: Update `src/core/cache.js` to use `slugify`**

Add `slugify` to the import at the top of `src/core/cache.js`:

```js
// BEFORE
import { DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';

// AFTER
import { DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';
import { slugify } from './utils.js';
```

Replace the body of `#getCacheKey`:

```js
// BEFORE
#getCacheKey(displayTitle) {
    const slug = displayTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    return `${this.#prefix}${slug}`;
}

// AFTER
#getCacheKey(displayTitle) {
    return `${this.#prefix}${slugify(displayTitle)}`;
}
```

- [x] **Step 5: Update `src/core/app.js` to use `slugify` for `dedupKey`**

Extend the existing utils import at the top of `src/core/app.js`:

```js
// BEFORE
import { debounce, runIdle } from './utils.js';

// AFTER
import { debounce, runIdle, slugify } from './utils.js';
```

Replace line 85 in `#decorateContainer`:

```js
// BEFORE
const dedupKey = displayTitle.toLowerCase();

// AFTER
const dedupKey = slugify(displayTitle);
```

- [x] **Step 6: Run all affected tests to verify they pass**

```
npx vitest run tests/unit/core/utils.test.js tests/unit/core/cache.test.js tests/unit/core/app.test.js
```

Expected: all tests PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/utils.js src/core/cache.js src/core/app.js \
        tests/unit/core/utils.test.js tests/unit/core/cache.test.js tests/unit/core/app.test.js
git commit -m "fix(dedup): extract slugify helper and align dedup key with cache key"
```

---

### Task 3: Guarantee numeric return from `getInt` and `getFloat`

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "`getInt` / `getFloat` can return a non-numeric fallback"

**Files:**

- Modify: `src/core/config-manager.js:39-49`
- Test: `tests/unit/core/config-manager.test.js`

**Interfaces:**

- Produces: `ConfigManager.getInt(key, fallback?)` and `ConfigManager.getFloat(key, fallback?)` — both always return a finite `number` (never `undefined`, `null`, or `NaN`)

- [x] **Step 1: Add failing tests to `tests/unit/core/config-manager.test.js`**

Add inside the existing `describe('ConfigManager', ...)` block:

```js
it('should return 0 from getInt when both value and fallback are non-numeric', () => {
    const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
    const result = config.getInt('someKey');
    expect(typeof result).toBe('number');
    expect(result).toBe(0);
});

it('should return 0 from getFloat when both value and fallback are non-numeric', () => {
    const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
    const result = config.getFloat('someKey');
    expect(typeof result).toBe('number');
    expect(result).toBe(0);
});

it('should return numeric fallback from getInt when value is non-numeric', () => {
    const config = new ConfigManager(createMockAdapter({ configGet: () => undefined }), createMockLogger());
    expect(config.getInt('someKey', 7)).toBe(7);
});

it('should return numeric fallback from getFloat when value is non-numeric', () => {
    const config = new ConfigManager(createMockAdapter({ configGet: () => undefined }), createMockLogger());
    expect(config.getFloat('someKey', 1.5)).toBe(1.5);
});
```

- [x] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/unit/core/config-manager.test.js
```

Expected: the two `return 0` tests FAIL (current code returns `undefined`); the numeric-fallback tests PASS (current code already returns the fallback).

- [x] **Step 3: Implement the fix in `src/core/config-manager.js`**

Replace `getInt` and `getFloat`:

```js
getInt(key, fallback) {
    const val = this.get(key, fallback);
    const num = Number.parseInt(val, 10);
    if (!Number.isNaN(num)) return num;
    const fb = Number.parseInt(fallback, 10);
    return Number.isNaN(fb) ? 0 : fb;
}

getFloat(key, fallback) {
    const val = this.get(key, fallback);
    const num = Number.parseFloat(val);
    if (!Number.isNaN(num)) return num;
    const fb = Number.parseFloat(fallback);
    return Number.isNaN(fb) ? 0 : fb;
}
```

- [x] **Step 4: Run all tests in the file to verify they pass**

```
npx vitest run tests/unit/core/config-manager.test.js
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/config-manager.js tests/unit/core/config-manager.test.js
git commit -m "fix(config): guarantee numeric return from getInt and getFloat"
```

---

### Task 4: Use `!= null` checks to preserve zero ratings in overlay

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "Overlay truthiness checks drop legitimate `0` / `0%` ratings"

**Files:**

- Modify: `src/core/overlay.js:158, 170, 177`
- Test: `tests/unit/core/overlay.test.js`

**Interfaces:**

- Produces: `OverlayRenderer.injectOverlay(container, titleObj)` — now renders badges when `rating`, `rtRating`, or `mcRating` is `0`

- [x] **Step 1: Add failing tests to `tests/unit/core/overlay.test.js`**

Add the following imports at the top of the test file (after existing imports):

```js
import { Title } from '../../../src/core/title.js';
```

Add inside the existing `describe('OverlayRenderer', ...)` block:

```js
it('should render an IMDb badge for a zero rating', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const title = new Title({ imdbId: 'tt1234567', rating: 0 });
    renderer.injectOverlay(container, title);
    const overlay = container.querySelector('.fm-rating-overlay');
    expect(overlay).not.toBeNull();
    // rating=0 renders as "0.0", not as N/A or absent
    expect(overlay.querySelector('.fm-value')).not.toBeNull();
    expect(overlay.textContent).toContain('0.0');
});

it('should render RT and MC badges for zero percent ratings', () => {
    const config = new ConfigManager(
        createMockAdapter({
            configGet: key => {
                if (key === 'showRtRating') return true;
                if (key === 'showMcRating') return true;
                return undefined;
            },
        })
    );
    const renderer = new OverlayRenderer(config);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const title = new Title({ imdbId: 'tt1234567', rating: 5, rtRating: 0, mcRating: 0 });
    renderer.injectOverlay(container, title);
    const overlay = container.querySelector('.fm-rating-overlay');
    expect(overlay).not.toBeNull();
    // rtRating=0 and mcRating=0 each format as "0%"
    const percentBadges = [...overlay.querySelectorAll('.fm-value')].filter(el => el.textContent === '0%');
    expect(percentBadges.length).toBe(2);
});
```

- [x] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/unit/core/overlay.test.js
```

Expected: both new tests FAIL because the zero ratings are not rendered.

- [x] **Step 3: Implement the fix in `src/core/overlay.js`**

Three replacements in `#createOverlay`:

```js
// Line 158 — BEFORE
if (rating) {

// AFTER
if (rating != null) {
```

```js
// Line 170 — BEFORE
if (this.#config.get('showRtRating', true) && rtRating) {

// AFTER
if (this.#config.get('showRtRating', true) && rtRating != null) {
```

```js
// Line 177 — BEFORE
if (this.#config.get('showMcRating', true) && mcRating) {

// AFTER
if (this.#config.get('showMcRating', true) && mcRating != null) {
```

- [x] **Step 4: Run all tests in the file to verify they pass**

```
npx vitest run tests/unit/core/overlay.test.js
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/overlay.js tests/unit/core/overlay.test.js
git commit -m "fix(overlay): use != null checks to preserve zero ratings"
```

---

### Task 5: Guard `null` element in `parseRatings`

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "`parseRatings` can throw on a `null` array element"

**Files:**

- Modify: `src/core/api-clients.js:37`
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Produces: `parseRatings(ratings, sourcePattern)` (module-private) — no longer throws when `ratings` contains `null` or `undefined` elements; tested via `OmdbApiClient.fetch`

- [x] **Step 1: Add a failing test to `tests/unit/core/api-clients.test.js`**

`OmdbApiClient` is already imported at the top of that file. Add a new `describe` block after the existing ones:

```js
describe('OmdbApiClient', () => {
    it('should not throw when the Ratings array contains a null element', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                Response: 'True',
                Title: 'Some Title',
                imdbID: 'tt1234567',
                imdbRating: '7.5',
                Year: '2020',
                Type: 'movie',
                Ratings: [null, { Source: 'Metacritic', Value: '80/100' }],
            }),
        });
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };
        const client = new OmdbApiClient(mockDisabledManager, mockAdapter, { get: () => 'apikey' }, createMockLogger());
        const result = await client.fetch('Some Title');
        expect(result).not.toBeNull();
        expect(result.mcRating).toBe(80);
    });
});
```

- [x] **Step 2: Run the new test to verify it fails**

```
npx vitest run tests/unit/core/api-clients.test.js
```

Expected: the new test FAILS with `TypeError: Cannot read properties of null`.

- [x] **Step 3: Implement the fix in `src/core/api-clients.js`**

```js
// Line 37 — BEFORE
const entry = ratings.find(r => sourcePattern.test(r.source || r.Source));

// AFTER
const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
```

- [x] **Step 4: Run all tests in the file to verify they pass**

```
npx vitest run tests/unit/core/api-clients.test.js
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "fix(api-clients): guard null element in parseRatings"
```

---

### Task 6: Guard `document.contains()` before overlay injection

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "No `document.contains()` guard before injecting the overlay"

**Files:**

- Modify: `src/core/app.js:109`
- Test: `tests/unit/core/app.test.js`

**Interfaces:**

- Produces: `FlixMonkeyApp.#decorateContainer` — skips `injectOverlay` if the container is no longer in the document when data resolves

- [x] **Step 1: Add a failing test to `tests/unit/core/app.test.js`**

Add the following import at the top of `tests/unit/core/app.test.js` (after existing imports):

```js
import { OverlayRenderer } from '../../../src/core/overlay.js';
```

Add inside the existing `describe('App', ...)` block (uses the same `beforeEach`/`afterEach` with `vi.useFakeTimers()`):

```js
it('should not inject overlay when container is removed from DOM before data resolves', async () => {
    let resolveData;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(
        new Promise(resolve => {
            resolveData = resolve;
        })
    );
    const injectSpy = vi.spyOn(OverlayRenderer.prototype, 'injectOverlay');

    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Detach Test</div>
        </div>
    `;

    appRef = startApp(createMockAdapter());

    // Advance fake timers so the setTimeout(resolve, 0) yield in #decorateContainer fires,
    // moving execution past the yield and into the getData await
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();

    // Detach the container before the data resolves
    document.body.innerHTML = '';

    // Now resolve the data — document.contains(container) is now false
    resolveData({ apiTitle: 'Detach Test', rating: 7.0 });
    await Promise.resolve();
    await Promise.resolve();

    expect(injectSpy).not.toHaveBeenCalled();
    injectSpy.mockRestore();
});
```

- [x] **Step 2: Run the new test to verify it fails**

```
npx vitest run tests/unit/core/app.test.js
```

Expected: the new test FAILS because `injectOverlay` is called even after the container is detached.

- [x] **Step 3: Implement the fix in `src/core/app.js`**

```js
// Lines 109-111 — BEFORE
if (!this.#renderer.hasOverlay(container)) {
    this.#renderer.injectOverlay(container, data);
    this.#renderer.applyFade(container, data, fadeable);
}

// AFTER
if (!this.#renderer.hasOverlay(container) && document.contains(container)) {
    this.#renderer.injectOverlay(container, data);
    this.#renderer.applyFade(container, data, fadeable);
}
```

- [x] **Step 4: Run all tests in the file to verify they pass**

```
npx vitest run tests/unit/core/app.test.js
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "fix(app): guard document.contains before overlay injection"
```

---

### Task 7: Normalize debug flag to handle string `"true"` from userscript host

**Spec:** `docs/superpowers/specs/2026-06-26-correctness-bugs-design.md` — "`debug` logging silently broken on userscript host"

**Files:**

- Modify: `src/core/logger.js:28`
- Test: `tests/unit/core/logger.test.js`

**Interfaces:**

- Produces: `Logger.debug(message, ...args)` — activates when `configGet('debug')` returns boolean `true` **or** string `"true"`

- [x] **Step 1: Add a failing test to `tests/unit/core/logger.test.js`**

Add inside the existing `describe('core/logger', ...)` block:

```js
it('should log debug when adapter returns string "true"', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ configGet: key => (key === 'debug' ? 'true' : undefined) });
    logger.debug('test debug from userscript');
    expect(spy).toHaveBeenCalledWith('[FlixMonkey] test debug from userscript');
    spy.mockRestore();
});

it('should not log debug when adapter returns string "false"', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ configGet: key => (key === 'debug' ? 'false' : undefined) });
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
});
```

- [x] **Step 2: Run the new tests to verify they fail**

```
npx vitest run tests/unit/core/logger.test.js
```

Expected: the `string "true"` test FAILS (strict `=== true` misses it); the `string "false"` test PASSES.

- [x] **Step 3: Implement the fix in `src/core/logger.js`**

```js
// Line 28 — BEFORE
if (this.#adapter.configGet('debug') === true) {

// AFTER
if (String(this.#adapter.configGet('debug')) === 'true') {
```

- [x] **Step 4: Run all tests in the file to verify they pass**

```
npx vitest run tests/unit/core/logger.test.js
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/logger.js tests/unit/core/logger.test.js
git commit -m "fix(logger): normalize debug flag to handle string \"true\" from userscript host"
```

---

## Final Verification

After all 7 tasks are committed:

- [x] **Run the full unit test suite**

```
npm run test:unit
```

Expected: all tests PASS, coverage thresholds met.
