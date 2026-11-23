# Test Deduplication and Branch Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove restated test coverage, isolate settings-view field failures, and close the four uncovered defensive branches without changing production behavior.

**Architecture:** Each task edits one test file or one small pair of related files, keeps every distinct assertion, and commits on its own. A shared background harness replaces duplicated Chrome and Firefox setup. Three reachable branches gain tests; one module-load invariant gains a v8 ignore hint.

**Tech Stack:** TypeScript, Vitest 5.1, jsdom, v8 coverage, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-11-23-test-deduplication-and-branch-coverage-design.md`

## Global Constraints

- Vitest 5.1 with the v8 coverage provider and jsdom.
- Tests use fake timers and advance them explicitly. Use `flushAsyncWork()` from `tests/helpers/async.ts` for promise-only boundaries.
- One top-level `describe` per file. Test names are behavior-oriented, third-person present tense, with no leading `should`.
- Tests stay in `tests/unit/` because none load a streaming-service fixture.
- No `any`, explicit return types in production code, sorted imports, and SPDX headers. The test config relaxes return-type and assertion rules, but keep the style consistent.
- Production behavior does not change. The only `src/` edit is a v8 ignore comment in `src/core/config/config-fields.ts`.
- Coverage thresholds stay at `branches: 90`, `statements: 90`, and `functions: 90`.
- Conventional Commits, imperative, lowercase, no trailing period.
- Do not edit `dist/` or `coverage/`.

## Review Focus

- A settings field of each type, including a disabled field, a linked label, and a suffix: the per-field cases must still prove rendering and population for all of them. Pinned by Task 6.
- A cache entry whose `expires` is missing or literal `null`: both must read as never expiring. Pinned by Task 2.
- A provider with a configured key: the provider override must still fall through to the base health check. Pinned by Task 3.
- A request cleared while its processing pass sits between storage reads: it must not dispatch and must reject. Pinned by Task 7.
- A background proxy rejection: the Chrome worker must answer with `{ ok: false, error }` instead of leaving the channel open. Pinned by Task 9.

---

## Before you start

- [ ] **Create the branch**

```bash
git switch main
git switch --create test/deduplicate-suite-coverage
```

- [ ] **Commit the design and plan**

```bash
git add docs/superpowers/specs/2026-11-23-test-deduplication-and-branch-coverage-design.md \
        docs/superpowers/plans/2026-11-23-test-deduplication-and-branch-coverage.md
git commit -m "docs(test): add deduplication design and plan"
```

---

### Task 1: Merge overlapping OMDb details coverage

**Files:**

- Modify: `tests/unit/core/api/omdb-api-client.test.ts` (`details` group)

**Interfaces:**

- Consumes: `buildMockAdapter`, `buildTitle`, and `deps` already in the file.
- Produces: no production interface.

- [ ] **Step 1: Replace the three overlapping tests**

In the `details` group, delete `uses the ID endpoint when the title has an IMDb ID`, `updates apiTitle from the OMDb response when the fallback has no apiTitle`, and `fetches details by IMDb ID for a cached title without an apiTitle`. Add one test in their place:

```ts
it('fetches details by IMDb ID and fills in the missing apiTitle', async () => {
    const mockResponse = {
        Response: 'True',
        imdbID: 'tt1234567',
        Title: 'Test Movie',
        Year: '2024',
        imdbRating: '8.5',
        imdbVotes: '1000',
        Ratings: [],
        Type: 'movie',
    };
    const adapter = buildMockAdapter().withHttpFetchResolvingTo(mockResponse).build();
    const client = new OmdbApiClient({ ...deps, adapter });
    const minimalTitle = buildTitle().withDisplayTitle('Test').withImdbId('tt1234567').build();

    const result = await client.getDetails(minimalTitle);

    expect(result).not.toBeUndefined();
    expect(result!.apiTitle).toBe('Test Movie');
    expect(result!.displayTitle).toBe('Test');
    expect(result!.imdbId).toBe('tt1234567');
    expect(result!.imdbRating).toBe(8.5);
    expect(adapter.httpFetch).toHaveBeenCalledWith('https://www.omdbapi.com/?apikey=key&i=tt1234567');
});
```

Keep `returns the title unchanged when it already has an apiTitle`. The `Title`
import is no longer used after the cached-title test is deleted, so remove it.

- [ ] **Step 2: Run the file**

Run: `npx vitest run tests/unit/core/api/omdb-api-client.test.ts`
Expected: PASS, with two fewer tests than before this task.

- [ ] **Step 3: Lint and format the file**

Run: `npx eslint tests/unit/core/api/omdb-api-client.test.ts && npx prettier --check tests/unit/core/api/omdb-api-client.test.ts`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/core/api/omdb-api-client.test.ts
git commit -m "test(api): merge overlapping OMDb details coverage"
```

