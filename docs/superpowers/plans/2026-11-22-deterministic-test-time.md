# Deterministic Test Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every wall-clock wait, elapsed-time assertion, polling call under fake timers, and fixed microtask count from the affected tests while preserving all behavior assertions.

**Architecture:** Each affected file runs on Vitest fake timers and advances them explicitly. A shared `flushAsyncWork()` helper drains queued promise callbacks with `vi.advanceTimersByTimeAsync(0)`, without moving the clock.

**Tech Stack:** TypeScript, Vitest 5.1, jsdom.

**Spec:** `docs/superpowers/specs/2026-11-22-deterministic-test-time-design.md`

## Global Constraints

- No production code changes under `src/`.
- Preserve all 981 existing tests; do not remove or weaken behavior assertions.
- Every test that enables fake timers restores real timers in `afterEach`, or in a `finally` for a locally scoped test.
- Do not use `vi.waitFor` while fake timers are active.
- Do not use `Date.now()` arithmetic to measure elapsed test time.
- Do not use real `setTimeout` sleeps to settle async work.
- Do not use a fixed number of `await Promise.resolve()` calls to settle async work.
- Test files keep the SPDX header, one top-level `describe`, behavior-oriented names, and existing grouping.
- Conventional Commits, imperative, lowercase, no trailing period, no generated-by or co-author footers.

## Review Focus

- A deliberately pending lookup must not be advanced by `runAllTimersAsync()`, which would fire the 30 s timeout early and change the loading-overlay assertion. Owned by `app.test.ts` "injects a loading overlay while the lookup is in flight" and "renders a not-found fallback and logs when a lookup times out".
- Fake timers leaking into a later test would freeze `Date.now()` or hang real-time code. Owned by the `afterEach` and `finally` steps in every task.
- An entry-point IIFE still running after an assertion could make a test pass by accident and leak work into the next test. Owned by the flush after migration resolution and after import errors in `content`, `options`, and `userscript` entry tests.
- A pacing test that only proves the second call eventually happens would pass even if pacing were removed. Owned by the request-queue cross-instance boundary assertion.
- The cache chained-write test must still prove the third write has not started while the second is gated. Owned by `cache.test.ts` "keeps a later operation queued after an earlier one settles".

---

### Task 1: Shared flush helper and request-queue determinism

**Files:**

- Create: `tests/helpers/async.ts`
- Modify: `tests/unit/core/request-queue.test.ts`
- Test: `tests/unit/core/request-queue.test.ts`

**Interfaces:**

- Produces: `flushAsyncWork(): Promise<void>`. Requires fake timers to be active. Later tasks import it from `tests/helpers/async`.

- [ ] **Step 1: Create the branch and commit the approved documents**

```bash
git switch -c test/deterministic-test-time
git add docs/superpowers/specs/2026-11-22-deterministic-test-time-design.md \
        docs/superpowers/plans/2026-11-22-deterministic-test-time.md
git commit -m "docs: plan deterministic test time"
```

- [ ] **Step 2: Record the baseline**

Run: `npx vitest run tests/unit/core/request-queue.test.ts`
Expected: PASS with all current tests.

- [ ] **Step 3: Create `tests/helpers/async.ts`**

```ts
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/**
 * Flushes queued promise callbacks without moving the fake clock.
 *
 * Requires fake timers to be active.
 *
 * @returns A promise that resolves after pending async work has run.
 */
export async function flushAsyncWork(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}
```

- [ ] **Step 4: Put the whole request-queue file on fake timers**

Add `afterEach` and `beforeEach` to the Vitest import and import `flushAsyncWork` from `../../helpers/async`. Add at the top of the top-level `describe`:

```ts
beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});
```

Remove the inner `vi.useFakeTimers({ now: Date.now() })` and its `try`/`finally` from the pacing test.

- [ ] **Step 5: Replace the clear-test waits**

In both `clear` tests, after the active request is enqueued, replace `await vi.waitFor(...)` with `await flushAsyncWork()` and keep the existing assertions.

- [ ] **Step 6: Replace the storage-recovery waits**

In "recovers when a storage read fails during processing":

```ts
void queue.enqueue('url1', 1, firstFetch);
await flushAsyncWork();
expect(logger.warn).toHaveBeenCalledWith('RequestQueue pass aborted after a storage failure', {
    key: SYNC_KEY,
    pending: 1,
    err: expect.any(Error),
});
expect(firstFetch).not.toHaveBeenCalled();

void queue.enqueue('url2', 1, secondFetch);
await flushAsyncWork();
expect(secondFetch).toHaveBeenCalledOnce();
```

