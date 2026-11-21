# Cache Write Invariants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace request tracking with two cache save invariants: never downgrade a rated entry to a bare miss, and never store a result that contradicts the current IMDb override.

**Architecture:** `CacheManager` serializes `write` per title and applies the invariants inside `write`. `FlixMonkeyApp` drops the in-flight map, keeps a per-caller timeout, and keeps the not-found fallback render.

**Tech Stack:** TypeScript, Vitest with jsdom, Rollup, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-11-21-cache-write-invariants-design.md`

> **Final revision:** cache deletes stay outside the write chain. `ApiClientManager` gains no `invalidate`; refresh and edit call `CacheManager.delete` directly. Steps below that introduce `invalidate` or put `delete` on the chain describe an intermediate revision.

## Global Constraints

- All source changes stay in `src/` and `tests/unit/core/`.
- No new dependencies.
- `CacheManager` owns write order and write policy. Constructor: `(adapter, config, logger, overrides)`.
- `ApiClientManager` keeps its four-parameter constructor and is unchanged.
- No request ids, no in-flight map, no deduplication anywhere.
- The 4xx disable policy is unchanged; it is tracked separately in #316.
- Keep the 30 second per-caller timeout and the not-found fallback render.
- Every `{src,tests}/**/*.ts` file keeps its SPDX header. Exported declarations need JSDoc with `@param` and `@returns`.
- Use `src/core/logger.ts` for logging. ASCII only. No em dashes.

## Review Focus

- A corrupt cached entry read during the pre-write check: `read` deletes it and the new value must still be stored.
- A rejected storage write must not poison later queued writes for the same title.
- Deleting a title with no cached entry must resolve cleanly, which refresh on an uncached title relies on.
- A user override whose lookup returns no IMDb ID must not be stored as an unrated entry.
- Two rapid refreshes must not let the first delete run before the second write or the reverse; the chain orders both.

---

### Task 1: Serialize cache writes and deletes per title

**Files:**

- Modify: `src/core/cache/cache-manager.ts`
- Test: `tests/unit/core/cache/cache.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: private `#enqueue(displayTitle: string, operation: () => Promise<void>): Promise<void>`; `write` and `delete` keep their current signatures and return the queued operation.

- [x] **Step 1: Write the failing tests**

Add a `describe('write ordering')` inside `tests/unit/core/cache/cache.test.ts`, using `buildManager()` from the `clearing cached data` describe. Move `buildManager` to the top-level test scope so both describes can use it, and keep it returning `{ adapter, store, manager }`.

```ts
it('runs a delete after a write already queued for the title', async () => {
    const { adapter, store, manager } = buildManager();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
        release = resolve;
    });
    adapter.storageSet.mockImplementationOnce(async (key: string, value: string) => {
        await gate;
        store.set(key, value);
    });

    const write = manager.write('Race Movie', buildTitle().withDisplayTitle('Race Movie').withImdbRating(7).build());
    const deletion = manager.delete('Race Movie');
    release();
    await Promise.all([write, deletion]);

    await expect(manager.read('Race Movie')).resolves.toBeUndefined();
});

it('deletes a missing title without error', async () => {
    const { manager } = buildManager();
    await expect(manager.delete('Missing Movie')).resolves.toBeUndefined();
});

it('keeps the chain usable after a write rejects', async () => {
    const { adapter, manager } = buildManager();
    const title = buildTitle().withDisplayTitle('Retry Movie').withImdbRating(7).build();
    adapter.storageSet.mockRejectedValueOnce(new Error('storage failed'));

    await expect(manager.write('Retry Movie', title)).rejects.toThrow('storage failed');
    await expect(manager.write('Retry Movie', title)).resolves.toBeUndefined();
    await expect(manager.read('Retry Movie')).resolves.toBeDefined();
});
```

- [x] **Step 2: Run the tests to verify the ordering test fails**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts -t "write ordering"`
Expected: `runs a delete after a write already queued for the title` fails because the delete runs before the gated write resolves. The other two pass before the chain exists.

- [x] **Step 3: Implement the chain**

In `CacheManager`, add `readonly #writeChains = new Map<string, Promise<void>>();`. Add the helper:

