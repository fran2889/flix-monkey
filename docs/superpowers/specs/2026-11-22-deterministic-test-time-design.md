# Deterministic test time

Date: 2026-11-22

Status: accepted

## Intent

Finish the timing cleanup tracked in
[`docs/reviews/2026-11-22-test-cleanup-remaining.md`](../../reviews/2026-11-22-test-cleanup-remaining.md)
and extend it to every affected test. Tests should prove behavior with a clock
we control, not with wall-clock waits, elapsed measurements, polling, or fixed
microtask counts.

The report is a starting point, not the full list. A rescan found real sleeps in
`request-queue`, `settings-ui`, and `cache`, fixed tick counts in the entry and
worker tests, and 19 `vi.waitFor` calls under global fake timers in `app.test.ts`.

## Goals

- No elapsed-time assertions such as `end - start >= interval`.
- No real timer sleeps used to settle async work or pace requests.
- No `vi.waitFor` while fake timers are active.
- No fixed `Promise.resolve()` tick counts.
- Preserve every existing behavior assertion and the 981-test count.
- Record the convention so the pattern does not return.

## Non-goals

- No production code changes and no new seams in `src/`.
- No removal or merger of tests beyond what determinism requires.
- No work on the report's other open sections: duplicate coverage, broad loop
  tests, defensive branches, or getter coverage.
- Integration tests stay out of scope; they need live API keys.

## Anti-goals

- Replacing one brittle wait with another timeout.
- Hiding the mechanism behind a helper that silently falls back to real time.
- Weakening or deleting assertions to reach green.

## Constraints

- Vitest 5.1 with jsdom. `vi.waitFor` advances fake timers inside its check
  loop and still polls on a real interval, which is the combination to remove.
- `vi.runAllTimersAsync()` fires every pending timer. Tests that deliberately
  leave a lookup pending must not use it, because it fires the 30 s lookup
  timeout.
- Fake timers must be restored after every test that enables them.
- Test files keep the SPDX header, one top-level `describe`, behavior names,
  and the existing grouping conventions.

## Approaches

### A. Own the clock (chosen)

Every affected file runs on fake timers. Timer-driven behavior is stepped
explicitly with `advanceTimersByTimeAsync`, `runAllTimersAsync`, or
`advanceTimersToNextTimerAsync`. Promise-only boundaries use one shared
`flushAsyncWork()` helper built on `vi.advanceTimersByTimeAsync(0)`. Elapsed
assertions become boundary assertions.

Chosen because it removes wall-clock dependence completely, makes the tested
step explicit, and keeps the shared flush honest about requiring fake timers.

### B. Assert on effects

Keep real timers and replace every fixed tick, real flush, and `waitFor` with
`vi.waitFor(() => expect(effect))`. Use fake timers only for the request-queue
interval boundary.

Rejected: the diff is smaller and tolerant of new `await`s, but it still polls
on real time, keeps timeout failures, and preserves the fake-timer plus
`waitFor` combination the report flagged.

### C. Wrap the mechanism

Add async helpers and convert call sites gradually.

Rejected: consistent, but it hides whether a wait uses fake or real time,
which is the distinction this change exists to make visible.

## Design

### Shared flush

Add `tests/helpers/async.ts` exporting `flushAsyncWork(): Promise<void>`, which
awaits `vi.advanceTimersByTimeAsync(0)`. `tickAsync` yields to the event loop
before running timers, so queued promise callbacks run without moving the
clock. The helper documents that fake timers must be active and throws through
Vitest otherwise.

### Per-file changes

- `tests/unit/core/request-queue.test.ts`
    - Enable fake timers for the file and remove the per-test timer setup in the
      pacing test.
    - Replace real `waitFor` in the clear and storage-recovery tests with
      `flushAsyncWork()`.
    - Replace the priority, concurrent-enqueue, and cross-instance sleeps with
      interval stepping. The cross-instance case asserts no second fetch at
      `interval - 1` and a second fetch at `interval`.
    - Delete the `Date.now()` start and end measurement.
- `tests/unit/core/app.test.ts`
    - Replace every `vi.waitFor` with explicit timer advancement:
      `flushAsyncWork()` for the 0 ms yield, and `runAllTimersAsync()` where the
      full decoration chain may run.
    - Keep the pending-lookup tests on bounded advancement so the 30 s timeout
      does not fire early: the in-flight loading test advances by 0, and the
      timeout test advances past `LOOKUP_TIMEOUT_MS`.
    - Replace fixed `Promise.resolve()` pairs and `vi.runAllTimers()` calls with
      the same advancement helpers.
    - Replace the fade-toggle state polling with a flush after each click.
- `tests/unit/core/ui/settings-ui.test.ts`
    - Enable fake timers for the file and replace the six real `setTimeout(0)`
      flushes with `flushAsyncWork()`.
    - Drop the per-test fake-timer setup from the autosave case.
- `tests/unit/core/cache/cache.test.ts`
    - In the chained-write test, enable fake timers for that case and flush with
      `flushAsyncWork()` instead of a real `setTimeout(0)`, preserving the check
      that a third write does not start while the second is gated.
- `tests/unit/targets/extension/content.test.ts` and `options.test.ts`
    - Enable fake timers and replace both the fixed tick pairs and the real
      `waitFor` calls with `flushAsyncWork()` after resolving migrations.
- `tests/unit/targets/chrome/service-worker.test.ts`
    - Replace fixed tick counts and the two `waitFor` calls with
      `flushAsyncWork()`.
- `tests/unit/targets/firefox/background.test.ts`
    - Replace fixed tick counts with `flushAsyncWork()`.
- `tests/unit/targets/userscript/entry.test.ts`
    - Enable fake timers and replace real `waitFor` calls with
      `flushAsyncWork()` after migration resolution, menu callbacks, and render
      failures.
- Leave `webextension`, `fetch-proxy`, `overlay-elements`, `settings-view`,
  and `general-utils` unchanged; they already use fake timers without polling.

### Convention

Add one Testing bullet to `AGENTS.md`: tests control time with fake timers and
advance them explicitly. Do not use real sleeps, elapsed-time assertions, fixed
promise tick counts, or `vi.waitFor` while fake timers are active. Use the
shared flush for promise-only boundaries.

## Verification

- `grep` the affected files for `setTimeout(resolve`, `vi.waitFor`, and
  `Date.now()` elapsed arithmetic, and confirm none remain.
- Run the affected files repeatedly, then the full unit and UI suite.
- Run type-check, lint, and Prettier.
- Confirm the suite still reports 981 passing tests and coverage stays above
  thresholds.

## Left to the builder

The test-by-test order, commit split, and any local helper that keeps one file
readable. If a test resists deterministic advancement because production code
depends on an uncontrollable boundary, stop and report it instead of adding a
timeout.
