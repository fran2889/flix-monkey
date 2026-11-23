# Test deduplication and defensive branch coverage

Date: 2026-11-23

Status: proposed

## Intent

The test suite still carries coverage that is not an exact duplicate but restates
the same behavior through a different fixture, and three settings-view tests loop
over every field so the first failure hides the rest. Four defensive branches in
`src/` are also uncovered. This change removes the restated coverage, isolates
field failures, and records an explicit decision for each uncovered branch. No
production behavior changes.

## Goals

- Prove each restated behavior once and keep every distinct assertion.
- Replace the three settings-view field loops with per-field cases.
- Cover the defensive branches a caller can reach or that form a response
  contract.
- Mark the one module-load invariant that cannot fail at runtime.
- Keep every production behavior unchanged and the suite above its current
  coverage thresholds.

## Non-goals

- No production behavior, timing, or public API changes.
- No tests for trivial accessors or shapes TypeScript already enforces.
- No work on integration tests, getter coverage, or files outside the inventory
  below.
- No change to coverage thresholds or source-file exclusions.

## Anti-goals

- Deleting a behavior assertion only to reduce the test count.
- Asserting an internal implementation detail instead of an observable result.
- Hiding an uncovered branch with an ignore hint when a real caller can reach it.

## Constraints

- Vitest 5.1 with the v8 coverage provider and jsdom.
- Tests use fake timers and advance them explicitly. Promise-only boundaries use
  the shared `flushAsyncWork()` helper from `tests/helpers/async.ts`.
- One top-level `describe` per file, behavior-oriented names in third-person
  present tense, and nested groups by behavior.
- Tests stay in `tests/unit/` because none of them load a streaming-service
  fixture.
- No `any`, explicit return types, sorted imports, and SPDX headers.
- The v8 provider honors `/* v8 ignore next */` and `/* v8 ignore start */` /
  `/* v8 ignore stop */` hints.

## Approaches

### Chrome and Firefox setup

- A. Extract the shared harness (chosen). Move listener capture, fake timers, the
  never-resolving `fetch`, and the `AbortController` stub into one helper. The
  two entry points keep their own behavior tests because their message contracts
  differ: Chrome returns a boolean and calls `sendResponse`; Firefox returns a
  promise. This removes the copied setup without hiding the difference.
- B. Leave the copied setup. Nothing behavioral is duplicated today, so the cost
  is only maintenance. Rejected because the setup is long enough to drift and it
  was the remaining shared pattern.

### Settings-view field loops

- A. Per-field `it.each` (chosen). Each field becomes its own case, so a failure
  names the field and later fields still run. About 51 cases replace three tests.
  The view renders in milliseconds under jsdom, so the case count is cheap.
- B. Aggregate mismatch list. Keep three tests and collect every bad field before
  asserting, so one failure lists all of them. Rejected because it invents a
  custom assertion style the rest of the suite does not use and still stops at
  the first non-field problem.

### Defensive branches

- A. Cover reachable branches and ignore the invariant (chosen). The request
  queue guard is reachable through `clear()` during a processing pass, the
  settings-view fallback is reachable before the first render, and the Chrome
  worker catch is the listener's response contract when the proxy rejects. The
  config-fields guard is a module-load check that cannot fail because the defaults
  map is built from the same field list; marking it is more honest than a
  contrived test.
- B. Ignore all four. Smaller diff, but it hides two reachable paths and the
  worker's error response from the suite.
- C. Leave them uncovered. Rejected because the gap stays invisible.

## Design

### 1. OMDb details tests prove one ID path

File: `tests/unit/core/api/omdb-api-client.test.ts`, group `details`.

Three tests drive `getDetails` with an IMDb ID and an absent `apiTitle`:

- `uses the ID endpoint when the title has an IMDb ID`
- `updates apiTitle from the OMDb response when the fallback has no apiTitle`
- `fetches details by IMDb ID for a cached title without an apiTitle`

They exercise the same early branch and the same successful response mapping. A
cached title is only a `Title` with a display title and an IMDb ID, which the
other two tests already build. Replace all three with one test that asserts the
ID endpoint URL, the updated `apiTitle`, the retained `displayTitle`, the IMDb
ID, and the rating. Keep `returns the title unchanged when it already has an
apiTitle`, which proves the other branch.

### 2. Cache read proves valid entries once

File: `tests/unit/core/cache/cache.test.ts`, group `read`.

- Merge the two valid-hit tests into one: `returns the cache entry on a hit` and
  `returns a cache entry with a title for valid data`. Assert a `CacheEntry`, its
  `Title`, the display title, the IMDb ID, the rating, and `isExpired === false`
  from one future expiry.
- Merge the two never-expiring tests into one parameterized test. The cases are
  an entry with no `expires` property and an entry with `expires: null`. Both
  normalize through `optionalNumber` to `undefined`, so they differ only in
  input. Assert the entry is defined, `isExpired === false`, the IMDb ID is
  undefined, and the title keeps its display title.

Keep `returns a title for an entry with empty title data`. Empty `data` is the
shape `clear()` writes for retained IMDb IDs, which the valid-entry test does not
cover. Keep the corrupt-entry, unknown-field, full-field, expired, and miss
tests.

### 3. Base health owns base behavior, providers keep their fallthrough

Files: `tests/unit/core/api/base-api-client.test.ts`,
`tests/unit/core/api/omdb-api-client.test.ts`, and
`tests/unit/core/api/xmdb-api-client.test.ts`.

The base `status` tests currently construct `XmdbApiClient`, so they depend on a
provider override. Move `StubClient` and `buildQueue` from the `request surface`
group to module scope in the base test file, and build the base status cases
from `StubClient`. The base cases then prove only the disabled-manager gate,
independently of any provider.