```ts
#enqueue(displayTitle: string, operation: () => Promise<void>): Promise<void> {
    const key = this.#getCacheKey(displayTitle);
    const previous = this.#writeChains.get(key) ?? Promise.resolve();
    const run = previous.then(operation);
    const tail = run.then(
        () => undefined,
        () => undefined
    );
    this.#writeChains.set(key, tail);
    return run.finally(() => {
        if (this.#writeChains.get(key) === tail) this.#writeChains.delete(key);
    });
}
```

Route `write` so its existing body runs inside `await this.#enqueue(displayTitle, async () => { ...existing body... });`.
Route `delete` the same way, keeping its existing storage delete and debug log inside the callback.

- [x] **Step 4: Run the cache tests**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/cache/cache-manager.ts tests/unit/core/cache/cache.test.ts
git commit -m "fix(cache): serialize writes and deletes per title"
```

---

### Task 2: Never replace a rated entry with a bare miss

**Files:**

- Modify: `src/core/cache/cache-manager.ts`
- Test: `tests/unit/core/cache/cache.test.ts`

**Interfaces:**

- Consumes: `#enqueue` from Task 1.
- Produces: `write` may resolve without storing the title.

- [x] **Step 1: Write the failing tests**

Add `describe('write invariants')` with:

```ts
it('does not replace a rated entry with a bare miss', async () => {
    const { manager } = buildManager();
    await manager.write(
        'Keep Movie',
        buildTitle().withDisplayTitle('Keep Movie').withImdbId('tt1').withImdbRating(8).build()
    );

    await manager.write('Keep Movie', Title.notFound('Keep Movie'));

    const entry = await manager.read('Keep Movie');
    expect(entry?.getTitle().imdbRating).toBe(8);
});

it('replaces an ID-only entry with a bare miss', async () => {
    const { manager } = buildManager();
    await manager.write('Hint Movie', new Title({ displayTitle: 'Hint Movie', imdbId: 'tt2' }));

    await manager.write('Hint Movie', Title.notFound('Hint Movie'));

    const entry = await manager.read('Hint Movie');
    expect(entry?.imdbId).toBeUndefined();
});

it('replaces an expired rated entry with a bare miss', async () => {
    const { store, manager } = buildManager();
    store.set(
        'fmc:expired_movie',
        JSON.stringify(
            buildCacheEntry()
                .withDisplayTitle('Expired Movie')
                .withImdbId('tt3')
                .withExpiry(Date.now() - 1000)
                .build()
        )
    );

    await manager.write('Expired Movie', Title.notFound('Expired Movie'));

    const entry = await manager.read('Expired Movie');
    expect(entry?.imdbId).toBeUndefined();
});

it('stores the new value when the existing entry is corrupt', async () => {
    const { store, manager } = buildManager();
    store.set('fmc:corrupt', '{not json');

    await manager.write('Corrupt', buildTitle().withDisplayTitle('Corrupt').withImdbRating(6).build());

    const entry = await manager.read('Corrupt');
    expect(entry?.getTitle().imdbRating).toBe(6);
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts -t "write invariants"`
Expected: `does not replace a rated entry with a bare miss` fails with the miss stored. The ID-only and expired cases pass before the rule exists.

- [x] **Step 3: Implement the rule**

Update the `CacheStore.write` JSDoc to say the cache may decline to store a title when an invariant rejects it. Inside the enqueued `write` callback, before storing:

```ts
const isBareMiss = !titleObj.hasRating && !titleObj.imdbId;
if (isBareMiss) {
    const existing = await this.read(displayTitle);
    if (existing && !existing.isExpired && existing.getTitle().hasRating) {
        this.#logger.debug(`Skipped cache downgrade for "${displayTitle}"`);
        return;
    }
}
```