---

### Task 2: Merge duplicate cache read coverage

**Files:**

- Modify: `tests/unit/core/cache/cache.test.ts` (`read` group)

**Interfaces:**

- Consumes: `buildCacheEntry`, `buildTitle`, `CacheEntry`, and `Title` already imported.
- Produces: no production interface.

- [ ] **Step 1: Merge the two never-expiring tests**

Replace `returns an entry with an indefinite expiry` and `treats a pre-migration entry with null expiry as never expiring` with:

```ts
it.each([
    ['a missing expiry', { displayTitle: 'Indefinite Title', data: {} }],
    [
        'a null expiry',
        {
            displayTitle: 'Legacy Movie',
            imdbId: null,
            data: { apiTitle: 'Legacy Movie', imdbRating: 8.1 },
            expires: null,
        },
    ],
])('treats an entry with %s as never expiring', async (_label, entry) => {
    adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

    const result = await cacheManager.read(entry.displayTitle);

    expect(result).toBeDefined();
    expect(result!.isExpired).toBe(false);
    expect(result!.imdbId).toBeUndefined();
    expect(result!.getTitle().displayTitle).toBe(entry.displayTitle);
});
```

- [ ] **Step 2: Merge the two valid-hit tests**

Replace `returns the cache entry on a hit` and `returns a cache entry with a title for valid data` with:

```ts
it('returns a cache entry with its title and metadata', async () => {
    const titleObj = buildTitle()
        .withDisplayTitle('Cached Movie')
        .withApiTitle('Cached Movie')
        .withImdbRating(8.0)
        .withSource('omdb')
        .build();
    const entry = buildCacheEntry()
        .withDisplayTitle('Cached Movie')
        .withImdbId('tt123')
        .withData(titleObj.toCacheJSON())
        .withExpiry(Date.now() + 100000)
        .build();
    adapter.storageGet.mockResolvedValue(JSON.stringify(entry));

    const result = await cacheManager.read('Cached Movie');

    expect(result).toBeInstanceOf(CacheEntry);
    expect(result!.getTitle()).toBeInstanceOf(Title);
    expect(result!.getTitle().displayTitle).toBe('Cached Movie');
    expect(result!.imdbId).toBe('tt123');
    expect(result!.getTitle().imdbRating).toBe(8.0);
    expect(result!.isExpired).toBe(false);
});
```

Keep `returns a title for an entry with empty title data`, which covers the shape `clear()` writes.

- [ ] **Step 3: Run the file**

Run: `npx vitest run tests/unit/core/cache/cache.test.ts`
Expected: PASS, with one fewer test than before this task.

- [ ] **Step 4: Lint and format the file**

