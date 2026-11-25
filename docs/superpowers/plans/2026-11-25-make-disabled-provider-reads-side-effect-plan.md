# Make disabled-provider reads side-effect free: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `DisabledClientsManager.isDisabled()` a pure read that treats a malformed marker as healthy, and give the disabled gate a single owner in `ApiClientManager.#fetch` via `client.getStatus()`.

**Architecture:** `isDisabled()` parses the stored string once, collapses a non-finite parse and an expired timestamp into one positive test (`Date.now() < disabledUntil`), and writes nothing. `BaseApiClient.fetch()` drops its disabled prologue, the private `#isDisabled()` helper is inlined into `getStatus()`, and `ApiClientManager.#fetch` becomes the only gate, so one lookup reads `fm_disabled_<source>` exactly once.

**Tech Stack:** TypeScript (ES2022, ESM, strict), Vitest 5 with jsdom, ESLint + Prettier, Conventional Commits through commitlint.

**Spec:** `docs/superpowers/specs/2026-11-25-make-disabled-provider-reads-side-effect-design.md`

## Global Constraints

- No exported signature changes: `ApiClient`, `ClientStatus`, `ApiClientDeps`, and `DisabledClientsManager`'s public method list stay as they are.
- No change to the `fm_disabled_*` storage format, no migration, no `fm_data_version` bump.
- `CLIENT_DISABLE_DURATION` stays `60 * 60 * 1000`; the 4xx auto-disable policy in `ApiClientManager.#fetch` is untouched.
- `BaseApiClient.getStatus()` stays the health gate and keeps the reason string `'Temporarily disabled due to errors'`; `XmdbApiClient.getStatus()` and `OmdbApiClient.getStatus()` keep prepending `'No API key configured'`.
- `resetAll()` behavior is unchanged: it reports and zeroes only sources whose lockout is active.
- Never scrub an expired or malformed marker: no `storageSet('0')`, no `storageDelete`, on any read path.
- No in-memory cache or memo of parsed disabled state; no mid-fetch disabled guard between `search()` and `getDetails()`.
- `README.md` unchanged, no version bump, no `CHANGELOG.md` edit (release-please generates it).
- ESLint gates: `complexity: 10`, `sonarjs/cognitive-complexity: 10`, `max-params: 4`, JSDoc required on exported declarations and interface members.
- Coverage thresholds: 90 for branches, statements, and functions.
- ASCII only, SPDX header in every touched `.ts` file, no em-dashes in prose, Conventional Commits, no `Co-Authored-By` or generated-by footers.
- Test conventions: one top-level `describe` per file, third-person behavior names, `it.each` for repeated cases, fake timers restored after every test that enables them.

## Review Focus

- A malformed marker during Reset Providers: expected to report nothing and write nothing, because a malformed marker reads healthy (R5, decision 7). Owned by Task 1, `reports nothing and writes nothing when resetting a malformed marker`.
- A rejected `storageGet` inside `isDisabled()`: expected to propagate so a lookup fails loudly rather than reading the provider as healthy. Owned by Task 1, `propagates a storage read failure` (a guard, not a red test: it pins behavior that the refactor must not swallow).
- `Date.now()` exactly equal to the stored expiry: expected healthy, since the new comparison is strict `<` (R4). Owned by Task 1, `reports a source as not disabled at the exact expiry millisecond`.
- A stored boolean, which `PlatformAdapter.storageGet` legitimately returns as `string | boolean`: expected healthy and never coerced into a number. Owned by Task 1's `it.each` row `a boolean`.
- The non-storage health reasons from the provider subclasses must survive moving the gate: `'No API key configured'` and `'Temporarily disabled due to errors'` are asserted by existing tests in `tests/unit/core/api/omdb-api-client.test.ts` and `x tests/unit/core/api/base-api-client.test.ts`, which Task 2 runs and must leave green.

---

### Task 1: Make `isDisabled()` a pure read with an inert malformed path

**Files:**

- Modify: `src/core/disabled-clients.ts:19-33` (`isDisabled` and its JSDoc only; `#key`, `disable`, `resetAll` untouched)
- Test: `tests/unit/core/disabled-clients.test.ts`

**Interfaces:**