- [x] **Step 4: Run the cache tests**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`
Expected: PASS, including the existing retained-ID miss test.

- [x] **Step 5: Commit**

```bash
git add src/core/cache/cache-manager.ts tests/unit/core/cache/cache.test.ts
git commit -m "fix(cache): keep rated entries over bare misses"
```

---

### Task 3: Skip saves that contradict the IMDb override

**Files:**

- Modify: `src/core/cache/cache-manager.ts`
- Modify: `src/core/app.ts`
- Modify: `src/targets/extension/options.ts`
- Modify: `src/targets/userscript/entry.ts`
- Modify: `tests/unit/core/cache/cache.test.ts`
- Modify: `tests/unit/core/app.test.ts`
- Modify: `tests/unit/core/ui/settings-ui.test.ts`

**Interfaces:**

- Consumes: `IdOverrideManager.getImdbId(displayTitle): Promise<string | undefined>`.
- Produces: `CacheManager` constructor `(adapter: PlatformAdapter, config: ConfigManager, logger: Logger, overrides: IdOverrideManager)`.

- [x] **Step 1: Write the failing tests**

In `tests/unit/core/cache/cache.test.ts`, have `buildManager` return `{ adapter, store, manager, overrides }` where `overrides` is an `IdOverrideManager` built on the same adapter and passed to the `CacheManager`. Add:

```ts
it('skips a result whose IMDb ID differs from the override', async () => {
    const { manager, overrides } = buildManager();
    await overrides.setImdbId('Override Movie', 'tt999');

    await manager.write(
        'Override Movie',
        buildTitle().withDisplayTitle('Override Movie').withImdbId('tt111').withImdbRating(8).build()
    );

    await expect(manager.read('Override Movie')).resolves.toBeUndefined();
});

it('writes a result that matches the override', async () => {
    const { manager, overrides } = buildManager();
    await overrides.setImdbId('Override Movie', 'tt999');

    await manager.write(
        'Override Movie',
        buildTitle().withDisplayTitle('Override Movie').withImdbId('tt999').withImdbRating(8).build()
    );

    const entry = await manager.read('Override Movie');
    expect(entry?.getTitle().imdbRating).toBe(8);
});

it('skips a bare miss when an override exists', async () => {
    const { manager, overrides } = buildManager();
    await overrides.setImdbId('Override Movie', 'tt999');

    await manager.write('Override Movie', Title.notFound('Override Movie'));

    await expect(manager.read('Override Movie')).resolves.toBeUndefined();
});
```

- [x] **Step 2: Run the tests to verify they fail to compile**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts -t "override"`
Expected: FAIL because `CacheManager` takes three constructor arguments and the override check does not exist.

- [x] **Step 3: Implement the dependency and the check**

In `cache-manager.ts` import `IdOverrideManager`, add `readonly #overrides: IdOverrideManager`, take it as the fourth constructor parameter, and inside the enqueued `write` callback, before the downgrade check:

```ts
const override = await this.#overrides.getImdbId(displayTitle);
if (override && override !== titleObj.imdbId) {
    this.#logger.debug(
        `Skipped cache write for "${displayTitle}": override ${override} differs from ${titleObj.imdbId}`
    );
    return;
}
```

Update every construction site: `startApp` creates `overrideManager` before `cache` and passes it; `options.ts`, `userscript/entry.ts`, `app.test.ts` `buildAppDependencies`, `cache.test.ts` `beforeEach` and `buildManager`, and `settings-ui.test.ts` construct an `IdOverrideManager` on the same adapter and pass it.

Update the existing `keeps manual IMDb ID overrides` test to write `tt999` instead of `tt111`, so the write is not skipped and the test still proves that `clear(true)` keeps overrides.

- [x] **Step 4: Run the cache and type checks**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts tests/unit/core/app.test.ts tests/unit/core/ui/settings-ui.test.ts && npm run type-check`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/cache/cache-manager.ts src/core/app.ts src/targets/extension/options.ts src/targets/userscript/entry.ts tests/unit/core/cache/cache.test.ts tests/unit/core/app.test.ts tests/unit/core/ui/settings-ui.test.ts
git commit -m "feat(cache): respect the IMDb override when saving"
```

---

### Task 4: Expose cache invalidation on ApiClientManager

**Files:**

- Modify: `src/core/cache/cache-manager.ts`
- Modify: `src/core/api-manager.ts`
- Test: `tests/unit/core/api-manager.test.ts`

**Interfaces:**