Run: `npx eslint tests/unit/core/cache/cache.test.ts && npx prettier --check tests/unit/core/cache/cache.test.ts`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/core/cache/cache.test.ts
git commit -m "test(cache): merge duplicate cache read coverage"
```

---

### Task 3: Keep provider health fallthrough covered

**Files:**

- Modify: `tests/unit/core/api/base-api-client.test.ts`
- Modify: `tests/unit/core/api/omdb-api-client.test.ts` (`health` group)
- Modify: `tests/unit/core/api/xmdb-api-client.test.ts` (top-level health tests)

**Interfaces:**

- Consumes: `BaseApiClient`, `DisabledClientsManager`, `PlatformAdapter`, `RequestQueue`, and the existing `deps`.
- Produces: a module-scope `StubClient` whose constructor is `(source: 'xmdb' | 'omdb' | 'agregarr', logger: Logger, options?: StubClientOptions)`, where `StubClientOptions` has optional `adapter`, `disabledManager`, and `queue` fields.

- [ ] **Step 1: Move and reshape the base stub client**

In `base-api-client.test.ts`, move `StubClient` and `buildQueue` out of the `request surface` group to module scope, above `describe('BaseApiClient', ...)`. Replace the class with:

```ts
interface StubClientOptions {
    adapter?: PlatformAdapter;
    disabledManager?: DisabledClientsManager;
    queue?: RequestQueue;
}

class StubClient extends BaseApiClient {
    constructor(source: 'xmdb' | 'omdb' | 'agregarr', logger: Logger, options: StubClientOptions = {}) {
        const { adapter = mockAdapter, disabledManager = mockDisabledManager, queue } = options;
        super({ ...deps, adapter, disabledManager, logger }, source, queue);
    }
    async search(): Promise<Title | undefined> {
        return undefined;
    }
    async getDetails(): Promise<Title | undefined> {
        return undefined;
    }
}

function buildQueue(clearedCount: number): RequestQueue {
    return {
        clear: vi.fn().mockReturnValue(clearedCount),
        enqueue: vi.fn((url: string, _priority: number, fetchFn: (requestUrl: string) => Promise<unknown>) =>
            fetchFn(url)
        ),
    } as unknown as RequestQueue;
}
```

- [ ] **Step 2: Update the stub call sites in the base request-surface tests**

Apply these replacements in the `request surface` group:

- `new StubClient('omdb', logger, queue)` becomes `new StubClient('omdb', logger, { queue })`.
- `new StubClient('agregarr', logger, queue)` becomes `new StubClient('agregarr', logger, { queue })`.
- `new StubClient('xmdb', buildLogger().build(), buildQueue(0), adapter)` becomes `new StubClient('xmdb', buildLogger().build(), { adapter, queue: buildQueue(0) })`.
- Every remaining `new StubClient('xmdb', logger, buildQueue(count), adapterOrMockAdapter)` becomes `new StubClient('xmdb', logger, { adapter: adapterOrMockAdapter, queue: buildQueue(count) })`.
- Every remaining `new StubClient('xmdb', logger, buildQueue(count))` becomes `new StubClient('xmdb', logger, { queue: buildQueue(count) })`.
- Every remaining `new StubClient('xmdb', logger, queue)` becomes `new StubClient('xmdb', logger, { queue })`.

The `builds a default request queue when none is injected` case keeps `new StubClient('xmdb', logger)`.

- [ ] **Step 3: Point the base status tests at the stub**

Replace the two `XmdbApiClient` constructions in the `status` group:

```ts
it('returns a healthy status when the client is not disabled', async () => {
    const client = new StubClient('xmdb', buildLogger().build());
    const status = await client.getStatus();
    expect(status).toEqual({ healthy: true });
});
it('returns an unhealthy status when the client is disabled', async () => {
    const disabledManagerForTest: DisabledClientsManager = {
        isDisabled: vi.fn().mockResolvedValue(true),
        disable: vi.fn().mockResolvedValue(undefined),
        resetAll: vi.fn().mockResolvedValue([]),
    } as unknown as DisabledClientsManager;
    const client = new StubClient('xmdb', buildLogger().build(), {
        disabledManager: disabledManagerForTest,
    });
    const status = await client.getStatus();
    expect(status.healthy).toBe(false);
    expect((status as { healthy: false; reason: string }).reason).toBe('Temporarily disabled due to errors');
});
```

Keep the remaining `fetch` tests on `XmdbApiClient`.

- [ ] **Step 4: Delete the duplicate OMDb disabled test**

In `omdb-api-client.test.ts`, delete `reports unhealthy when disabled even though an API key is configured`. Keep `returns an unhealthy status when the API key is missing` and `defers to the base health check when an API key is configured`.

- [ ] **Step 5: Add the XMDB fallthrough test**

In `xmdb-api-client.test.ts`, next to `returns an unhealthy status when the API key is missing`, add:

```ts
it('defers to the base health check when an API key is configured', async () => {
    const client = new XmdbApiClient(deps);
    expect(await client.getStatus()).toEqual({ healthy: true });
});
```

- [ ] **Step 6: Run the three files**

Run: `npx vitest run tests/unit/core/api/base-api-client.test.ts tests/unit/core/api/omdb-api-client.test.ts tests/unit/core/api/xmdb-api-client.test.ts`
Expected: PASS. The combined count is unchanged by this task, and both provider fallthroughs remain covered.

- [ ] **Step 7: Lint and format the three files**

Run: `npx eslint tests/unit/core/api/base-api-client.test.ts tests/unit/core/api/omdb-api-client.test.ts tests/unit/core/api/xmdb-api-client.test.ts && npx prettier --check tests/unit/core/api/base-api-client.test.ts tests/unit/core/api/omdb-api-client.test.ts tests/unit/core/api/xmdb-api-client.test.ts`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add tests/unit/core/api/base-api-client.test.ts \
        tests/unit/core/api/omdb-api-client.test.ts \
        tests/unit/core/api/xmdb-api-client.test.ts
git commit -m "test(api): keep provider health fallthrough covered"
```

