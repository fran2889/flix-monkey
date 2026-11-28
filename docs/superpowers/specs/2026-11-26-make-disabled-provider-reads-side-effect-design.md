# Make disabled-provider reads side-effect free

**Issue:** [#317 Make disabled-provider reads side-effect free](https://github.com/fran2889/flix-monkey/issues/317)
**Date:** 2026-11-23
**Status:** proposed
**Branch:** `fix/disabled-provider-reads-release` placeholder; use `fix/disabled-provider-reads`
**PR title:** `fix(api): make disabled-provider reads side-effect free`

## Intent

The disabled-provider circuit breaker has three defects in one small area:

1. `DisabledClientsManager.isDisabled()` (`src/core/disabled-clients.ts:24`) is a read that writes. When the stored marker is in the past it rewrites `fm_disabled_<source>` to `'0'`, even though an expired timestamp already reads as healthy. Every rating lookup therefore mutates storage, and a storage failure turns a healthy read into a rejected one.
2. The same method parses the marker with `Number.parseInt` and never inspects the result. A non-numeric value yields `NaN`, `NaN === 0` is false, and `Date.now() > NaN` is false, so the method returns true forever: the provider stays disabled until a human clears the key.
3. `BaseApiClient.fetch()` (`src/core/api/base-api-client.ts:97`) repeats the disabled check that `ApiClientManager.#fetch()` (`src/core/api-manager.ts:56`) already performed through `client.getStatus()`. Every lookup reads the marker twice.

The expected behavior is: an expired marker reads healthy with no storage write, a malformed marker is treated as zero and does not disable the provider, and a fetch performs exactly one disabled check through the manager's health gate.

The change is internal. The documented user-facing behavior is unchanged: a provider is disabled for one hour after a client error, and Debug > Reset Providers re-enables it.

## Goals

- `isDisabled()` performs no storage write, for any stored value.
- An expired, absent, `'0'`, non-string, or non-numeric marker reads as not disabled.
- One rating lookup performs exactly one disabled read, and it happens in the manager's `getStatus()` gate.
- Every existing behavior assertion still passes, with the single exception of the Agregarr test that proved the check being removed.
- Coverage thresholds (90) hold without a new test whose only purpose is coverage.

## Non-Goals

- Restoring the mid-fetch disabled guard between `search()` and `getDetails()` that issue #55 added and the 2026-10-02 clean-code refactor dropped. See Decisions.
- Changing `disable()` (duration, purging the queue) or `resetAll()` write policy.
- Deleting or normalizing stale keys at startup.
- Any cache behavior, TTL, or provider-selection change.
- README, CHANGELOG, or store-listing changes. release-please owns `CHANGELOG.md`.

## Anti-Goals

- Adding a second disabled read to prove the first one is unnecessary.
- Moving the `getStatus()` gate into `fetch()`. It also distinguishes an unhealthy provider from a not-found title, which is what keeps a disabled provider's miss out of the cache (`tests/unit/core/api-manager.test.ts`, `skips an unhealthy client and does not cache the result`).
- Failing closed on a malformed marker, which would keep the provider locked out until the key is cleared by hand.
- Replacing one write path with another, such as deleting the key when an expired marker is seen.

## Constraints

Code and storage:

- `storageGet` returns `StorageValue | undefined`, and `StorageValue` is `string | boolean` (`src/platform/adapter.ts:6`). A non-string value is reachable in principle, so the read must handle it.
- The marker's stored shape does not change: still a decimal string, still `'0'` for "not disabled". No `fm_data_version` migration is required, and none may be added for a non-shape change.
- Exactly one production caller of `ApiClient.fetch()` exists, `src/core/api-manager.ts:62`. Exactly one caller of `getStatus()` exists, `src/core/api-manager.ts:56`. Exactly one caller of `resetAll()` exists, `src/core/ui/settings-ui.ts:101`. `disable()` is the only other writer of the marker.
- `isDisabled()` is called from `BaseApiClient.#isDisabled()` (`src/core/api/base-api-client.ts:124`) and from `resetAll()` (`src/core/disabled-clients.ts:62`).
- `OmdbApiClient.getStatus()` and `XmdbApiClient.getStatus()` override the base method to add an API-key check, then call `super.getStatus()`. The base gate is the only disabled read they inherit; removing the `fetch()` check does not affect them.
- The integration suite (`tests/integration/api-clients.test.ts`) calls `client.fetch()` directly with a `DisabledClientsManager` whose `storageGet` always returns `'0'`, so it bypasses the gate and is unaffected.

Repo conventions that bind the change:

- Exported declarations carry JSDoc with `@param` and `@returns`; private helpers carry none.
- SPDX header on every `{src,tests}/**/*.ts` file, unchanged in place.
- `complexity` and `sonarjs/cognitive-complexity` at 10 (`eslint.config.js:17-18`). The new code is two branches per method.
- Member order follows step-down order: callers before callees, accessors last.
- Tests: one top-level `describe` per file, behavior-stated names in third-person present tense, `it.each` for repeated cases, no assertions that only exist to raise coverage.
- Conventional Commits via commitlint; no `Generated by` or `Co-Authored-By:` footers.
- The design doc is committed under `docs/superpowers/specs/`, date-prefixed, before the code commit.

## Approaches Considered

### A. Fix only `DisabledClientsManager`

Add the `NaN` guard and keep the expired-marker rewrite; leave both disabled checks in place.

Rejected. It fixes the stuck-provider bug but the issue's first and third expectations remain unmet: the read still writes, and a lookup still reads the marker twice.

### B. Pure read in the manager, drop the check inside `fetch()` (chosen)

`DisabledClientsManager.isDisabled()` becomes a pure read over a private parse helper. `BaseApiClient.fetch()` loses its leading `#isDisabled()` check; the private helper stays behind `getStatus()`, which becomes its only caller. `ApiClientManager` is untouched, so its gate keeps filtering before `fetch()` and keeps a disabled provider's miss out of the cache.

Chosen because it is the only arrangement that satisfies all three expectations at once. It concentrates the parse policy in one place, deletes a redundant check instead of adding coordination, and leaves the cache invariant that already has a test.

### C. Move the gate into `fetch()`

Have `fetch()` call `getStatus()` itself and remove the manager gate.

Rejected. `fetch()` returns `Title | undefined`, which cannot distinguish "provider unhealthy" from "title not found". The manager would cache a disabled provider's miss, which the current test explicitly forbids. It also reads the marker once per lookup anyway, so it does not reduce the count.

## The Chosen Design

### `src/core/disabled-clients.ts`

Add a private reader that returns a number and place it directly after its only caller, then reduce `isDisabled()` to a single comparison:

```ts
async isDisabled(source: ApiSourceType): Promise<boolean> {
    return (await this.#disabledUntil(source)) > Date.now();
}

async #disabledUntil(source: ApiSourceType): Promise<number> {
    const stored = await this.#adapter.storageGet(this.#key(source));
    if (typeof stored !== 'string') return 0;
    const parsed = Number.parseInt(stored, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}
```

Member order after the change: `isDisabled()`, `#disabledUntil()`, `#key()`, `disable()`, `resetAll()`. `#disabledUntil()` calls `#key()`, so step-down order puts it between the two, ahead of `disable()`.

`isDisabled()` JSDoc must state the contract a caller cannot see: it is read-only, and an absent, `'0'`, non-string, non-numeric, or already-expired marker all read as not disabled. The `#disabledUntil()` helper gets no JSDoc.

Behavior table:

| Stored `fm_disabled_<source>`   | Parsed     | `isDisabled()`       | Storage write                |
| ------------------------------- | ---------- | -------------------- | ---------------------------- |
| absent (`undefined`)            | 0          | false                | none                         |
| `'0'` (written by `resetAll()`) | 0          | false                | none                         |
| future timestamp                | expiry     | true                 | none                         |
| past timestamp                  | past       | false                | none, previously wrote `'0'` |
| `'abc'`                         | `NaN` to 0 | false                | none, previously stuck true  |
| `'12abc'`                       | 12         | false (long expired) | none                         |
| `'Infinity'`                    | `NaN` to 0 | false                | none                         |
| `'-5'`                          | -5         | false                | none                         |
| `true` (boolean)                | 0          | false                | none                         |

`disable()` and `resetAll()` are unchanged. `resetAll()` still writes `'0'` only for sources that are currently disabled, so the `Re-enabled API clients:` list at `src/core/ui/settings-ui.ts:101` keeps its meaning: an expired or malformed marker already read healthy and is not reported. The next `disable()` overwrites the stale key.

### `src/core/api/base-api-client.ts`

Delete the opening check in `fetch()`:

```ts
async fetch(displayTitle: string, imdbId?: string): Promise<Title | undefined> {
    const overrideId = await this.#overrideManager.getImdbId(displayTitle);
    // ... unchanged pipeline
}
```

Keep `#isDisabled()` (`:124`) as the private helper behind `getStatus()` (`:128`), which becomes its only caller. Step-down order then places `#isDisabled()` after `getStatus()`, so it moves down one member. `disable()` and the accessors stay where they are.

Documentation that must change, because the current text names a short circuit that no longer exists:

- `BaseApiClient.fetch()` JSDoc says "Applies the ID override and disabled-client short circuits". It must describe the override short circuit only, state that the client performs no disabled check of its own, and state that a caller must gate through `getStatus()` first. The dependency is a real contract for the next caller, not a detail.
- `ApiClient.fetch` (`:44`) already says "Callers must gate through `getStatus` before invoking". Strengthen it to name the consequence: the client performs no disabled check, so an ungated call proceeds even while the provider is disabled.

### Untouched

`src/core/api-manager.ts`. The gate at `:56` is correct and necessary; the issue asks for one check, and one check is what remains.

## Interfaces That Change

| Surface                                        | Before                                                                     | After                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `DisabledClientsManager.isDisabled(source)`    | Reads the marker, writes `'0'` on expiry, can return true forever on `NaN` | Reads the marker. No write. Absent, `'0'`, non-string, non-numeric, and expired all read false |
| `DisabledClientsManager#disabledUntil(source)` | Does not exist                                                             | Private. Returns 0 or the parsed expiry                                                        |
| `ApiClient.fetch(displayTitle, imdbId?)`       | Perform a disabled check, then the override and search, then details       | Performs no disabled check. A caller must gate through `getStatus()`                           |
| `BaseApiClient.fetch(...)`                     | Same as the interface                                                      | Same as the interface. JSDoc names the removed short circuit                                   |
| `BaseApiClient.getStatus()`                    | Calls `#isDisabled()`                                                      | Unchanged, and now the only caller of `#isDisabled()`                                          |
| `ApiClientManager.#fetch(...)`                 | Gates through `getStatus()`, then `fetch()`                                | Unchanged. Still the single disabled read per lookup                                           |
| Storage shape of `fm_disabled_<source>`        | Decimal string, `'0'` or a timestamp                                       | Same. No migration                                                                             |

User-observable change: a provider whose marker was corrupted becomes usable again without a manual reset, and a provider disabled at any point no longer causes a storage write on every lookup.

## Decisions

1. **`isDisabled()` never writes.** It parses the marker and compares it to now. A missing, non-string, non-numeric, or expired marker reads healthy. The expiry is already encoded in the timestamp, so nothing needs normalizing on read, and the write is what makes a healthy read able to fail.
   Alternatives rejected: keep the write and only add the `NaN` guard (leaves two of three expectations unmet); move cleanup to startup or into `disable()` (same storage mutation, extra code path); `storageDelete` the expired key (a write by another name, and the next `disable()` overwrites it anyway).

2. **A malformed marker fails open.** `Number.parseInt` plus `Number.isNaN` maps garbage to 0 and never rewrites the stored value. The issue says a malformed marker is treated as zero; failing open keeps ratings working instead of locking the provider out until someone clears the key.
   Alternatives rejected: fail closed (the reported bug); delete the malformed key when seen (puts the write back in the read path); `Number()` instead of `Number.parseInt` (accepts `'0x10'` as 16 and `''` as 0, and diverges from the two existing readers below).

3. **Parse idiom is `Number.parseInt(value, 10)` plus an explicit `Number.isNaN` check.** `RequestQueue#getLastGlobalRequestTime` (`src/core/request-queue.ts:105`) and `ConfigManager.getInt` (`src/core/config/config-manager.ts:61`) already use exactly this shape for a stored timestamp and a stored number. A numeric prefix such as `'12abc'` parses to 12, which reads as long expired, so the loose prefix is harmless here.
   Alternative rejected: `Number(raw)`.

4. **Comparison is `expiry > Date.now()`.** A marker whose expiry equals the current millisecond reads healthy. This is the simplest expression of "an expired timestamp already reads as healthy"; the one-millisecond boundary has no practical effect.
   Alternative rejected: `Date.now() <= expiry`, which reports disabled at the exact expiry millisecond.

5. **The single check lives in `ApiClientManager`.** `#fetch()` keeps its `getStatus()` gate; `BaseApiClient.fetch()` drops its check and documents the requirement. The gate cannot move into `fetch()` because `fetch()` cannot report health separately from a miss, and caching a disabled provider's miss is forbidden by an existing test.
   Alternatives rejected: `fetch()` calls `getStatus()` itself (still two reads, or a cached-miss regression); keep both checks and fix only the manager (two reads per lookup); remove the gate and let `fetch()` report health (cache regression).

6. **The mid-fetch guard is not restored.** Issue #55 once checked `isDisabled()` between `search()` and `getDetails()`; the 2026-10-02 refactor dropped it while re-adding the leading check. Restoring it would add a second read per lookup and contradict the issue. Whether a `disable()` during a lookup should abort that lookup is a separate behavioral question and deserves its own issue.

7. **`resetAll()` write policy is unchanged.** It writes `'0'` only for sources that are currently disabled, and neither reports nor rewrites an expired or malformed marker. It is an explicit user action, so its writes are not part of the problem, and the existing tests already assert one write per genuinely disabled source.
   Alternatives rejected: normalize expired and malformed keys during reset; delete keys instead of writing `'0'`; report expired markers as re-enabled.

8. **The Agregarr test `does not fetch when the client is disabled` is deleted** (`tests/unit/core/api/agregarr-api-client.test.ts:490`). It only proved the leading check being removed, and the manager-level test `skips an unhealthy client and does not cache the result` already proves a disabled provider is never fetched. Its intent moves to two counting assertions, described under Testing.
   Alternatives rejected: keep it and stub `getStatus` on the instance (proves a contract the client no longer has); pin the read count only through the manager with a real client and adapter (heavier, and the manager test already uses a stub client).

9. **The read-count chain is proven in both links, and the base-client status test needs a new assertion to do it.** `tests/unit/core/api/base-api-client.test.ts` status tests assert the result but never count calls, so "one read per lookup" is only half proven by the new fetch test. The existing disabled-status test gains `expect(mockDisabledManagerForTest.isDisabled).toHaveBeenCalledOnce()`, which is legitimate because it is the same behavior the test already proves, now pinned. This corrects an assumption in the brainstorm result that those tests already counted.

10. **The exact-millisecond boundary is not tested.** Pinning `expiry > Date.now()` versus `<=` needs a pinned clock, and mixing `vi.useFakeTimers()` with the file's relative `Date.now() +- 5000` cases costs more than the assertion is worth. The comparison is documented in JSDoc and in this record. The alternative, one `it.each` with `vi.useFakeTimers()` and `vi.setSystemTime()` plus restore in `afterEach` per the deterministic-time spec, is available if review asks for it.

11. **No README change, no migration, no new dependency.** The user-facing description stays true: one hour of auto-disable after client errors, and Debug > Reset Providers re-enables providers. No persisted shape changes, so `fm_data_version` stays put.

12. **Commit mechanics.** The worktree has no configured git identity, and the previous run on this issue failed with `Author identity unknown`. Pass the author per invocation, `git -c user.name=coder-bee -c user.email=coder-bee@users.noreply.github.com commit ...`, rather than mutating repo or global config, and add no `Generated by` or `Co-Authored-By:` footer.

## Testing

Four test files change. Names below are the behaviors the tests prove.

`tests/unit/core/disabled-clients.test.ts` (7 `it` blocks today): collapse the present, expired, and absent cases plus the new malformed cases into one `it.each` in the top-level `DisabledClientsManager` describe. Each case asserts the boolean and, for every case, `expect(mockAdapter.storageSet).not.toHaveBeenCalled()`. `beforeEach` already builds a fresh adapter and manager, so the spy is clean per case.

- `it.each`: a missing marker, `'0'`, an unexpired marker, an expired marker, `'abc'`, `'12abc'`, `'Infinity'`, and a stored `true` all read as expected and write nothing. Titles interpolate, for example `reports %s as %s without writing to storage`.
- Keep `disables a source and stores its expiry`, `resets all disabled clients and returns their names`, `resets every client in ApiSource order`, and `stops at the first storage error during reset` unchanged. All four still hold: they assert one `storageSet` per genuinely disabled source and never asserted a write from the read.

`tests/unit/core/api/base-api-client.test.ts`:

- New test in `describe('fetch')`: `performs no disabled check of its own`. Build a fresh `DisabledClientsManager` stub with `isDisabled: vi.fn().mockResolvedValue(true)`, the value that would short-circuit if the check were still present, and pass it as `deps.disabledManager`. Stub `search` to resolve `undefined` or resolve a `Title` so no network is involved, run `fetch`, and assert `expect(disabledManagerForTest.isDisabled).not.toHaveBeenCalled()`. The file-level `mockDisabledManager` is shared and already exercised by the status tests, so the fresh spy is required.
- Existing `returns an unhealthy status when the client is disabled` gains `expect(mockDisabledManagerForTest.isDisabled).toHaveBeenCalledOnce()` (Decision 9).

`tests/unit/core/api-manager.test.ts`:

- New test in `describe('fetching')`: `checks provider health once per lookup`. Stub a healthy client whose `fetch` resolves a `Title`, await `manager.getData(...)`, and assert `expect(mockClient.getStatus).toHaveBeenCalledOnce()`. With the base-client test above, this closes the chain: one `getStatus()` per lookup, one `isDisabled()` per `getStatus()`.

`tests/unit/core/api/agregarr-api-client.test.ts`:

- Delete `does not fetch when the client is disabled` (`:490`, inside `describe('override handling')`). Nothing else in the file depends on it; `DisabledClientsManager` stays imported for the other cases.

Expected effect: `disabled-clients` goes from 7 `it` blocks to 5 with 3 extra parameterized cases; `base-api-client` gains one test and one assertion; `api-manager` gains one test; `agregarr` loses one.

Verification, in order, as the repo's pre-PR check:

```bash
npm run type-check && npm run lint && npm run format:check && npm run build && npm run test:coverage
```

No README or doc-link change, so `lychee` and the doc-links gate are unaffected. `docs/superpowers/specs/` gains one file.

## Residual Risks

- **A disable that lands between the gate and the pipeline is no longer caught.** If the marker is set after `getStatus()` returns healthy and before `fetch()` runs, the lookup proceeds. Before this change the check inside `fetch()` narrowed that window; now nothing does. The window is one microtask per lookup, `disable()` purges the queue, and the same exposure already exists between `search()` and `getDetails()` (Decision 6). Accepted, with the mid-fetch guard as its own follow-up.
- **`ApiClient.fetch()` is now unsafe to call ungated.** Only `src/core/api-manager.ts:62` does so in production, but the interface is exported and mocked in five test files. A future caller that forgets the gate gets requests to a disabled provider with no error. Mitigated by JSDoc on both the interface member and the implementation; not enforced by the type system, because there is no type-level way to require it short of a token argument.
- **Stale markers are never cleaned up.** An expired or malformed `fm_disabled_<source>` key stays in storage until the next `disable()` or a manual reset. Bounded to one short string per provider, and harmless because reads no longer care. Accepted.
- **A corrupted marker silently re-enables a provider the user believes is disabled.** That is the intended fail-open policy, and it can surprise someone who disabled a provider by tampering with storage. It is strictly better than the reported stuck-forever state.
- **The one-millisecond boundary is unverified by tests** (Decision 10). A future edit to `>=` would pass the suite. Accepted for a boundary with no practical effect.
- **Coverage could dip if a case is dropped rather than collapsed.** The boolean and `Date.now()` branches in `isDisabled()` are both exercised by the `it.each` and by `resetAll()`. The `typeof stored !== 'string'` branch needs the stored-`true` case to stay covered at the 90 threshold; do not drop that case when editing the table.
- **`npm run audit` is omitted from the local sequence above** because the change adds no dependency; run it if the PR gate reports a difference.

## Process

1. Write this document to `docs/superpowers/specs/2026-11-23-disabled-provider-reads-design.md`, using the actual commit date in the filename, and commit it first: `git -c user.name=... -c user.email=... commit -m "docs(specs): record the disabled-provider reads design"`. Note: the scope matches the changed directory's final name, and the doc commit lands on the same branch as the fix.
2. Implement the two production files and the four test files in one commit: `fix(api): make disabled-provider reads side-effect free`. Scope `api` because the dominant behavior change is in the provider health path, matching recent history for this area; the brainstorm considered `core` (where `disabled-clients.ts` lives) and `api-clients` (the earlier #55 title) and settled on `api`.
3. Branch name `fix/disabled-provider-reads`, 3 words, prefix matching the title type.
4. The PR body restates the problem and the three behaviors in its own words rather than citing this document, per the repo's issue and PR body rule, within the 1000-character cap.
