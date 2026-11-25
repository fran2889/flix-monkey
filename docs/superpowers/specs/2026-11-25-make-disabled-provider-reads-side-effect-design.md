# Make disabled-provider reads side-effect free

**Issue:** [#317 Make disabled-provider reads side-effect free](https://github.com/fran2889/flix-monkey/issues/317)
**Date:** 2026-11-23
**Status:** proposed
**Size:** small change

## Intent

A provider's disable marker lives in the `fm_disabled_<source>` storage key as a numeric string (a millisecond timestamp written by `DisabledClientsManager.disable()`). Reading it must answer one question: is the lockout still active? Today three things go wrong around that read:

1. `DisabledClientsManager.isDisabled()` (`src/core/disabled-clients.ts:24-34`) writes `'0'` back to storage when it finds an expired marker. Expiry is derived state, so the write changes nothing that the timestamp and the clock did not already answer, and in the extensions every such write fires `storage.onChanged` in other tabs (`src/targets/extension/content.ts:52`).
2. A malformed marker parses to `NaN`. `NaN === 0` is false and `Date.now() > NaN` is false, so the provider reads disabled forever, with no UI path that reports or clears it other than the user wiping the key by hand.
3. One rating lookup reads the key twice: `ApiClientManager.#fetch` (`src/core/api-manager.ts:55-58`) gates through `client.getStatus()`, and `BaseApiClient.fetch()` (`src/core/api/base-api-client.ts:96-99`) repeats the same check through `#isDisabled()`.

The fix makes the read read-only, makes a malformed value inert, and gives the disabled gate a single owner. It restores a decision this repository already made: `docs/superpowers/specs/2026-06-27-correctness-and-contract-fixes-design.md` item 2 removed the check from `fetch()` and left the JSDoc contract "Callers must gate through `getStatus` before invoking" (`src/core/api/base-api-client.ts:44`). The code regained the check during the later `fetch()` rewrites, so the documented contract and the implementation disagree. This change brings them back into agreement instead of inventing a new rule.

## Goals

- `isDisabled()` performs no storage write on any input, including an expired marker.
- A malformed, absent, `'0'`, or expired marker all read as healthy; a malformed marker never leaves a provider disabled.
- One rating lookup performs exactly one read of the `fm_disabled_<source>` key, owned by the manager's health gate.
- The JSDoc on `isDisabled()` and `fetch()` describes what the code actually does.
- Behavior visible to a user is unchanged apart from the bugs above: a provider still auto-disables for `CLIENT_DISABLE_DURATION` after a 4xx, the settings Reset Providers action still reports and clears active lockouts, and "No API key configured" still reports unhealthy.

## Non-goals

- Not changing the storage format of `fm_disabled_*`, and not adding a migration or an `fm_data_version` bump. These keys are not part of the versioned cache data.
- Not scrubbing malformed or expired values from storage, on read or in `resetAll()`.
- Not reinstating the mid-fetch disabled guard from item 3 of the 2026-06-27 spec.
- Not changing `ClientStatus`, the auto-disable duration, the 4xx policy in `ApiClientManager.#fetch`, or the request queue.
- Not touching `README.md`: no user-facing surface changes, only bug fixes.

## Anti-goals

Any of these means the change went wrong, even if the tests pass:

- A read still writing to storage under a different name, such as `storageDelete` instead of `storageSet('0')`.
- A cache or memo of the parsed state to "avoid" the write, adding cross-tab invalidation for nothing.
- Keeping both checks to be safe, which leaves the double read this issue reports.
- Weakening or deleting assertions to reach green, beyond the one test whose premise is being removed.
- Treating a large but valid timestamp as malformed, which would ignore a real active lockout.

## Constraints

- `isDisabled()` is a read called from two places: `BaseApiClient.getStatus()` and `DisabledClientsManager.resetAll()` (`src/core/disabled-clients.ts:62`). Neither is a write path.
- Every access to `fm_disabled_*` in `src/` goes through this manager; nothing else reads or writes the key.
- `#disabledManager` must stay reachable from `BaseApiClient`: `disable()` (`src/core/api/base-api-client.ts:144`) writes the marker on a 4xx.
- `getStatus()` has to remain the health gate, because `XmdbApiClient.getStatus()` and `OmdbApiClient.getStatus()` prepend a non-storage reason, "No API key configured", before delegating to the base implementation. Removing the read from `getStatus()` would drop that reason from provider selection and break tests that assert `'Temporarily disabled due to errors'`.
- `PlatformAdapter.storageGet` returns `string | boolean | undefined`, so a boolean is a legal stored value that must not be coerced into a number.
- ESLint gates: `complexity: 10`, `sonarjs/cognitive-complexity: 10`, `max-params: 4`, JSDoc required on exported declarations. Vitest coverage thresholds are 90 for branches, statements, and functions.
- Prose and code rules from `AGENTS.md`: ASCII, SPDX headers, no em-dashes in prose, Conventional Commits, no `Co-Authored-By` footers.

## Approaches

### A. Pure read plus a single owner for the gate (chosen)

`isDisabled()` parses the stored string once, treats a non-finite parse as zero, and returns a single positive test: `Date.now() < disabledUntil`. No branch writes. `BaseApiClient.fetch()` drops its `#isDisabled()` prologue and the private helper is inlined into `getStatus()`, its only remaining caller. `ApiClientManager.#fetch` keeps `getStatus()` then `fetch()` and becomes the single owner of the gate.

Chosen because it fixes all three reported behaviors with the smallest diff, keeps the numeric-string storage format, keeps `getStatus()` as the place that also carries the API-key reason, and restores the contract the repository already documented.

### B. Keep both checks and only repair the parse

Normalize `NaN` to zero and stop the expiry write, but leave the client-level check in `fetch()`.

Rejected: it fixes two of the three behaviors and leaves the double read the issue names, which is also the reason a lookup in an extension can emit a storage event mid-lookup.

### C. Move the whole gate into `fetch()`

Remove the disabled read from `getStatus()` and gate only inside `fetch()`.

Rejected: `ApiClientManager` selects on `getStatus()` before it ever calls `fetch()`, so this moves ownership away from the selection point and loses the `'Temporarily disabled due to errors'` reason that callers and existing tests depend on.

## Decisions

These are settled. Each records the chosen option, the alternative that was dropped, and why.

1. **Parsing a stored marker.** Keep `Number.parseInt` on the stored string, treat a non-finite result as zero, and return `Date.now() < disabledUntil`. The bug is that `NaN` silently fails both comparisons; collapsing "expired" and "malformed" into one positive test fixes it with the smallest diff and preserves the existing tolerance for values such as `'1699999999999x'`. Dropped: `Number(raw)` with an explicit `NaN` check (equivalent, and it loses leading-numeric tolerance), a shape regex before parsing (new code and a new failure mode for an inert value), `Number.isSafeInteger` (rejects large but valid timestamps).
2. **Storage write on an expired marker.** Delete it. The marker is left in storage and simply reads healthy. Expiry is derived state and the stale timestamp can never read as disabled again. Dropped: `storageDelete` instead of `storageSet('0')` (still a write on a read, and it races other tabs' reads), in-memory caching of the derived state (needs cross-tab invalidation for no benefit).
3. **Where the disabled gate lives.** Single owner in `ApiClientManager.#fetch` through `client.getStatus()`. `BaseApiClient.fetch()` performs no disabled check and reads no storage for health. Dropped: keeping both checks (leaves the reported double read), gating only in `fetch()` (moves ownership away from selection, loses the reason string), passing a health token from `getStatus()` into `fetch()` (one read, at the cost of a new parameter and coupling for no behavioral gain).
4. **Fate of the private `#isDisabled` helper.** Inline it into `getStatus()`, the only remaining caller, and delete the method. Once `fetch()` stops calling it the helper is a one-line wrapper, and inlining makes the single read obvious at the call site. This also satisfies the step-down ordering rule: a caller before its callee, with no orphan helper.
5. **The mid-fetch disabled guard from the 2026-06-27 spec, item 3.** Do not add it. A guard between `search()` and `getDetails()` would be a second storage read per lookup, which is what the issue asks to remove. The exposure is limited, and `disable()` still purges queued work. Recorded as residual risk R1 below.
6. **Malformed or expired markers in storage.** Leave them. A malformed value can never read as disabled, so the key holds inert garbage rather than a stuck lockout. Scrubbing on read is the behavior being removed; scrubbing in `resetAll()` would add a branch whose only effect is tidying a key the user never sees.
7. **Reset Providers and malformed keys (the open question, settled by its recommendation).** Leave the key alone. `resetAll()` keeps its current contract: it reports and zeroes only sources whose lockout is active. A malformed marker reads healthy, so the settings UI will never report it, and removing it would widen `resetAll` beyond the issue.
8. **Tests.** Prove the three expectations directly: an expired read writes nothing, malformed values read healthy through `it.each`, `fetch()` never consults the disabled manager while `getStatus()` consults it exactly once, plus one manager-level lookup that reads `fm_disabled_xmdb` exactly once. Delete agregarr's "does not fetch when the client is disabled", which asserts an ownership that no longer exists; the manager-level skip is already covered by "skips an unhealthy client and does not cache the result" in `api-manager.test.ts`.
9. **Migrations and stored shape.** No migration and no `fm_data_version` bump. Only the interpretation of the value changes, and any already-stuck value reads healthy under the new parse.
10. **Commit identity.** If a commit fails with "Author identity unknown", set repo-local `user.email` and `user.name` and retry. This is an environment fix, not a design or code problem, and no footer or `Co-Authored-By` line is added.
11. **Commit and release artifacts.** One commit, `fix(api): read disabled provider state without writing storage`. `api` is an existing fix scope and is where the disabled provider already appears in `CHANGELOG.md`. Release notes are generated from the commit; `README.md` stays unchanged.

### Where the current code contradicts a decision

- `BaseApiClient.fetch()` currently performs a disabled check at the top (`src/core/api/base-api-client.ts:96-99`). This contradicts both the `ApiClient` interface docstring two definitions earlier (`:44`) and item 2 of the 2026-06-27 design. The design follows the interface docstring, not the implementation. The concrete override's docstring ("Applies the ID override and disabled-client short circuits") is the stale text and gets fixed.
- `isDisabled()`'s JSDoc says nothing about writes or malformed input; the expiry branch is the only writer in the read path. Nothing in the repo documents the write-on-read as intended, so no opposing decision is being overridden.
- The mid-fetch guard from item 3 of the same spec is also absent from the code today. This design deliberately does not restore it (decision 5); nothing in the current code or docs argues for restoring it.

## Interface changes

No exported signature changes. `ApiClient` shapes, `ClientStatus`, `ApiClientDeps`, and `DisabledClientsManager`'s public method list are unchanged.

**`DisabledClientsManager.isDisabled(source)`** keeps its signature and becomes a pure read:

```ts
async isDisabled(source: ApiSourceType): Promise<boolean> {
    const raw = await this.#adapter.storageGet(this.#key(source));
    const disabledUntil = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(disabledUntil)) return false;
    return Date.now() < disabledUntil;
}
```

The JSDoc states that the call never writes storage, and that an absent, non-numeric, `'0'`, or expired value reads as healthy.

Documented reading of each input:

| Stored value              | Result   | Write |
| ------------------------- | -------- | ----- |
| absent (`undefined`)      | healthy  | none  |
| `'0'`                     | healthy  | none  |
| non-numeric, `''`, `'  '` | healthy  | none  |
| boolean `true` or `false` | healthy  | none  |
| past timestamp            | healthy  | none  |
| future timestamp          | disabled | none  |

One deliberate, inert boundary change: at the exact millisecond where `Date.now() === disabledUntil`, the old code still read disabled (`Date.now() > disabledUntil` was false) and the new code reads healthy. Lockouts are `CLIENT_DISABLE_DURATION` (one hour), so this cannot be observed.

**`BaseApiClient.getStatus()`** inlines the check and stays the health gate; the private `#isDisabled()` method is removed:

```ts
async getStatus(): Promise<ClientStatus> {
    if (await this.#disabledManager.isDisabled(this.#source)) {
        return { healthy: false, reason: 'Temporarily disabled due to errors' };
    }
    return { healthy: true };
}
```

**`BaseApiClient.fetch()`** loses its `#isDisabled()` prologue and its docstring's "disabled-client short circuits" wording, which becomes "Applies the ID override around the search then details pipeline described by `ApiClient.fetch`." The `ApiClient.fetch` interface docstring keeps its existing "Callers must gate through `getStatus` before invoking" sentence; that sentence becomes true again.

**`ApiClientManager.#fetch`** is untouched. `getStatus()` then `fetch()` stays, so the manager owns the gate and one lookup reads `fm_disabled_<source>` once.

**`DisabledClientsManager.resetAll()`** is untouched in behavior. It still reads each source through `isDisabled()` and writes `'0'` only for a source that reads disabled. A side effect of the fix is that an expired marker no longer causes a write here either.

## Testing

`tests/unit/core/disabled-clients.test.ts`

- Extend "reports a source as not disabled after its expiry" to also assert `mockAdapter.storageSet` was not called. This is the write-on-read regression guard.
- Add an `it.each` over `['abc', '', '  ', true]`, named for the behavior, for example `it.each([['a non-numeric string', 'abc'], ...])('reports a source as not disabled when the stored marker is %s')`, each asserting `isDisabled('xmdb')` is `false` and `storageSet` was not called. Keeping `'1699999999999x'` as a handled case, if wanted, documents the retained `parseInt` tolerance.
- Leave the `resetAll` tests as they are: they assert the write for an active lockout and its absence for `'0'`, both still true.

`tests/unit/core/api/base-api-client.test.ts`

- Assert `getStatus()` consults the disabled manager exactly once: build a per-test disabled-manager mock, call `getStatus()`, expect `isDisabled` to have been called once with `'xmdb'`. The module-scope `mockDisabledManager` is shared across cases, so call-count assertions need a fresh mock per test.
- Assert `fetch()` never consults the disabled manager: per-test mock, `XmdbApiClient` over an adapter whose `httpFetch` resolves `{ results: [] }` (search misses, `fetch` returns `undefined`), then expect `isDisabled` not to have been called.
- The existing `status` tests stay; both still prove the "Temporarily disabled due to errors" reason.

`tests/unit/core/api/agregarr-api-client.test.ts`

- Delete `does not fetch when the client is disabled` (`:490-514`). Its premise, that the client owns the decision, is what this change removes.

`tests/unit/core/api-manager.test.ts`

- Add one lookup test that observes the read count end to end. Wiring: a recording mock adapter whose `storageGet` returns `'0'` for `fm_disabled_xmdb`, a real `DisabledClientsManager` over that adapter, a real `ApiClientManager`, and a client whose `getStatus()` is the base implementation. A small local `BaseApiClient` subclass with `source` `'xmdb'`, a `search` that returns a title, and a `getDetails` that returns a rated title keeps the test free of provider parsing and of the request queue, so `storageGet` is called exactly once, with `'fm_disabled_xmdb'`. Use a mock override manager so no `fm-idoverride:*` read is mixed in.
- If a real provider client is preferred instead, filter the recorded reads by key (`calls.filter(([key]) => key === 'fm_disabled_xmdb')`) and give the adapter a config key, because the queue also reads `fm_last_req_<source>` and `getStatus()` short-circuits to "No API key configured" without one.

Verification before claiming completion:

- `npm test`, or the affected files first for a tight loop.
- `npm run type-check && npm run lint && npm run format:check`.
- `npm run test:coverage` to confirm the 90% branch threshold still holds after two branches are removed and one is added.

## Residual risks

- **R1, the dispatcher race reopened.** Removing the client-level check means a 4xx from one title can disable the provider between another title's `getStatus()` and its `fetch()`. `disable()` still clears the queue, so queued work is rejected; only a request already dispatched proceeds, and its result is a rating the caller would have fetched a moment earlier. The issue explicitly asks for one check, and this matches the 2026-06-27 decision the code drifted from. Recorded here so it stays visible as a candidate for its own issue.
- **R2, direct `fetch()` callers lose the guard.** After this change, any code that calls `client.fetch()` without `getStatus()` gets no disabled check. In `src/` the manager is the only caller (`src/core/api-manager.ts:62`), and the integration suite calls `fetch()` directly against an adapter whose `storageGet` always returns `'0'`, so nothing changes today. The contract is now the only thing enforcing this, which is exactly what the interface docstring says.
- **R3, stale markers persist.** An expired or malformed `fm_disabled_*` value stays in storage indefinitely. It is inert because it can never read as disabled, but a user inspecting storage will see a value the app no longer respects.
- **R4, the exact-equality boundary moved by one millisecond**, as noted above. Not observable at a one-hour lockout.
- **R5, `resetAll()` reports nothing for a malformed marker.** It reads healthy, so Reset Providers says "No disabled API clients found to re-enable" even though a junk key exists. That is consistent with the settled decision to leave the key alone.

## Left to the builder

- Exact test titles, the shape of the local `BaseApiClient` stub in `api-manager.test.ts`, and whether the `'1699999999999x'` tolerance case is worth an extra `it.each` row.
- Whether the manager-level read-count test sits in the existing `fetching` group or a new one. One test does not need its own group under the repo convention.
- Whether the two JSDoc edits land in the same commit as the code (expected) or as a separate `docs(api)` commit.
- The order of the steps within the single commit, and whether to split the parse fix from the gate-ownership fix if review prefers two commits.