---

### Task 4: Drop duplicate XMDB malformed details rows

**Files:**

- Modify: `tests/unit/core/api/xmdb-api-client.test.ts` (`response parsing` group)

**Interfaces:**

- Consumes: the existing `details` malformed table.
- Produces: no production interface.

- [ ] **Step 1: Remove the three duplicate rows**

In the details table under `response parsing`, delete these rows:

```ts
['a null body', null],
['a non-string title', { id: 'tt1', title: 42 }],
['an empty title', { id: 'tt1', title: '' }],
```

The malformed-details table in the `details` group already asserts the observable result and the warning for the same inputs. Keep the empty-body, non-string-ID, missing-ID, empty-ID, string-rating, and string-metascore rows.

- [ ] **Step 2: Run the file**

Run: `npx vitest run tests/unit/core/api/xmdb-api-client.test.ts`
Expected: PASS, with three fewer tests than before this task.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/core/api/xmdb-api-client.test.ts
git commit -m "test(api): drop duplicate XMDB malformed details rows"
```

---

### Task 5: Share the background entry setup

**Files:**

- Create: `tests/helpers/background-harness.ts`
- Modify: `tests/unit/targets/chrome/service-worker.test.ts`
- Modify: `tests/unit/targets/firefox/background.test.ts`

**Interfaces:**

- Consumes: `tests/mocks/chrome.ts` and `tests/mocks/webextension.ts`.
- Produces: `installBackgroundHarness(namespace, globalName, runtimeId): BackgroundHarness`, where `BackgroundHarness` exposes `actionListener`, `installedListener`, and `messageListener` as `(...args: unknown[]) => unknown` functions.

- [ ] **Step 1: Create the harness**

Create `tests/helpers/background-harness.ts`:

```ts
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

/** Result a background listener may return: synchronous for Chrome, a promise for Firefox. */
export type BackgroundListenerResult = Promise<unknown> | boolean | void;

/** Listener registered by a background entry module. */
export type BackgroundListener = (..._args: unknown[]) => BackgroundListenerResult;

interface BackgroundNamespace {
    runtime: {
        id?: unknown;
        onInstalled: { addListener: (_callback: BackgroundListener) => void };
        onMessage: { addListener: (_callback: BackgroundListener) => void };
        openOptionsPage: () => Promise<void>;
    };
    action: {
        onClicked: { addListener: (_callback: BackgroundListener) => void };
    };
}

/** Listeners captured from a background entry module at import time. */
export interface BackgroundHarness {
    actionListener: BackgroundListener;
    installedListener: BackgroundListener;
    messageListener: BackgroundListener;
}