- Consumes: the chained `CacheManager.delete` from Task 1.
- Produces: `CacheStore.delete(displayTitle: string): Promise<void>` and `ApiClientManager.invalidate(displayTitle: string): Promise<void>`.

- [x] **Step 1: Add the interface method and update mocks**

Add `delete(displayTitle: string): Promise<void>` to `CacheStore` with JSDoc that says it resolves when the entry has been removed and runs after any queued write for the title. Update the interface summary to include delete.

In `tests/unit/core/api-manager.test.ts`, add `delete: vi.fn()` to every inline cache mock. Run `npm run type-check` to confirm.

- [x] **Step 2: Write the failing test**

```ts
it('removes the cached title when invalidated', async () => {
    const mockCache = {
        read: vi.fn().mockResolvedValue(undefined),
        write: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
    };
    const mockClient: ApiClient = {
        source: 'agregarr',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn(),
        disable: vi.fn(),
    };
    const manager = new ApiClientManager(buildLogger().build(), mockCache, disabledManager, mockClient);

    await manager.invalidate('Test Movie');

    expect(mockCache.delete).toHaveBeenCalledWith('Test Movie');
});
```

- [x] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/core/api-manager.test.ts -t "invalidated"`
Expected: FAIL with `manager.invalidate is not a function`.

- [x] **Step 4: Implement `invalidate`**

```ts
/**
 * Removes the cached title so the next lookup starts fresh. Any write queued for
 * the title completes or is skipped before the entry is deleted.
 *
 * @param displayTitle - Title whose cache entry should be removed.
 * @returns Resolves when the entry has been removed.
 */
async invalidate(displayTitle: string): Promise<void> {
    await this.#cache.delete(displayTitle);
}
```

- [x] **Step 5: Run the manager tests and type check**

Run: `npx vitest run tests/unit/core/api-manager.test.ts && npm run type-check`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/cache/cache-manager.ts src/core/api-manager.ts tests/unit/core/api-manager.test.ts
git commit -m "feat(core): expose cache invalidation on ApiClientManager"
```

---

### Task 5: Drop in-flight lookup deduplication

**Files:**

- Modify: `src/core/app.ts`
- Test: `tests/unit/core/app.test.ts`

**Interfaces:**

- Consumes: `ApiClientManager.getData(displayTitle): Promise<Title>`.
- Produces: private `#raceWithTimeout(promise: Promise<Title>): Promise<Title>`; no `#inFlight` field and no `#getTitleRequest`.

- [x] **Step 1: Remove the deduplication tests**

Delete `should deduplicate in-flight requests for the same title` and `should deduplicate in-flight requests for titles that differ only by punctuation` from `tests/unit/core/app.test.ts`. Keep the timeout test as is; it must still pass.

- [x] **Step 2: Implement the simplification**

Remove the `#inFlight` field and `#getTitleRequest`. Add:

```ts
async #raceWithTimeout(promise: Promise<Title>): Promise<Title> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('lookup timeout')), LOOKUP_TIMEOUT_MS);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timeoutId);
    }
}
```

In `#decorateContainer`, replace the `#getTitleRequest` call with `const request = this.#raceWithTimeout(this.#api.getData(displayTitle));`.

- [x] **Step 3: Run the app tests**

Run: `npx vitest run tests/unit/core/app.test.ts`
Expected: PASS. The timeout test still logs through `#decorateRoot`.

- [x] **Step 4: Commit**

```bash
git add src/core/app.ts tests/unit/core/app.test.ts
git commit -m "refactor(core): drop in-flight lookup deduplication"
```

---

### Task 6: Route refresh and edit eviction through invalidate

**Files:**

- Modify: `src/core/app.ts`
- Test: `tests/unit/core/app.test.ts`

**Interfaces:**

- Consumes: `ApiClientManager.invalidate(displayTitle): Promise<void>` from Task 4.
- Produces: refresh and edit call `invalidate` before redecorating.

- [x] **Step 1: Update the tests**