Each provider override still owns its own composition: it checks its API key and
then delegates to the base check. Keep one configured-key test per provider so
the `return super.getStatus()` fallthrough stays covered:

- OMDb: keep the configured-key test, which proves the fallthrough. Delete only
  the disabled-case test, which restates the base disabled result.
- XMDB: keep the missing-key test, and add a sibling that configures a key and
  expects the base healthy result.

No branch loses coverage, and no test restates another layer's behavior.

### 4. XMDB malformed details are proven once

File: `tests/unit/core/api/xmdb-api-client.test.ts`.

The `details` group already has a malformed-details table that asserts the
observable result and the warning for `null`, a wrong-typed title, and an empty
title. Remove the same three inputs from the details table under `response
parsing`:

- `a null body`
- `a non-string title`
- `an empty title`

Leave the remaining response-parsing rows, which cover distinct shapes: an empty
body, a non-string ID, a missing ID, an empty ID, a string rating, and a string
metascore.

### 5. One background harness for Chrome and Firefox

New helper: `tests/helpers/background-harness.ts`.

Export one function that:

- enables fake timers,
- resets `runtime.id`, `runtime.onInstalled.addListener`,
  `runtime.onMessage.addListener`, `runtime.openOptionsPage`, and
  `action.onClicked.addListener` on the supplied namespace mock,
- captures the three registered listeners,
- defines the namespace on `global` under `chrome` or `browser`,
- replaces `global.fetch` with a never-resolving `vi.fn()`, and
- installs the minimal `AbortController` stub the proxy needs.

Return the captured listeners typed as accepting `unknown[]` and returning the
promise-or-sync result the entry point produces. Chrome callers keep asserting
the synchronous boolean; Firefox callers keep awaiting the returned value. `vi.resetModules()` and the migration
executor reset stay in each test file because they are module-specific.

Use the helper in `tests/unit/targets/chrome/service-worker.test.ts` and
`tests/unit/targets/firefox/background.test.ts`. Do not merge their behavior
tests. Do not move the WebExtension `chrome` or `browser` mock objects, which
remain separate by design.

### 6. Settings-view cases name their field

File: `tests/unit/core/ui/settings-view.test.ts`.

Build `const settingFields = configFields.filter(isSettingField)` once. Replace
the three loops with `it.each(settingFields)`:

- `renders $key from its definition`: render an empty settings object and assert
  the label, input ID, input type, select options, and linked versus plain label.
  Action fields leave this group; the existing action-button, action-row, and
  mixed-row tests already cover them.
- `renders $key with its default`: render an empty settings object and compare the
  input value or checked state with `field.default`.
- `renders $key with its stored value`: derive one stored value for the field
  (`!default` for a checkbox, the first option that differs from the default for
  a select, and `stored-${key}` for text), render only that key, and compare.

The existing `uses configured defaults for optional rating fields` test stays;
it uses a local field subset and proves optional rating defaults, not the
full-list population.

### 7. Request queue proves a cleared pass drops its item

File: `tests/unit/core/request-queue.test.ts`, group `clear`.

Add one case that:

1. Runs a first request to completion on a zero interval.
2. Enqueues a second request against a storage adapter whose next `storageGet`
   returns a gated promise.
3. Calls `clear()` while that read is pending and releases it.
4. Asserts the second fetch never runs and the second promise rejects with
   `Client Disabled`.

This reaches the `shift()` empty guard because the processing pass resumed after
`clear()` removed the item. Use `flushAsyncWork()` to settle the pass. Attach the
rejection handler before the pass resumes so the rejection is never unhandled.

### 8. Settings view tolerates a read before render

File: `tests/unit/core/ui/settings-view.test.ts`, group `view state`.

Add one case that calls `readValues()` on a fresh view before `render()` and
expects `{}`. This reaches the missing-input fallback through the absent
container. Keep the existing disabled-field case, which proves the earlier
disabled return.

### 9. Chrome worker responds when the proxy rejects

File: `tests/unit/targets/chrome/service-worker.test.ts`.

Wrap the real `handleFetchMessage` in a `vi.fn` through
`vi.mock(..., importOriginal)`, so the forwarding tests keep the real handler.
Add a parameterized case for an `Error` rejection and a non-Error rejection that
asserts the listener returns `true` and calls `sendResponse({ ok: false, error })`
with the message or stringified value. This proves the listener's error contract
without pretending the real proxy can reject.

### 10. Config defaults guard is marked as an invariant

File: `src/core/config/config-fields.ts`.

Add a short comment and a `/* v8 ignore next 3 */` hint before the
`isCompleteSettingsMap(configDefaults)` check. The defaults map is built by
iterating `CONFIG_FIELDS` and copying every setting field's default, so the guard
cannot fail unless the field list and the map construction drift. The type
predicate still narrows `CONFIG_DEFAULTS`; only the runtime throw is ignored.

## Verification

- `npm run type-check`, `npm run lint`, and `npm run format:check` pass.
- `npm test` passes. The count is 1028: 982 today, minus two merged OMDb details
  tests, minus one merged cache valid-hit test, minus three XMDB duplicate rows,
  unchanged by moving one health test from OMDb to XMDB, plus 48 settings-view
  cases, one queue case, one pre-render view case, and two worker catch cases.
- `npm run test:coverage` clears the configured thresholds. The Chrome catch, the
  request-queue guard, and the settings-view fallback are covered; the
  config-fields guard is the only ignored region.
- `git diff -- src/` contains only the config-fields ignore comment.
- `npm run build` succeeds.

## Left to the builder

- Edit order and commit split.
- The exact function name and parameter shape of the background harness.
- Whether the cache never-expiring cases are `it.each` rows or two explicit
  tests, as long as the behavior is asserted once.
- Test names beyond the behavior and naming constraints above.