- [ ] **Step 7: Replace the priority and concurrency sleeps**

In "dispatches higher-priority requests first", enqueue all three, then:

```ts
await vi.advanceTimersByTimeAsync(interval * 2);
const results = await Promise.all([p1, p2, p3]);
expect(results).toHaveLength(3);
```

Keep the existing order assertion `['high', 'first', 'low']`.

In "resolves multiple concurrently enqueued requests", replace the `Promise.all` await with:

```ts
const first = queue.enqueue('https://example.com/a', 0, mockFetch);
const second = queue.enqueue('https://example.com/b', 0, mockFetch);
await vi.advanceTimersByTimeAsync(100);
const results = await Promise.all([first, second]);
```

- [ ] **Step 8: Replace the elapsed cross-instance measurement**

Rewrite "synchronizes across instances using storage" as:

```ts
it('synchronizes across instances using storage', async () => {
    let sharedTime = Date.now().toString();
    const mockAdapter = buildMockAdapter().build();
    mockAdapter.storageGet = vi.fn(async () => sharedTime);
    mockAdapter.storageSet = vi.fn(async (_k: string, v: string | boolean) => {
        sharedTime = v as string;
    });

    const interval = 100;
    const queue1 = buildQueue(interval, mockAdapter);
    const queue2 = buildQueue(interval, mockAdapter);
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });

    await queue1.enqueue('url1', 0, fetchFn);
    const second = queue2.enqueue('url2', 0, fetchFn);

    await vi.advanceTimersByTimeAsync(interval - 1);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(fetchFn).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 9: Flush the pacing test explicitly**

Replace the three `await vi.advanceTimersByTimeAsync(0)` calls in the pacing test with `await flushAsyncWork()`. Keep the `await vi.advanceTimersByTimeAsync(interval)` step.

- [ ] **Step 10: Run the file**

Run: `npx vitest run tests/unit/core/request-queue.test.ts`
Expected: PASS with every test and no test taking a real interval.

- [ ] **Step 11: Commit**

```bash
git add tests/helpers/async.ts tests/unit/core/request-queue.test.ts
git commit -m "test: run request queue tests on fake timers"
```

---

### Task 2: App test timer advancement

**Files:**

- Modify: `tests/unit/core/app.test.ts`
- Test: `tests/unit/core/app.test.ts`

**Interfaces:**

- Consumes: `flushAsyncWork()` from Task 1.
- Produces: nothing for later tasks.

- [ ] **Step 1: Import the helper and `LOOKUP_TIMEOUT_MS`**

Add `LOOKUP_TIMEOUT_MS` to the existing `constants` import and import `flushAsyncWork` from `../../helpers/async`.

- [ ] **Step 2: Replace waits in the navigation and mutation tests**

- "debounces navigation events": replace the initial `await Promise.resolve()` with `await flushAsyncWork()`; after the two `pushState` calls, replace `vi.advanceTimersByTime(5000)` plus `vi.waitFor(...)` with `await vi.runAllTimersAsync()` and assert `spy` was called.
- "decorates a card added by a DOM mutation": replace the `vi.waitFor(...)` after the observer trigger with `await vi.runAllTimersAsync()`.
- "redecorates when a container is replaced": replace the first `vi.waitFor(...)` after `startApp` with `await vi.runAllTimersAsync()`; replace the second `vi.waitFor(...)` after the trigger with `await vi.runAllTimersAsync()`.
- Leave "decorates on replaceState", "decorates only the mutated subtree when nodes are added", and "collects every mutated root in one observer batch" as they are; they already use explicit advancement.

- [ ] **Step 3: Keep the pending-lookup tests bounded**

- "injects a loading overlay while the lookup is in flight": replace `await Promise.resolve(); vi.runAllTimers()` with `await flushAsyncWork()`. After `resolveApi(...)`, replace the `vi.waitFor(...)` with `await flushAsyncWork()` and keep the two assertions.
- "does not inject an overlay when the container leaves the DOM before the data resolves": replace `vi.advanceTimersByTime(1); await Promise.resolve(); await Promise.resolve();` with `await flushAsyncWork()`. After `resolveData(...)`, replace the two `await Promise.resolve()` calls with `await flushAsyncWork()`.

- [ ] **Step 4: Replace waits in the decoration tests**

- "stamps data-fm-key on fadeable card containers after decoration": after `startApp`, replace the `vi.waitFor(...)` and the following `vi.runAllTimersAsync()` with one `await vi.runAllTimersAsync()`. Replace the final `vi.waitFor(...)` on `card.dataset.fmKey` with a direct assertion.
- "stamps data-fm-key on non-fadeable mini-modal containers for refresh support": same replacement, asserting the overlay and `dataset.fmKey` directly.

- [ ] **Step 5: Replace waits in the lookup-failure tests**

- "renders a not-found fallback when the lookup fails": replace `await Promise.resolve(); vi.runAllTimers(); await vi.runAllTimersAsync(); await vi.waitFor(...)` with `await vi.runAllTimersAsync()` and keep the three assertions.
- "renders a not-found fallback and logs when a lookup times out": replace `await Promise.resolve(); vi.runAllTimers(); await vi.advanceTimersByTimeAsync(31_000)` with `await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS + 1)`.
- "keeps a render failure out of the not-found fallback": replace `await vi.waitFor(...)` with `await vi.runAllTimersAsync()`.
- "clears the lookup timeout when a lookup resolves/rejects": keep `await vi.advanceTimersByTimeAsync(1)`.

- [ ] **Step 6: Replace waits in the service and fade tests**

- Each `%s surface wiring` case: replace `await vi.waitFor(...)` with `await vi.runAllTimersAsync()`.
- "renders a fade toggle badge in the mini-modal when enableFadeToggle is true": replace `await vi.waitFor(...)` with `await vi.runAllTimersAsync()`.
- "applies a stored "always" fade override to browse title cards on reload": replace `vi.advanceTimersToNextTimer()` plus `await vi.waitFor(...)` with `await vi.runAllTimersAsync()`.
- "cycles the fade toggle state on click and updates sibling cards": replace `vi.advanceTimersToNextTimer()` plus `await vi.waitFor(...)` with `await vi.runAllTimersAsync()`. Delete the local `waitForState` helper. After each `toggle.click()`, replace `await waitForState(...)` with `await flushAsyncWork()`.

- [ ] **Step 7: Replace waits in the override handlers**

- In `decorateAndCaptureActions`, replace `await vi.waitFor(...)` with `await vi.runAllTimersAsync()`.
- In "does not set an override or evict the cache and logs when editing the IMDb ID fails", replace `await vi.waitFor(...)` with `await flushAsyncWork()`.
- In "evicts the cache and logs when refreshing ratings fails", replace `await vi.waitFor(...)` with `await flushAsyncWork()`.

- [ ] **Step 8: Run the file**

Run: `npx vitest run tests/unit/core/app.test.ts`
Expected: PASS with no `vi.waitFor` and a lower duration than the recorded baseline.

- [ ] **Step 9: Commit**

```bash
git add tests/unit/core/app.test.ts
git commit -m "test: advance app timers explicitly"
```

---

### Task 3: Settings UI fake timers

**Files:**

- Modify: `tests/unit/core/ui/settings-ui.test.ts`
- Test: `tests/unit/core/ui/settings-ui.test.ts`

**Interfaces:**

- Consumes: `flushAsyncWork()` from Task 1.

- [ ] **Step 1: Enable fake timers for the file**

Add `afterEach` to the Vitest import and import `flushAsyncWork`. Add `vi.useFakeTimers()` at the start of `beforeEach` and `vi.useRealTimers()` in a new `afterEach`.

- [ ] **Step 2: Remove the per-test autosave timer setup**

In "saves through the view when a text input changes", delete the inner `vi.useFakeTimers()` / `try` / `finally`. Keep `await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 10)`.

- [ ] **Step 3: Replace the six real flushes**

In the `cache clearing` and `disabled provider reset` groups, replace every `await new Promise(resolve => setTimeout(resolve, 0))` with `await flushAsyncWork()`.

- [ ] **Step 4: Run the file**

Run: `npx vitest run tests/unit/core/ui/settings-ui.test.ts`
Expected: PASS with no real timer in the file.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/core/ui/settings-ui.test.ts
git commit -m "test: flush settings ui actions under fake timers"
```