- Consumes: `PlatformAdapter.storageGet(key): Promise<string | boolean | undefined>`.
- Produces: `DisabledClientsManager.isDisabled(source: ApiSourceType): Promise<boolean>` with the same signature and new semantics: never writes storage; `undefined`, a boolean, `'0'`, a non-numeric value, and an expired timestamp all return `false`; only a strictly future timestamp returns `true`.

- [ ] **Step 1: Confirm the branch and the planning documents**

Run: `git status --short && git branch --show-current`

If the spec or this plan is uncommitted, commit them first on a fresh branch:

```bash
git switch -c fix/side-effect-free-disabled-reads
git add docs/superpowers/specs/2026-11-25-make-disabled-provider-reads-side-effect-design.md \
        docs/superpowers/plans/2026-11-25-make-disabled-provider-reads-side-effect-free.md
git commit -m "docs: plan side-effect-free disabled-provider reads"
```

Expected: branch is `fix/side-effect-free-disabled-reads` and `git status` is clean.

- [x] **Step 2: Write the failing tests**

Add `vi` to the Vitest import of `tests/unit/core/disabled-clients.test.ts`, then change the existing expiry test and add four tests next to it:

```ts
it('reports a source as not disabled after its expiry', async () => {
    mockAdapter.storageGet.mockResolvedValue((Date.now() - 1000).toString());
    expect(await manager.isDisabled('xmdb')).toBe(false);
    expect(mockAdapter.storageSet).not.toHaveBeenCalled();
});

it.each([
    ['a non-numeric string', 'abc'],
    ['an empty string', ''],
    ['whitespace', '  '],
    ['a boolean', true],
    ['a past timestamp with a trailing character', `${Date.now() - 1000}x`],
])('reports a source as not disabled when the stored marker is %s', async (_label, stored) => {
    mockAdapter.storageGet.mockResolvedValue(stored);
    expect(await manager.isDisabled('xmdb')).toBe(false);
    expect(mockAdapter.storageSet).not.toHaveBeenCalled();
});

it('reports a source as not disabled at the exact expiry millisecond', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
        mockAdapter.storageGet.mockResolvedValue('1000000');
        expect(await manager.isDisabled('xmdb')).toBe(false);
        expect(mockAdapter.storageSet).not.toHaveBeenCalled();
    } finally {
        vi.useRealTimers();
    }
});

it('propagates a storage read failure', async () => {
    mockAdapter.storageGet.mockRejectedValue(new Error('storage failed'));
    await expect(manager.isDisabled('xmdb')).rejects.toThrow('storage failed');
});

it('reports nothing and writes nothing when resetting a malformed marker', async () => {
    mockAdapter.storageGet.mockResolvedValue('abc');
    expect(await manager.resetAll()).toEqual([]);
    expect(mockAdapter.storageSet).not.toHaveBeenCalled();
});
```

- [x] **Step 3: Run the tests to verify each one fails for the right reason**

Run: `npx vitest run tests/unit/core/disabled-clients.test.ts`

Expected:

- `reports a source as not disabled after its expiry` FAILS on `storageSet` having been called with `['fm_disabled_xmdb', '0']`.
- Each of the five `... when the stored marker is ...` cases FAILS on `isDisabled` returning `true` (`NaN` fails both of the old comparisons).
- `reports a source as not disabled at the exact expiry millisecond` FAILS on `isDisabled` returning `true`.
- `reports nothing and writes nothing when resetting a malformed marker` FAILS on `resetAll` returning `['xmdb', 'omdb', 'agregarr']` and on `storageSet`.
- `propagates a storage read failure` PASSES. It is a guard against the refactor swallowing the read error into `false`; leave it in place.

- [x] **Step 4: Implement the pure read**

In `src/core/disabled-clients.ts`, replace the body of `isDisabled()` with exactly:

```ts
async isDisabled(source: ApiSourceType): Promise<boolean> {
    const raw = await this.#adapter.storageGet(this.#key(source));
    const disabledUntil = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(disabledUntil)) return false;
    return Date.now() < disabledUntil;
}
```

Keep `Number.parseInt` so a value such as `'1699999999999x'` keeps its existing tolerance. Do not add `try`/`catch`, `Number.isSafeInteger`, a shape regex, or any `storageSet`/`storageDelete`.