In the refresh test, expect `mockCache.delete` to have been called with `'Test Movie'` instead of `'test_movie'`, and add `vi.spyOn(api, 'invalidate')` with `expect(invalidateSpy).toHaveBeenCalledWith('Test Movie')`. Apply the same expectation change to the two edit tests that assert `mockCache.delete`.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/app.test.ts -t "evict the cache"`
Expected: FAIL because the app still deletes with the slugified key and does not call `invalidate`.

- [x] **Step 3: Implement**

In `#handleEditClick` and `#handleRefreshClick`, replace `await this.#cache.delete(dedupKey);` with `await this.#api.invalidate(displayTitle);`. Keep `dedupKey` for `#redecorateTitle`.

- [x] **Step 4: Run the app tests**

Run: `npx vitest run tests/unit/core/app.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/app.ts tests/unit/core/app.test.ts
git commit -m "refactor(core): evict the cache through invalidate"
```

---

### Task 7: Render the not-found fallback when a lookup fails

**Files:**

- Modify: `src/core/app.ts`
- Test: `tests/unit/core/app.test.ts`

**Interfaces:**

- Consumes: `Title.notFound(displayTitle: string): Title`.
- Produces: a failed or timed-out decoration renders an uncached not-found overlay; render failures keep propagating.

- [x] **Step 1: Update and add the tests**

Replace `should log errors thrown by decorateContainer rather than propagating them` with a test that asserts the fallback: mock `getData` to reject, wait for `Logger.error` with `Failed to decorate "Boom Movie"`, then assert `.title-card .fm-loading` is null and `.title-card .fm-search` is not null. Update the timeout test to assert the same two DOM conditions after the timeout. Add:

```ts
it('keeps a render failure out of the not-found fallback', async () => {
    document.body.innerHTML = `
        <div class="title-card">
            <a aria-label="Broken Movie"></a>
        </div>
    `;
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
        buildTitle().withApiTitle('Broken Movie').build()
    );
    const injectSpy = vi.spyOn(OverlayRenderer.prototype, 'injectOverlay').mockImplementation(() => {
        throw new Error('render failure');
    });

    appRef = startApp(buildMockAdapter().build());

    await vi.waitFor(() => {
        expect(logSpy).toHaveBeenCalledWith('Failed to decorate "Broken Movie"', expect.any(Error));
    });

    expect(injectSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.title-card .fm-loading')).toBeNull();
    logSpy.mockRestore();
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/app.test.ts -t "not-found fallback"`
Expected: FAIL because a rejected lookup renders nothing.

- [x] **Step 3: Implement**

Change the `Title` import in `app.ts` to a value import. In `#decorateContainer`:

```ts
let data: Title;
try {
    data = await request;
} catch (err) {
    /*
     * A failed or timed-out lookup renders an uncached not-found title so the
     * card keeps a usable IMDb search badge instead of going blank. Nothing is
     * cached here, so a refresh or a redecorate retries the lookup; until then
     * the fallback overlay marks the card as decorated.
     */
    this.#logger.error(`Failed to decorate "${displayTitle}"`, err);
    data = Title.notFound(displayTitle);
}

try {
    this.#renderTitle(container, data, { dedupKey, fadeable, showFadeToggle, fadeOverride });
} finally {
    this.#renderer.removeLoadingOverlay(container);
}
```

- [x] **Step 4: Run the app tests**

Run: `npx vitest run tests/unit/core/app.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/app.ts tests/unit/core/app.test.ts
git commit -m "fix(core): render a not-found fallback when a lookup fails"
```

---

### Task 8: Full verification

**Files:** none.

- [x] **Step 1: Type check and lint**

Run: `npm run type-check && npm run lint && npx prettier --check "{src,tests}/**/*.ts"`
Expected: PASS. Ignore the pre-existing untracked `docs/reviews/2026-11-06-project-review.md`, which is not part of this work.

- [x] **Step 2: Run tests with coverage**

Run: `npm run test:coverage`
Expected: PASS with no threshold regression.

- [x] **Step 3: Build all targets**

Run: `npm run build`
Expected: three targets created.

- [x] **Step 4: Dependency audit**

Run: `npm run audit`
Expected: no new moderate or higher advisories.

- [x] **Step 5: Report**

Report the commit list, the commands run, and any deviation from this plan. Do not push.