---

### Task 4: Cache write-chain test

**Files:**

- Modify: `tests/unit/core/cache/cache.test.ts`
- Test: `tests/unit/core/cache/cache.test.ts`

**Interfaces:**

- Consumes: `flushAsyncWork()` from Task 1.

- [ ] **Step 1: Import the helper**

Add the `flushAsyncWork` import from `../../../helpers/async`.

- [ ] **Step 2: Scope fake timers to the chained-write test**

Wrap the body of "keeps a later operation queued after an earlier one settles" in:

```ts
vi.useFakeTimers();
try {
    // existing body
} finally {
    vi.useRealTimers();
}
```

Replace `await new Promise(resolve => setTimeout(resolve, 0))` with `await flushAsyncWork()` and keep the comment and `expect(calls).toBe(2)` assertion.

- [ ] **Step 3: Run the file**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/core/cache/cache.test.ts
git commit -m "test: flush chained cache writes deterministically"
```

---

### Task 5: Extension entry tests

**Files:**

- Modify: `tests/unit/targets/extension/content.test.ts`
- Modify: `tests/unit/targets/extension/options.test.ts`
- Test: both files

**Interfaces:**

- Consumes: `flushAsyncWork()` from Task 1.

- [ ] **Step 1: Enable fake timers in `content.test.ts`**

Add `afterEach` to the Vitest import and import `flushAsyncWork`. Add `vi.useFakeTimers()` in `beforeEach` before the first `await import(...)`. Add `afterEach(() => vi.useRealTimers())`.

- [ ] **Step 2: Replace content startup waits**

In `startAfterMigrations`, replace the two `await Promise.resolve()` calls with `await flushAsyncWork()`.

In "waits for migrations before reading storage and starting the app", replace the two `await Promise.resolve()` calls after `resolveMigrations({})` with `await flushAsyncWork()`, and replace the `vi.waitFor(...)` with a direct assertion that `startAppSpy` was called.

In "does not start the app or read storage and logs when migrations report an error", replace the `vi.waitFor(...)` with `await flushAsyncWork()` and keep the three assertions.

- [ ] **Step 3: Enable fake timers in `options.test.ts`**

Add `afterEach` to the Vitest import and import `flushAsyncWork`. Add `vi.useFakeTimers()` at the start of `beforeEach` and `afterEach(() => vi.useRealTimers())`.

- [ ] **Step 4: Replace options waits**

In "waits for migrations before rendering settings", replace the two `await Promise.resolve()` calls after `resolveMigrations({})` with `await flushAsyncWork()`.

In "does not render settings and logs when migrations report an error", replace the `vi.waitFor(...)` with `await flushAsyncWork()`.

- [ ] **Step 5: Run both files**

Run: `npx vitest run tests/unit/targets/extension/content.test.ts tests/unit/targets/extension/options.test.ts`
Expected: PASS with no `vi.waitFor` and no fixed tick pairs.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/targets/extension/content.test.ts tests/unit/targets/extension/options.test.ts
git commit -m "test: flush extension entry startup deterministically"
```