Update the JSDoc to state the read-only contract, for example:

```ts
/**
 * Reports whether an API client is currently locked out after failures.
 *
 * Reads `fm_disabled_<source>` and never writes storage, so an expired marker
 * stays in storage and simply reads as healthy. An absent, non-numeric, `'0'`,
 * or expired value reads as healthy; a malformed value never disables a
 * provider.
 *
 * @param source - The API provider identifier (e.g., 'xmdb', 'omdb').
 * @returns True only while the stored expiry is in the future.
 */
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/core/disabled-clients.test.ts`
Expected: PASS, all cases including the three untouched `resetAll` tests.

- [x] **Step 6: Run the dependent suite**

Run: `npx vitest run tests/unit/core/api tests/unit/core/api-manager.test.ts`
Expected: PASS. Nothing outside this manager reads `fm_disabled_*`, and `resetAll`'s write for an active lockout is unchanged.

---

### Task 2: Give the disabled gate a single owner

**Files:**

- Modify: `src/core/api/base-api-client.ts:88-133` (delete the `#isDisabled()` prologue call and the helper; inline into `getStatus()`; fix the `fetch` JSDoc)
- Modify: `tests/unit/core/api-manager.test.ts` (new end-to-end read-count test)
- Modify: `tests/unit/core/api/base-api-client.test.ts` (two new tests)
- Modify: `tests/unit/core/api/agregarr-api-client.test.ts:490-514` (delete one stale test)

**Interfaces:**

- Consumes: `DisabledClientsManager.isDisabled(source)` from Task 1, pure and read-only.
- Produces: `BaseApiClient.getStatus()` as the only reader of `fm_disabled_<source>`; `BaseApiClient.fetch()` reads no storage for health and keeps its signature `fetch(displayTitle: string, imdbId?: string): Promise<Title | undefined>`. The private `#isDisabled()` method no longer exists.

- [x] **Step 1: Write the failing end-to-end read-count test**

Append to the `fetching` group of `tests/unit/core/api-manager.test.ts`. Add these imports: `BaseApiClient` and `type ApiClientDeps` from `../../../src/core/api/base-api-client`, `type ConfigManager` from `../../../src/core/config/config-manager`, `type IdOverrideManager` from `../../../src/core/id-override-manager`, `type RequestQueue` from `../../../src/core/request-queue`, `type Title` from `../../../src/core/title`. `buildTitle`, `buildLogger`, `buildMockAdapter`, `DisabledClientsManager`, and `ApiClientManager` are already imported.

```ts
class RatedStubClient extends BaseApiClient {
    constructor(deps: ApiClientDeps) {
        super(deps, 'xmdb', {
            clear: vi.fn().mockReturnValue(0),
            enqueue: vi.fn(),
        } as unknown as RequestQueue);
    }
    async search(displayTitle: string): Promise<Title | undefined> {
        return buildTitle().withDisplayTitle(displayTitle).withImdbId('tt1234567').build();
    }
    async getDetails(searchTitle: Title): Promise<Title | undefined> {
        return buildTitle()
            .withDisplayTitle(searchTitle.displayTitle)
            .withImdbId('tt1234567')
            .withImdbRating(7.5)
            .build();
    }
}
```

Declare the class at module scope in the test file (below the existing `disabledManager` const), then add this test as the last case in `describe('fetching')`:

```ts
it('reads the disabled marker once per lookup', async () => {
    const adapter = buildMockAdapter()
        .withStorageGetResolvingTo((key: string) => Promise.resolve(key === 'fm_disabled_xmdb' ? '0' : undefined))
        .build();
    const disabledManager = new DisabledClientsManager(adapter);
    const logger = buildLogger().build();
    const deps: ApiClientDeps = {
        adapter,
        config: { get: () => 'key' } as unknown as ConfigManager,
        disabledManager,
        logger,
        overrideManager: {
            getImdbId: vi.fn().mockResolvedValue(undefined),
            setImdbId: vi.fn().mockResolvedValue(undefined),
        } as unknown as IdOverrideManager,
    };
    const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
    const manager = new ApiClientManager(logger, mockCache, disabledManager, new RatedStubClient(deps));

    const result = await manager.getData('Some Title');

    expect(result.imdbRating).toBe(7.5);
    expect(adapter.storageGet.mock.calls).toEqual([['fm_disabled_xmdb']]);
    expect(adapter.storageSet).not.toHaveBeenCalled();
});
```