function missingListener(name: string): BackgroundListener {
    return (): never => {
        throw new Error(`Background listener ${name} was not registered`);
    };
}

/**
 * Installs a browser namespace mock on `global`, captures the listeners the
 * entry module registers, and stubs the timer, fetch, and abort globals the
 * background context expects.
 *
 * The returned listeners throw until the entry module registers them, so a
 * test cannot pass against an unregistered listener.
 *
 * @param namespace - Chrome or WebExtension namespace mock to install.
 * @param globalName - Global name the namespace is defined under.
 * @param runtimeId - Runtime ID the sender check compares against.
 * @returns Captured listeners for message, install, and action events.
 */
export function installBackgroundHarness(
    namespace: BackgroundNamespace,
    globalName: 'chrome' | 'browser',
    runtimeId: string | undefined
): BackgroundHarness {
    vi.useFakeTimers();
    namespace.runtime.id = runtimeId;
    namespace.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined);

    let installedListener: BackgroundListener | undefined;
    let messageListener: BackgroundListener | undefined;
    let actionListener: BackgroundListener | undefined;

    namespace.runtime.onInstalled.addListener = vi.fn((listener: BackgroundListener): void => {
        installedListener = listener;
    });
    namespace.runtime.onMessage.addListener = vi.fn((listener: BackgroundListener): void => {
        messageListener = listener;
    });
    namespace.action.onClicked.addListener = vi.fn((listener: BackgroundListener): void => {
        actionListener = listener;
    });

    Object.defineProperty(global, globalName, {
        value: namespace,
        writable: true,
        configurable: true,
    });

    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    global.AbortController = class {
        signal: { aborted: boolean };
        constructor() {
            this.signal = { aborted: false };
        }
        abort() {
            this.signal.aborted = true;
        }
    } as unknown as { prototype: AbortController; new (): AbortController };

    return {
        actionListener: (...args: unknown[]): BackgroundListenerResult =>
            (actionListener ?? missingListener('onClicked'))(...args),
        installedListener: (...args: unknown[]): BackgroundListenerResult =>
            (installedListener ?? missingListener('onInstalled'))(...args),
        messageListener: (...args: unknown[]): BackgroundListenerResult =>
            (messageListener ?? missingListener('onMessage'))(...args),
    };
}
```

- [ ] **Step 2: Use the harness in the Chrome test**

In `tests/unit/targets/chrome/service-worker.test.ts`, replace the `beforeEach` setup with:

```ts
let messageListener: BackgroundListener;
let installedListener: BackgroundListener;
let actionListener: BackgroundListener;

beforeEach(async () => {
    vi.resetModules();
    executeMigrations.mockReset();
    executeMigrations.mockResolvedValue(undefined);

    ({ messageListener, installedListener, actionListener } = installBackgroundHarness(chrome, 'chrome', 'test-ext'));

    await import('../../../../src/targets/chrome/service-worker');
});
```

Add `import type { BackgroundListener } from '../../../helpers/background-harness';` and `import { installBackgroundHarness } from '../../../helpers/background-harness';`, then delete the direct `vi.useFakeTimers()`, listener registration, `Object.defineProperty`, `global.fetch`, and `global.AbortController` setup. Keep `afterEach(() => vi.useRealTimers())`.

- [ ] **Step 3: Use the harness in the Firefox test**

In `tests/unit/targets/firefox/background.test.ts`, apply the same replacement:

```ts
let messageListener: BackgroundListener;
let installedListener: BackgroundListener;
let actionListener: BackgroundListener;

beforeEach(async () => {
    vi.resetModules();
    executeMigrations.mockReset();
    executeMigrations.mockResolvedValue(undefined);

    ({ messageListener, installedListener, actionListener } = installBackgroundHarness(browser, 'browser', undefined));

    await import('../../../../src/targets/firefox/background');
});
```

Add the same two imports and delete the copied setup. Keep the existing behavior tests and `afterEach(() => vi.useRealTimers())`.

- [ ] **Step 4: Run both target files**

Run: `npx vitest run tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts`
Expected: PASS with the same counts as before this task.

- [ ] **Step 5: Lint and format the three files**

Run: `npx eslint tests/helpers/background-harness.ts tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts && npx prettier --check tests/helpers/background-harness.ts tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/background-harness.ts \
        tests/unit/targets/chrome/service-worker.test.ts \
        tests/unit/targets/firefox/background.test.ts