---

### Task 6: Chrome worker and Firefox background tests

**Files:**

- Modify: `tests/unit/targets/chrome/service-worker.test.ts`
- Modify: `tests/unit/targets/firefox/background.test.ts`
- Test: both files

**Interfaces:**

- Consumes: `flushAsyncWork()` from Task 1.

- [ ] **Step 1: Import the helper in both files**

Import `flushAsyncWork` from `../../../helpers/async` in each file. Both already enable fake timers in `beforeEach`.

- [ ] **Step 2: Replace Chrome fixed ticks and waits**

Replace every `await Promise.resolve()` and every `await vi.waitFor(...)` with `await flushAsyncWork()`.

Keep these assertions after the flush:

- install and update migration runs call `executeMigrations`.
- install rejection logs `Failed to run storage migrations`.
- migration messages respond with `{}` or `{ error: ... }`.
- fetch messages call `sendResponse` with the expected payload.
- the fetch-options case still asserts `setTimeoutSpy` was called with `1234`.
- action failure logs `Failed to open options page`.

- [ ] **Step 3: Replace Firefox fixed ticks**

For `installedListener`, replace the trailing `await Promise.resolve()` calls with `await flushAsyncWork()`.

For `messageListener` calls that are already awaited, delete the trailing `await Promise.resolve()` calls instead of replacing them, because awaiting the listener already drains its async work.

- [ ] **Step 4: Run both files**