The stub `search` and `getDetails` return `Title` objects directly, so the request queue is never enqueued and no `fm_last_req_*` read is recorded. The mock override manager keeps `fm-idoverride:*` out of the recorded reads.

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/core/api-manager.test.ts -t "reads the disabled marker once per lookup"`

Expected: FAIL with a received value of two identical entries, roughly `[ [ 'fm_disabled_xmdb' ], [ 'fm_disabled_xmdb' ] ]`, because `getStatus()` and `fetch()` each read the key.

- [x] **Step 3: Write the failing client-level tests**

In `tests/unit/core/api/base-api-client.test.ts`, add this to `describe('status')`:

```ts
it('consults the disabled manager exactly once for a status check', async () => {
    const disabledManagerForTest: DisabledClientsManager = {
        isDisabled: vi.fn().mockResolvedValue(false),
        disable: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue([]),
    } as unknown as DisabledClientsManager;
    const client = new XmdbApiClient({ ...deps, disabledManager: disabledManagerForTest });

    const status = await client.getStatus();

    expect(status).toEqual({ healthy: true });
    expect(disabledManagerForTest.isDisabled).toHaveBeenCalledOnce();
    expect(disabledManagerForTest.isDisabled).toHaveBeenCalledWith('xmdb');
});
```

and this to `describe('fetch')`:

```ts
it('does not consult the disabled manager during a fetch', async () => {
    const disabledManagerForTest: DisabledClientsManager = {
        isDisabled: vi.fn().mockResolvedValue(true),
        disable: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue([]),
    } as unknown as DisabledClientsManager;
    const adapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
    const client = new XmdbApiClient({ ...deps, adapter: adapterForTest, disabledManager: disabledManagerForTest });

    const result = await client.fetch('Some Title');

    expect(result).toBeUndefined();
    expect(disabledManagerForTest.isDisabled).not.toHaveBeenCalled();
});
```

- [x] **Step 4: Run the new client tests**

Run: `npx vitest run tests/unit/core/api/base-api-client.test.ts -t "disabled manager"`

Expected: `consults the disabled manager exactly once for a status check` PASSES (it pins the contract that survives inlining `#isDisabled`, so it guards against copying the call into both methods). `does not consult the disabled manager during a fetch` FAILS on `isDisabled` having been called once, and returns `undefined` for the wrong reason: the guard short-circuits before the search.

- [x] **Step 5: Implement the single owner**

In `src/core/api/base-api-client.ts`:

1. Delete the `if (await this.#isDisabled()) { return undefined; }` block at the top of `fetch()` and the blank line after it, leaving `const overrideId = await this.#overrideManager.getImdbId(displayTitle);` as the first statement.
2. Delete the private `async #isDisabled()` method entirely.
3. Make `getStatus()` call the manager directly:

```ts
async getStatus(): Promise<ClientStatus> {
    if (await this.#disabledManager.isDisabled(this.#source)) {
        return { healthy: false, reason: 'Temporarily disabled due to errors' };
    }
    return { healthy: true };
}
```

4. Change the `fetch()` docstring's first line to `Applies the ID override around the search then details pipeline described by \`ApiClient.fetch\`.`and drop the phrase "disabled-client short circuits". Leave the`ApiClient.fetch`interface docstring (including "Callers must gate through`getStatus` before invoking") untouched; it becomes true again.

Do not touch `ApiClientManager.#fetch`, `disable()`, the queue, or the 4xx policy.

- [x] **Step 6: Run the affected files and delete the stale test**

Run: `npx vitest run tests/unit/core/api/agregarr-api-client.test.ts`

Expected: one FAILURE, `does not fetch when the client is disabled`, on `expect(mockOverrideManagerForTests.getImdbId).not.toHaveBeenCalled()`: the client no longer owns the decision. Its premise is what this change removes; the manager-level skip is already covered by `skips an unhealthy client and does not cache the result` in `api-manager.test.ts`. Delete that whole `it(...)` block (`tests/unit/core/api/agregarr-api-client.test.ts:490-514`) and leave the surrounding tests alone.