git commit -m "test(targets): share background entry setup"
```

---

### Task 6: Isolate settings-view field cases

**Files:**

- Modify: `tests/unit/core/ui/settings-view.test.ts` (`rendering` and `field population` groups)

**Interfaces:**

- Consumes: `CONFIG_FIELDS`, `isSettingField`, and `SettingConfigField` from `src/core/config/index`.
- Produces: no production interface.

- [ ] **Step 1: Add the field list and stored-value helper**

Update the config import to keep `CONFIG_FIELDS`, `type ConfigField`, `GROUPS`,
`isSettingField`, `ROW_LABELS`, and add `type SettingConfigField`. Remove
`isActionField`, which the replaced loops no longer use.

Below `const configFields`, add:

```ts
const settingFields = configFields.filter(isSettingField);

function storedValueFor(field: SettingConfigField): boolean | string {
    if (field.type === 'checkbox') return !field.default;
    if (field.type === 'select') {
        const optionValues = field.options.map(option => (Array.isArray(option) ? option[0] : option));
        return optionValues.find(option => option !== field.default) ?? field.default;
    }
    return `stored-${field.key}`;
}
```

- [ ] **Step 2: Replace the rendering loop**

Replace `renders each config field from its definition` with:

```ts
it.each(settingFields)('renders $key from its definition', field => {
    view.render(container, {});

    const label = Array.from(container.querySelectorAll('label')).find(element => element.textContent === field.label);
    expect(label, `Label for ${field.key} not found`).toBeDefined();

    const input = container.querySelector(`[id="fm-${field.key}"]`);
    expect(input, `Input for ${field.key} not found`).toBeDefined();

    if (field.type === 'select') {
        expect((input as HTMLSelectElement).tagName).toBe('SELECT');
        expect([...(input as HTMLSelectElement).options].map(option => [option.value, option.textContent])).toEqual(
            field.options.map(option => (Array.isArray(option) ? option : [option, option]))
        );
    } else {
        expect((input as HTMLInputElement).type).toBe(field.type);
    }

    if (field.labelUrl) {
        const link = label?.querySelector('a');
        expect(link).not.toBeNull();
        expect((link as HTMLAnchorElement)?.href).toBe(field.labelUrl);
        expect((link as HTMLAnchorElement)?.target).toBe('_blank');
        expect(label!.hasAttribute('for')).toBe(false);
    } else {
        expect(label?.querySelector('a')).toBeNull();
    }
});
```

Action fields stay covered by the existing action-button, action-row, and mixed-row tests.

- [ ] **Step 3: Replace the default-population loop**

Replace `populates every field with its default when settings are empty` with:

```ts
it.each(settingFields)('renders $key with its default', field => {
    view.render(container, {});

    const input = container.querySelector(`#fm-${field.key}`) as HTMLInputElement | HTMLSelectElement;
    const value = field.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value;

    expect(value).toBe(field.default);
});
```

- [ ] **Step 4: Replace the stored-value loop**

Replace `populates every field with its stored value` with:

```ts
it.each(settingFields)('renders $key with its stored value', field => {
    const storedValue = storedValueFor(field);
    view.render(container, { [field.key]: storedValue });

    const input = container.querySelector(`#fm-${field.key}`) as HTMLInputElement | HTMLSelectElement;
    const value = field.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value;

    expect(value).toBe(storedValue);
});
```

Keep `uses configured defaults for optional rating fields`, which proves a local field subset rather than the full list.

- [ ] **Step 5: Run the file**

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts`
Expected: PASS. The three replaced tests become 51 cases, so the file count rises by 48.

- [ ] **Step 6: Lint and format the file**