Run: `npx vitest run tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts`
Expected: PASS with no fixed tick counts and no `vi.waitFor`.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts
git commit -m "test: flush extension worker startup deterministically"
```

---

### Task 7: Userscript entry test

**Files:**

- Modify: `tests/unit/targets/userscript/entry.test.ts`
- Test: `tests/unit/targets/userscript/entry.test.ts`

**Interfaces:**

- Consumes: `flushAsyncWork()` from Task 1.

- [ ] **Step 1: Enable fake timers**

Add `afterEach` to the Vitest import and import `flushAsyncWork`. Add `vi.useFakeTimers()` at the start of `beforeEach` and `afterEach(() => vi.useRealTimers())`.

- [ ] **Step 2: Replace startup waits**

In "waits for migrations before starting the app and registering the menu", replace the `vi.waitFor(...)` after `resolveMigrations()` with `await flushAsyncWork()` and keep the assertions.

In "does not start the app or register the menu and logs when migrations reject", replace the `vi.waitFor(...)` with `await flushAsyncWork()`.

- [ ] **Step 3: Replace settings-menu waits**

In all three `settings menu` tests, replace each `vi.waitFor(() => expect(adapter.registerMenuCommand).toHaveBeenCalled())` with `await flushAsyncWork()`.

In "calls renderSettings and logs when rendering the settings menu fails", replace the final `vi.waitFor(...)` after `menuCallback()` with `await flushAsyncWork()`.

- [ ] **Step 4: Run the file**

Run: `npx vitest run tests/unit/targets/userscript/entry.test.ts`
Expected: PASS with no `vi.waitFor`.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/targets/userscript/entry.test.ts
git commit -m "test: flush userscript startup deterministically"
```

---

### Task 8: Convention and full verification

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Document the convention**

Add one bullet under `## Testing`:

```markdown
- Control time with fake timers and advance them explicitly. Do not use real
  sleeps, elapsed-time assertions, fixed promise tick counts, or `vi.waitFor`
  while fake timers are active; use `advanceTimersByTimeAsync`,
  `runAllTimersAsync`, or the shared `flushAsyncWork()` helper for promise-only
  boundaries.
```

- [ ] **Step 2: Verify the affected files are clean**

Run:

```bash
rg "vi\\.waitFor|setTimeout\\(resolve" \
  tests/unit/core/request-queue.test.ts \
  tests/unit/core/app.test.ts \
  tests/unit/core/ui/settings-ui.test.ts \
  tests/unit/core/cache/cache.test.ts \
  tests/unit/targets/extension/content.test.ts \
  tests/unit/targets/extension/options.test.ts \
  tests/unit/targets/chrome/service-worker.test.ts \
  tests/unit/targets/firefox/background.test.ts \
  tests/unit/targets/userscript/entry.test.ts
```

Expected: no matches.

- [ ] **Step 3: Repeat the affected files five times**

Run:

```bash
for i in 1 2 3 4 5; do
  npx vitest run \
    tests/unit/core/request-queue.test.ts \
    tests/unit/core/app.test.ts \
    tests/unit/core/ui/settings-ui.test.ts \
    tests/unit/core/cache/cache.test.ts \
    tests/unit/targets/extension/content.test.ts \
    tests/unit/targets/extension/options.test.ts \
    tests/unit/targets/chrome/service-worker.test.ts \
    tests/unit/targets/firefox/background.test.ts \
    tests/unit/targets/userscript/entry.test.ts || exit 1
done
```

Expected: five consecutive passes.

- [ ] **Step 4: Run the full local gate**

Run: `npm run type-check && npm run lint && npm run format:check && npm test`
Expected: all pass, 981 tests, coverage above thresholds.

- [ ] **Step 5: Commit the convention**

```bash
git add AGENTS.md
git commit -m "docs: document deterministic test timing"
```

---

## Self-Review Notes

- Spec coverage: shared helper (Task 1), request-queue elapsed and real waits (Task 1), app polling (Task 2), settings-ui real flushes (Task 3), cache real flush (Task 4), entry tick counts (Tasks 5 to 7), worker tick counts (Task 6), convention (Task 8), untouched clean files (no tasks).
- No production files are modified.
- `flushAsyncWork` is the only cross-task interface; every task consumes it after Task 1.
- Verification steps cover type-check, lint, format, repeated runs, and the full suite.