- [x] **Step 7: Run every affected file**

Run: `npx vitest run tests/unit/core/api tests/unit/core/api-manager.test.ts tests/unit/core/disabled-clients.test.ts`
Expected: PASS, including `omdb-api-client.test.ts` and `xmdb-api-client.test.ts` (the `'No API key configured'` and `'Temporarily disabled due to errors'` reasons still surface), and the new read-count test now seeing exactly one `fm_disabled_xmdb` read.

- [x] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS with no failures and no new warnings; report any failure you see by name, including one this change did not cause.

---

### Task 3: Full verification and the single commit

**Files:**

- Verify only; no source edits unless a gate fails.
- Commit: `src/core/disabled-clients.ts`, `src/core/api/base-api-client.ts`, `tests/unit/core/disabled-clients.test.ts`, `tests/unit/core/api/base-api-client.test.ts`, `tests/unit/core/api-manager.test.ts`, `tests/unit/core/api/agregarr-api-client.test.ts`.

**Interfaces:**

- Consumes: everything from Tasks 1 and 2.
- Produces: one commit, `fix(api): read disabled provider state without writing storage`.

- [x] **Step 1: Run the static gates**

Run: `npm run type-check && npm run lint && npm run format:check`
Expected: all three exit 0 with no output from Prettier and no ESLint errors. If Prettier reports files, run `npm run format` and re-run the gate.

- [x] **Step 2: Run the coverage gate**

Run: `npm run test:coverage`
Expected: PASS, with branches, statements, and functions each at or above 90. Two branches leave `isDisabled()` (the `=== 0` early return and the expiry write) and one is added; one stale test is removed. Report the three percentages.

- [ ] **Step 3: Confirm nothing out of scope moved**

Run: `git status --short && git diff --stat`

Expected: only the six files listed above, plus any `docs/superpowers/` files from Task 1 Step 1. `README.md`, `CHANGELOG.md`, `package.json`, `src/core/constants.ts`, `src/core/api-manager.ts`, and `src/core/migrations.ts` are unchanged.

- [ ] **Step 4: Commit once**

```bash
git add src/core/disabled-clients.ts src/core/api/base-api-client.ts \
        tests/unit/core/disabled-clients.test.ts tests/unit/core/api/base-api-client.test.ts \
        tests/unit/core/api-manager.test.ts tests/unit/core/api/agregarr-api-client.test.ts
git commit -m "fix(api): read disabled provider state without writing storage"
```

If the commit fails with "Author identity unknown", set repo-local identity and retry, adding no footer:

```bash
git config user.email "<repository email>"
git config user.name "<repository author name>"
git commit -m "fix(api): read disabled provider state without writing storage"
```

Expected: one commit on `fix/side-effect-free-disabled-reads`. Do not split it unless a reviewer asks; the design settles on one commit.

- [ ] **Step 5: Tick the plan checkboxes**

Mark every completed step above as `- [x]` in `docs/superpowers/plans/2026-11-25-make-disabled-provider-reads-side-effect-free.md` and commit that file with `docs: tick side-effect-free disabled-provider reads plan`. Tick a step only once it is complete.

---

## Notes for the reviewer

- Residual risks accepted by the design and deliberately not tested: R1 (a 4xx from one title can disable the provider between another title's `getStatus()` and `fetch()`, which the issue asks us to accept by asking for one check), R2 (a direct `fetch()` caller loses the guard; the only `src/` caller is `ApiClientManager.#fetch`), R3 (expired and malformed markers stay in storage, inert), R4 (the exact-millisecond boundary moved to healthy, pinned by Task 1's fake-timer test), R5 (Reset Providers reports nothing for a malformed marker, pinned by Task 1's `resetAll` test).
- The one ms boundary change is `Date.now() > disabledUntil` (old, disabled at equality) to `Date.now() < disabledUntil` (new, healthy at equality). Do not "fix" it back to `<=`; at a one-hour lockout it is unobservable.
- Do not restore the mid-fetch guard from item 3 of `docs/superpowers/specs/2026-06-27-correctness-and-contract-fixes-design.md`. It would reintroduce a second storage read per lookup.