Run: `npx eslint tests/unit/core/ui/settings-view.test.ts && npx prettier --check tests/unit/core/ui/settings-view.test.ts`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/core/ui/settings-view.test.ts
git commit -m "test(ui): isolate settings-view field cases"
```

---

### Task 7: Cover a cleared processing pass

**Files:**

- Modify: `tests/unit/core/request-queue.test.ts` (`clear` group)

**Interfaces:**

- Consumes: `buildQueue`, `buildMockAdapter`, and `flushAsyncWork` already imported.
- Produces: no production interface.

- [ ] **Step 1: Add the test**

Add to the `clear` group:

```ts
it('drops a queued request cleared during a processing pass', async () => {
    let reads = 0;
    let releaseRead: () => void = () => undefined;
    const adapter = buildMockAdapter().withStorageSetResolvingTo(undefined).build();
    adapter.storageGet = vi.fn(() => {
        reads += 1;
        if (reads <= 3) return Promise.resolve('0');
        return new Promise<string>(resolve => {
            releaseRead = () => resolve('0');
        });
    });
    const queue = buildQueue(0, adapter);
    const firstFetch = vi.fn().mockResolvedValue('first');
    const secondFetch = vi.fn().mockResolvedValue('second');

    await queue.enqueue('url1', 0, firstFetch);

    const second = queue.enqueue('url2', 0, secondFetch);
    const secondResult = second.catch((error: unknown) => error);
    await flushAsyncWork();
    expect(adapter.storageGet).toHaveBeenCalledTimes(4);
    expect(secondFetch).not.toHaveBeenCalled();

    expect(queue.clear()).toBe(1);
    releaseRead();
    await flushAsyncWork();

    expect(secondFetch).not.toHaveBeenCalled();
    await expect(secondResult).resolves.toEqual(new Error('Client Disabled'));
});
```

The first request uses two storage reads. The second request's pass performs the
loop-start read (third) and the pre-claim read (fourth). Clearing while the
pre-claim read is pending empties the queue before dispatch.

- [ ] **Step 2: Run the file**

Run: `npx vitest run tests/unit/core/request-queue.test.ts`
Expected: PASS with one more test than before this task.

- [ ] **Step 3: Confirm the guard is covered**

Run: `npx vitest run tests/unit/core/request-queue.test.ts --coverage --coverage.include=src/core/request-queue.ts`
Expected: line 114 is no longer listed as uncovered.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/core/request-queue.test.ts
git commit -m "test(queue): cover a pass cleared before dispatch"
```

---

### Task 8: Allow reading settings before render

**Files:**

- Modify: `tests/unit/core/ui/settings-view.test.ts` (`view state` group)

**Interfaces:**

- Consumes: the `view` instance created in `beforeEach`.
- Produces: no production interface.

- [ ] **Step 1: Add the test**

Add to the `view state` group:

```ts
it('returns an empty snapshot before the view renders', () => {
    expect(view.readValues()).toEqual({});
});
```

- [ ] **Step 2: Run the file**

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts`
Expected: PASS with one more test than after Task 6.

- [ ] **Step 3: Confirm the fallback is covered**

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts --coverage --coverage.include=src/core/ui/settings-view.ts`
Expected: line 404 is no longer listed as uncovered.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/core/ui/settings-view.test.ts
git commit -m "test(ui): allow reading settings before render"
```

---

### Task 9: Cover the Chrome worker proxy rejection

**Files:**

- Modify: `tests/unit/targets/chrome/service-worker.test.ts` (`message handling` group)

**Interfaces:**

- Consumes: `installBackgroundHarness` from Task 5 and the `handleFetchMessage` export from `src/targets/extension/fetch-proxy`.
- Produces: no production interface.

- [ ] **Step 1: Wrap the real proxy in a mock**

Next to the existing migrations mock, add:

```ts
vi.mock('../../../../src/targets/extension/fetch-proxy', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../../src/targets/extension/fetch-proxy')>();
    return {
        ...actual,
        handleFetchMessage: vi.fn(actual.handleFetchMessage),
    };
});
```

The forwarding tests keep the real handler through the wrapped implementation.

- [ ] **Step 2: Add the rejection test**

Add to the `message handling` group:

```ts
it.each([
    ['an Error rejection', new Error('proxy exploded'), 'proxy exploded'],
    ['a non-Error rejection', 'proxy exploded', 'proxy exploded'],
])('responds with the proxy error for %s', async (_label, rejection, expected) => {
    const { handleFetchMessage } = await import('../../../../src/targets/extension/fetch-proxy');
    vi.mocked(handleFetchMessage).mockRejectedValueOnce(rejection);

    const sendResponse = vi.fn();
    const result = messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com' }, { id: 'test-ext' }, sendResponse);

    expect(result).toBe(true);
    await flushAsyncWork();
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: expected });
});
```

- [ ] **Step 3: Run the file**

Run: `npx vitest run tests/unit/targets/chrome/service-worker.test.ts`
Expected: PASS with two more tests than before this task.

- [ ] **Step 4: Confirm the catch is covered**

Run: `npx vitest run tests/unit/targets/chrome/service-worker.test.ts --coverage --coverage.include=src/targets/chrome/service-worker.ts`
Expected: lines 71 and 72 are no longer listed as uncovered.

- [ ] **Step 5: Lint and format the file**

Run: `npx eslint tests/unit/targets/chrome/service-worker.test.ts && npx prettier --check tests/unit/targets/chrome/service-worker.test.ts`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/targets/chrome/service-worker.test.ts
git commit -m "test(targets): cover worker proxy rejection"
```

---

### Task 10: Mark the config defaults guard as an invariant

**Files:**

- Modify: `src/core/config/config-fields.ts:347-349`

**Interfaces:**

- Consumes: `isCompleteSettingsMap` and `configDefaults` already in the module.
- Produces: no new interface.

- [ ] **Step 1: Add the ignore hint**

Replace the module-load guard with:

```ts
// The defaults map is built from CONFIG_FIELDS, so this check cannot fail unless
// the field list and the map construction drift apart.
/* v8 ignore next 3 */
if (!isCompleteSettingsMap(configDefaults)) {
    throw new Error('CONFIG_DEFAULTS is missing a setting key');
}
```

- [ ] **Step 2: Confirm the line is ignored**

Run: `npx vitest run tests/unit/core/config/config-fields.test.ts --coverage --coverage.include=src/core/config/config-fields.ts`
Expected: PASS, and the report does not list line 348 as uncovered.

- [ ] **Step 3: Lint and format the file**

Run: `npx eslint src/core/config/config-fields.ts && npx prettier --check src/core/config/config-fields.ts`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/core/config/config-fields.ts
git commit -m "test(config): mark defaults invariant as ignored"
```

---

### Task 11: Run the full local verification

**Files:**

- No edits. This task verifies the branch.

**Interfaces:**

- Consumes: every earlier task.
- Produces: no interface.

- [ ] **Step 1: Run type-check, lint, and format**

Run: `npm run type-check && npm run lint && npm run format:check`
Expected: all exit 0.

- [ ] **Step 2: Run the full suite and confirm the count**

Run: `npm test`
Expected: PASS with 1028 tests. The count is 982 before this branch, minus six removed duplicate tests, plus 52 new cases.

- [ ] **Step 3: Run coverage and check the four branch sites**

Run: `npm run test:coverage`
Expected: thresholds pass. The report no longer lists `request-queue.ts:114`, `settings-view.ts:404`, or `service-worker.ts:71-72` as uncovered. `config-fields.ts` may still list line 348 only if the ignore hint is misplaced; it must not.

- [ ] **Step 4: Confirm production changes are comments only**

Run: `git diff main -- src/`
Expected: the only change is the comment and `/* v8 ignore next 3 */` in `src/core/config/config-fields.ts`.

- [ ] **Step 5: Build all targets**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Review the branch diff**

Run: `git diff --stat main...HEAD`
Expected: test files, the new helper, the design and plan docs, and the one `src/` comment.
