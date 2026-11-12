# Remove Remaining Unsafe Type Assertions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every unsafe type assertion in `src/` and enable `@typescript-eslint/no-unsafe-type-assertion` as an error so no new one can land.

**Architecture:** Tighten the surface contract to `HTMLElement` and narrow once at discovery, then replace the remaining casts with `instanceof` checks, concrete DOM element creation, `Map`-keyed config lookups, shape guards, and a shared extension-message parser. Tests keep the rule off; only casts made redundant by the production type changes are removed.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Prettier, Rollup.

**Spec:** `docs/superpowers/specs/2026-11-12-no-unsafe-type-assertions-design.md`

## Global Constraints

- TypeScript `strict` and `exactOptionalPropertyTypes` are enabled.
- ESLint complexity is capped at 10 and `max-params` at 4. Do not add disable comments.
- Every exported declaration needs JSDoc with `@param` and `@returns` where applicable. Every `{src,tests}/**/*.ts` file starts with the SPDX header.
- ASCII only, no em-dashes, sorted imports, Conventional Commits.
- `@typescript-eslint/no-unsafe-type-assertion` is enforced for `src/` and explicitly `off` for `tests/`.
- Do not add a schema library or any runtime dependency.
- Do not rewrite unrelated test assertions. Only casts made redundant by the production type changes are removed.
- Preserve the existing `package.json` working-tree change (`allowScripts`). Stage files explicitly; never use `git add -A`.
- The pre-commit hook runs Prettier and ESLint on staged files. If it rewrites a file, re-stage it before the commit completes.
- Use `npx eslint <files> --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'` as the red and green signal in each task until Task 12 enables the rule in config.

## Review Focus

- A surface title element that is not an `HTMLElement` (SVG or MathML) must be skipped, not decorated through a lying cast. Tested in Task 1.
- An extension message with a valid URL but malformed `options` (`options: 42`, `responseType: 'xml'`, `timeout: -1`, `NaN`, or `Infinity`) must be ignored with no fetch. Tested in Task 11.
- A stored ID override that is valid JSON but not an object, or whose `imdbId` is not a string, must read as no override and must not throw. Tested in Task 7.
- A rejected API client value that is not an `Error` (a string or `null`) must warn with empty metadata and return a not-found title, not crash. Tested in Task 10.
- A queued request whose fetch function rejects, and a queue cleared while work is pending, must reject the caller instead of hanging. Tested in Task 8.

---

### Task 1: Surface contract and discovery

**Files:**

- Modify: `src/types/surfaces.ts`
- Modify: `src/core/surfaces/surface-manager.ts`
- Modify: `src/core/surfaces/surface-definitions/disney-plus-surfaces.ts`
- Modify: `src/core/surfaces/surface-definitions/hbo-max-surfaces.ts`
- Modify: `tests/helpers/surface-tests.ts`
- Modify: `tests/ui/netflix.ui.test.ts`
- Modify: `tests/unit/core/surfaces/surfaces.test.ts`
- Test: `tests/unit/core/surfaces/surfaces.test.ts`

**Interfaces:**

- Produces: `SurfaceDefinition.getTitle: (_element: HTMLElement) => string | undefined`
- Produces: `SurfaceDefinition.getContainer: (_element: HTMLElement) => Element | undefined`
- Produces: `SurfaceDefinition.decorateContainer?: (_container: HTMLElement, _element: HTMLElement) => void`
- Produces: `DiscoveredSurface.container: HTMLElement`
- Produces: `containerFromClosest(selector: string): (element: HTMLElement) => HTMLElement | undefined`
- Produces: `containerFromParent(element: HTMLElement): HTMLElement | undefined`
- Produces: `titleFromAttribute(attribute: string): (element: HTMLElement) => string | undefined`

- [x] **Step 1: Create the branch and commit the design and plan**

```bash
git switch -c refactor/unsafe-type-assertions
git add docs/superpowers/specs/2026-11-12-no-unsafe-type-assertions-design.md docs/superpowers/plans/2026-11-12-no-unsafe-type-assertions.md
git commit -m "docs: add unsafe type assertion design and plan"
```

Expected: branch created, docs committed, `package.json` still modified and unstaged.

- [x] **Step 2: Write the failing non-HTML surface test**

Add to `tests/unit/core/surfaces/surfaces.test.ts`:

```ts
it('skips a title element that is not an HTMLElement', () => {
    document.body.innerHTML = '<svg data-title="Vector"></svg>';
    const sm = new SurfaceManager(buildLogger().build(), {
        card: {
            titleSelector: '[data-title]',
            getTitle: () => 'Vector',
            getContainer: () => document.body,
        },
    });

    expect(sm.discover(document.body)).toHaveLength(0);
});
```

- [x] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/core/surfaces/surfaces.test.ts -t "not an HTMLElement"`

Expected: FAIL because the current discovery path accepts the SVG element and returns one surface.

- [x] **Step 4: Change the surface types and narrow once in discovery**

In `src/types/surfaces.ts`, change the three callbacks and `DiscoveredSurface.container` to `HTMLElement` exactly as listed in Interfaces.

In `src/core/surfaces/surface-manager.ts`:

- Return `HTMLElement | undefined` from `containerFromClosest` using `element.closest(selector)` followed by `instanceof HTMLElement`.
- Return `element.parentElement ?? undefined` from `containerFromParent`.
- Change `titleFromAttribute` to take `HTMLElement`.
- In `discover`, skip a title element that is not an `HTMLElement` before calling `surface.getTitle`.
- Narrow the resolved container with `instanceof HTMLElement`, falling back to `titleEl.parentElement`. Keep the existing warning when the resolver fails and the existing `seen` deduplication.

In `src/core/surfaces/surface-definitions/disney-plus-surfaces.ts` and `hbo-max-surfaces.ts`, change resolver parameters and exported extraction functions to `HTMLElement`. Access `element.dataset` directly. Remove `as RegExp[]` from both frozen pattern arrays; keep the inferred `readonly RegExp[]` type.

- [x] **Step 5: Update the surface tests for the new contract**

- `tests/helpers/surface-tests.ts`: pass `surface.container` directly to `injectOverlay`; delete the two-line comment and the `as unknown as HTMLElement` cast.
- `tests/ui/netflix.ui.test.ts`: pass `surface.container` directly to `hasOverlay` and `injectOverlay`; delete both casts.
- `tests/unit/core/surfaces/surfaces.test.ts`: change `getTitle` parameters to `HTMLElement`, use `element.dataset.title ?? ''`, return `element.parentElement ?? undefined` from `getContainer`, type `decorateContainer`'s parameter as `HTMLElement`, and delete the `surface.container as HTMLElement` cast.

- [x] **Step 6: Run the surface tests and the targeted rule**

Run: `npx vitest run tests/unit/core/surfaces/surfaces.test.ts tests/ui/netflix.ui.test.ts`

Expected: PASS, including the new non-HTML test.

Run: `npx eslint src/types/surfaces.ts src/core/surfaces --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems. `src/core/app.ts` still has findings and is handled in Task 2.

- [x] **Step 7: Commit**

```bash
git add src/types/surfaces.ts src/core/surfaces tests/helpers/surface-tests.ts tests/ui/netflix.ui.test.ts tests/unit/core/surfaces/surfaces.test.ts
git commit -m "refactor: type surface contracts as HTMLElement"
```

---

### Task 2: App DOM, history, and client map

**Files:**

- Modify: `src/core/app.ts`
- Modify: `tests/unit/core/app.test.ts`
- Test: `tests/unit/core/app.test.ts`

**Interfaces:**

- Consumes: `DiscoveredSurface.container: HTMLElement` from Task 1.
- Produces: `#decorateContainer(container: HTMLElement, displayTitle: string, fadeable: boolean, showFadeToggle: boolean): Promise<void>`
- Produces: `#renderTitle(container: HTMLElement, data: Title, options: {...}): void`

- [x] **Step 1: Confirm the current findings**

Run: `npx eslint src/core/app.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 15 findings, mostly `Element` to `HTMLElement` casts.

- [x] **Step 2: Change the container parameters and remove the casts**

In `src/core/app.ts`:

- Type `#decorateContainer` and `#renderTitle` containers as `HTMLElement`, and remove every cast at their renderer and `dataset` call sites.
- In `#redecorateTitle` and `#handleFadeToggleClick`, use `document.querySelectorAll<HTMLElement>('[data-fm-key="..."]')`.
- Add the mutation target with `if (m.target instanceof Element) this.#pendingRoots.add(m.target)`.
- Type `#originalPushState` and `#originalReplaceState` as `(data: unknown, unused: string, url?: string | URL | null) => void`. Assign `history.pushState` and `history.replaceState` directly. In the wrappers, call the original with `.call(history, data, unused, url)` and forward `url` unchanged.
- Type `clientMap` as `Record<ApiSourceType, new (_deps: ApiClientDeps) => BaseApiClient>`. Add `function isApiSource(value: string): value is ApiSourceType` using `Object.values(ApiSource).some(source => source === value)`. Select with the guard and keep Agregarr as the fallback.

- [x] **Step 3: Update the app test helper**

In `tests/unit/core/app.test.ts`, change `decorateAndCaptureActions`'s `container` parameter from `Element` to `HTMLElement`. Existing callers pass `document.createElement('div')`, so no other test edit is expected.

- [x] **Step 4: Run the app tests, type-check, and the targeted rule**

Run: `npx vitest run tests/unit/core/app.test.ts`

Expected: PASS, including the existing pushState, replaceState, and client-selection coverage.

Run: `npm run type-check`

Expected: PASS.

Run: `npx eslint src/core/app.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/app.ts tests/unit/core/app.test.ts
git commit -m "refactor: narrow app DOM and history types"
```

---

### Task 3: Overlay, modal, and overlay elements

**Files:**

- Modify: `src/core/ui/overlay-styles.ts`
- Modify: `src/core/overlay.ts`
- Modify: `src/core/ui/modal.ts`
- Modify: `src/core/ui/overlay-elements.ts`
- Test: `tests/unit/core/ui/styles/overlay-styles.test.ts`

**Interfaces:**

- Produces: `OVERLAY_CORNERS: readonly ['top-left', 'top-right', 'bottom-left', 'bottom-right']`
- Produces: `type OverlayCorner = (typeof OVERLAY_CORNERS)[number]`
- Produces: `isOverlayCorner(value: string): value is OverlayCorner`
- Produces: `BuildOverlayStylesOptions.corner: OverlayCorner`

- [x] **Step 1: Write the failing corner guard test**

Add to `tests/unit/core/ui/styles/overlay-styles.test.ts`:

```ts
it('recognizes only the four overlay corners', () => {
    expect(isOverlayCorner('top-left')).toBe(true);
    expect(isOverlayCorner('top-right')).toBe(true);
    expect(isOverlayCorner('bottom-left')).toBe(true);
    expect(isOverlayCorner('bottom-right')).toBe(true);
    expect(isOverlayCorner('middle')).toBe(false);
});
```

Import `isOverlayCorner` from `../../../../../src/core/ui/overlay-styles`.

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/core/ui/styles/overlay-styles.test.ts -t "four overlay corners"`

Expected: FAIL because `isOverlayCorner` is not exported.

- [x] **Step 3: Export the corner vocabulary and use it**

In `src/core/ui/overlay-styles.ts`:

- Export `OVERLAY_CORNERS` as a frozen tuple, `type OverlayCorner`, and `isOverlayCorner` implemented with `OVERLAY_CORNERS.some(corner => corner === value)`.
- Use `OverlayCorner` in `BuildOverlayStylesOptions`.

In `src/core/overlay.ts`, import `isOverlayCorner` and `OverlayCorner` from `./ui/overlay-styles`, remove the local `OverlayCorner`, read the configured value, and use it when the guard accepts it, falling back to `top-left`.

In `src/core/ui/modal.ts`, use `querySelector<HTMLElement>('.fm-modal-content')` and `querySelector<HTMLElement>('.fm-modal-body')`; narrow `document.activeElement` with `instanceof HTMLElement`.

In `src/core/ui/overlay-elements.ts`, replace `(el.lastChild as HTMLElement).style.color = ...` with a `lastElementChild instanceof HTMLElement` guard around the same assignment.

- [x] **Step 4: Run the overlay, modal, and element tests plus the targeted rule**

Run: `npx vitest run tests/unit/core/ui/styles/overlay-styles.test.ts tests/unit/core/overlay.test.ts tests/unit/core/ui/modal.test.ts tests/unit/core/ui/elements/overlay-elements.test.ts`

Expected: PASS.

Run: `npx eslint src/core/overlay.ts src/core/ui/overlay-styles.ts src/core/ui/modal.ts src/core/ui/overlay-elements.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/overlay-styles.ts src/core/overlay.ts src/core/ui/modal.ts src/core/ui/overlay-elements.ts tests/unit/core/ui/styles/overlay-styles.test.ts
git commit -m "refactor: replace overlay and modal assertions with guards"
```

---

### Task 4: Settings view concrete element types

**Files:**

- Modify: `src/core/ui/settings-view.ts`
- Test: `tests/unit/core/ui/settings-view.test.ts`
- Test: `tests/unit/core/ui/settings-ui.test.ts`

**Interfaces:**

- Produces: `#createInput(field: SettingConfigField, settings: Record<string, unknown>): HTMLInputElement | HTMLSelectElement`
- Produces: `#groupFieldsByGroup(): SettingsGroup[]` backed by `Map<GroupKey, ConfigField[]>`

- [x] **Step 1: Confirm the current findings**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 7 findings.

- [x] **Step 2: Replace the lookups and element casts**

In `src/core/ui/settings-view.ts`:

- Change `fieldsByGroup` from `Record<string, ConfigField[]>` to `Map<GroupKey, ConfigField[]>`, update `#addFieldToGroup` and `#buildGroupElements`, and read `GROUPS[groupId]` directly.
- Add `function isRowLabelKey(value: string): value is RowLabelKey` using `Object.hasOwn(ROW_LABELS, value)`, and use it for the `ROW_LABELS` lookup with an `undefined` fallback.
- In `#createInput`, create the concrete element in each branch: `select` for select fields and `input` for checkbox and text fields. Set class, name, id, disabled, and short on the concrete element. Return `HTMLInputElement | HTMLSelectElement`.
- In `#setupAutoSave`, use `input instanceof HTMLInputElement` for the checkbox event check.

- [x] **Step 3: Run the settings tests and the targeted rule**

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts tests/unit/core/ui/settings-ui.test.ts`

Expected: PASS.

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 4: Commit**

```bash
git add src/core/ui/settings-view.ts
git commit -m "refactor: build settings inputs with concrete types"
```

---

### Task 5: Config defaults completeness guard

**Files:**

- Modify: `src/core/config/config-fields.ts`
- Modify: `src/core/config/index.ts`
- Test: `tests/unit/core/config/config-fields.test.ts`

**Interfaces:**

- Produces: `isCompleteSettingsMap(value: Partial<Record<ConfigFieldKey, ConfigValueType>>): value is Record<SettingKey, ConfigValueType>`
- Produces: `CONFIG_DEFAULTS: Record<SettingKey, ConfigValueType>`

- [x] **Step 1: Write the failing guard test**

Add to `tests/unit/core/config/config-fields.test.ts`:

```ts
describe('isCompleteSettingsMap', () => {
    it('accepts the built defaults and rejects a missing setting', () => {
        expect(isCompleteSettingsMap(CONFIG_DEFAULTS)).toBe(true);

        const { debug: _debug, ...withoutDebug } = CONFIG_DEFAULTS;
        expect(isCompleteSettingsMap(withoutDebug)).toBe(false);
    });
});
```

Import `isCompleteSettingsMap` from `../../../../src/core/config/index`.

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/core/config/config-fields.test.ts -t "isCompleteSettingsMap"`

Expected: FAIL because the guard is not exported.

- [x] **Step 3: Add the predicate and remove the assertion**

In `src/core/config/config-fields.ts`, export `isCompleteSettingsMap` with JSDoc. Implement it by checking that every field where `isSettingField(field)` is true has its key present in the value.

After the defaults loop, check the map with the predicate and throw a plain `Error` naming the invariant when it fails, then export `CONFIG_DEFAULTS: Record<SettingKey, ConfigValueType> = configDefaults`. The throw is unreachable for the static config table because every setting field already requires a `default`.

Add the helper to the `src/core/config/index.ts` export list in sorted position.

- [x] **Step 4: Run the config tests and the targeted rule**

Run: `npx vitest run tests/unit/core/config/config-fields.test.ts tests/unit/core/config/config-manager.test.ts`

Expected: PASS.

Run: `npx eslint src/core/config --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/config/config-fields.ts src/core/config/index.ts tests/unit/core/config/config-fields.test.ts
git commit -m "refactor: narrow config defaults with a completeness guard"
```

---

### Task 6: Record guard for stored data and migrations

**Files:**

- Modify: `src/core/parse-utils.ts`
- Modify: `src/core/migrations.ts`
- Test: `tests/unit/core/parse-utils.test.ts`
- Test: `tests/unit/core/migrations.test.ts`

**Interfaces:**

- Produces: `isRecord(value: unknown): value is Record<string, unknown>`
- Consumes: `assertRecord` keeps its current throwing contract and uses `isRecord`.

- [x] **Step 1: Write the failing guard tests**

Add to `tests/unit/core/parse-utils.test.ts`:

```ts
describe('isRecord', () => {
    it('accepts a plain object', () => expect(isRecord({ a: 1 })).toBe(true));
    it('rejects null', () => expect(isRecord(null)).toBe(false));
    it('rejects an array', () => expect(isRecord([])).toBe(false));
    it('rejects a primitive', () => expect(isRecord('text')).toBe(false));
});
```

Import `isRecord` from `../../../../src/core/parse-utils`.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/parse-utils.test.ts -t "isRecord"`

Expected: FAIL because `isRecord` is not exported.

- [x] **Step 3: Implement the guard and use it in migrations**

In `src/core/parse-utils.ts`, export `isRecord` with JSDoc. Implement `assertRecord` by calling `isRecord` and throwing the existing `ParseError` message when it returns false.

In `src/core/migrations.ts`, replace both
`const data = entry?.data as Record<string, unknown> | undefined;` lines with
`const data = isRecord(entry.data) ? entry.data : undefined;`.

Keep the existing delete, skip, and `updates` behavior unchanged.

- [x] **Step 4: Run the parser and migration tests plus the targeted rule**

Run: `npx vitest run tests/unit/core/parse-utils.test.ts tests/unit/core/migrations.test.ts`

Expected: PASS.

Run: `npx eslint src/core/parse-utils.ts src/core/migrations.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/parse-utils.ts src/core/migrations.ts tests/unit/core/parse-utils.test.ts
git commit -m "refactor: guard stored migration records"
```

---

### Task 7: Stored ID overrides

**Files:**

- Modify: `src/core/id-override-manager.ts`
- Test: `tests/unit/core/id-override-manager.test.ts`

**Interfaces:**

- Consumes: `isRecord` and `optionalString` from `./parse-utils`.
- Produces: `getImdbId(displayTitle: string): Promise<string | undefined>` with unchanged signature.

- [x] **Step 1: Write the failing validation test**

Add to the `getImdbId` tests in `tests/unit/core/id-override-manager.test.ts`:

```ts
it('returns undefined when imdbId is not a string', async () => {
    mockAdapter.storageGet.mockResolvedValue('{"imdbId":123}');
    const result = await manager.getImdbId('Numeric ID Movie');
    expect(result).toBeUndefined();
});

it.each(['[]', 'true', '"tt123"'])('returns undefined when the payload is not an object: %s', async payload => {
    mockAdapter.storageGet.mockResolvedValue(payload);
    await expect(manager.getImdbId('Non Object Movie')).resolves.toBeUndefined();
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/core/id-override-manager.test.ts -t "not a string"`

Expected: FAIL because the current code returns the number `123`.

- [x] **Step 3: Validate the stored value instead of asserting**

In `src/core/id-override-manager.ts`, return `undefined` when the raw storage value is not a string. Parse it as `unknown`, require `isRecord`, and read `imdbId` with `optionalString`. Keep the existing `try`/`catch` so both invalid JSON and a `ParseError` become `undefined`.

- [x] **Step 4: Run the ID override tests and the targeted rule**

Run: `npx vitest run tests/unit/core/id-override-manager.test.ts`

Expected: PASS.

Run: `npx eslint src/core/id-override-manager.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/id-override-manager.ts tests/unit/core/id-override-manager.test.ts
git commit -m "refactor: validate stored ID overrides"
```

---

### Task 8: Request queue erased items

**Files:**

- Modify: `src/core/request-queue.ts`
- Test: `tests/unit/core/request-queue.test.ts`

**Interfaces:**

- Produces: `interface QueueItem { url: string; priority: number; reject: (_reason: unknown) => void; run: (_url: string) => Promise<void> }`
- Produces: `enqueue<T>(url: string, priority: number, fetchFn: (_urlParam: string) => Promise<T>): Promise<T>` with unchanged signature.
- Produces: `#dispatchNextRequest(): Promise<void>` and `#process(): Promise<void>` drop their generic parameters.

- [x] **Step 1: Write the failing rejection test**

Add to `tests/unit/core/request-queue.test.ts`:

```ts
it('rejects the caller with the original fetch error', async () => {
    const queue = buildQueue(0);
    const error = new Error('fetch failed');

    await expect(queue.enqueue('url', 1, () => Promise.reject(error))).rejects.toBe(error);
});
```

- [x] **Step 2: Run the test to confirm the current behavior before refactoring**

Run: `npx vitest run tests/unit/core/request-queue.test.ts -t "original fetch error"`

Expected: PASS. This is a characterization test for the refactor; the red signal is the rule.

- [x] **Step 3: Replace the resolve and fetch-function casts with a run closure**

In `src/core/request-queue.ts`, change `QueueItem` to the erased shape in Interfaces. In `enqueue`, push an item whose `run` closure awaits `fetchFn(url)`, resolves the caller on success, and rejects on failure. Type `reject` directly from the promise executor.

Make `#process` and `#dispatchNextRequest` non-generic. In `#dispatchNextRequest`, call `await item.run(item.url)`. Leave pacing, priority sorting, cross-tab synchronization, and `clear()` semantics unchanged.

- [x] **Step 4: Run the queue tests and the targeted rule**

Run: `npx vitest run tests/unit/core/request-queue.test.ts`

Expected: PASS, including clear, priority, pacing, and rejection coverage.

Run: `npx eslint src/core/request-queue.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/request-queue.ts tests/unit/core/request-queue.test.ts
git commit -m "refactor: erase request queue items with run closures"
```

---

### Task 9: Debounce return type

**Files:**

- Modify: `src/core/utils/general-utils.ts`
- Test: `tests/unit/core/utils/general-utils.test.ts`

**Interfaces:**

- Produces: `DebouncedFunction<T> = (this: unknown, ..._args: Parameters<T>) => void`
- Produces: `debounce<T extends (..._args: unknown[]) => unknown>(func: T, wait: number): DebouncedFunction<T>`

- [x] **Step 1: Write the return-value test**

Add to the `debounce` tests in `tests/unit/core/utils/general-utils.test.ts`:

```ts
it('returns undefined because the call is deferred', () => {
    const debounced = debounce(vi.fn(), 100);
    expect(debounced()).toBeUndefined();
});
```

- [x] **Step 2: Run the test**

Run: `npx vitest run tests/unit/core/utils/general-utils.test.ts -t "call is deferred"`

Expected: PASS at runtime; the signature still lies about the return type.

- [x] **Step 3: Correct the type and remove the assertion**

Change `DebouncedFunction` to return `void`, type the implementation's `this` as `unknown`, and return the function directly without `as DebouncedFunction<T>`. Keep `func.apply(this, args)` so the context test still passes.

- [x] **Step 4: Run the utility tests, type-check, and the targeted rule**

Run: `npx vitest run tests/unit/core/utils/general-utils.test.ts`

Expected: PASS.

Run: `npm run type-check`

Expected: PASS.

Run: `npx eslint src/core/utils/general-utils.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/utils/general-utils.ts tests/unit/core/utils/general-utils.test.ts
git commit -m "refactor: type debounce return as void"
```

---

### Task 10: API manager error narrowing

**Files:**

- Modify: `src/core/api-manager.ts`
- Test: `tests/unit/core/api-manager.test.ts`

**Interfaces:**

- Consumes: `FlixMonkeyError` from `./utils/index`.
- Produces: `#fetch(displayTitle: string, imdbId?: string): Promise<Title>` with unchanged behavior for `FlixMonkeyError`, `Error`, and non-Error rejections.

- [x] **Step 1: Write the failing non-Error rejection test**

Add to `tests/unit/core/api-manager.test.ts`:

```ts
it('handles a non-Error rejection without metadata', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(undefined), write: vi.fn() };
    const mockClient: ApiClient = {
        source: 'xmdb',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockRejectedValue('boom'),
        disable: vi.fn(),
    };
    const mockLogger = buildLogger().build();
    const manager = new ApiClientManager(mockLogger, mockCache, disabledManager, mockClient);

    const result = await manager.getData('Broken Movie');

    expect(result.hasRating).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Broken Movie'), {
        url: undefined,
        status: undefined,
        body: undefined,
    });
});
```

- [x] **Step 2: Run the test to confirm the current behavior**

Run: `npx vitest run tests/unit/core/api-manager.test.ts -t "non-Error rejection"`

Expected: PASS. This is a characterization test; the red signal is the rule.

- [x] **Step 3: Narrow with `instanceof` instead of a shape cast**

In `src/core/api-manager.ts`, replace the `err as { ... }` object with:

- `const message = err instanceof Error ? err.message : ''`
- `url`, `status`, and `body` read only when `err instanceof FlixMonkeyError`, otherwise `undefined`.

Keep the `isHttpError` calculation, the disable rule for 4xx, the error-versus-warn selection, and the exact logger context shape `{ url, status, body }`, including explicit `undefined` values.

- [x] **Step 4: Run the manager tests and the targeted rule**

Run: `npx vitest run tests/unit/core/api-manager.test.ts`

Expected: PASS, including the existing 4xx, 5xx, metadata logging, and plain-Error tests.

Run: `npx eslint src/core/api-manager.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 5: Commit**

```bash
git add src/core/api-manager.ts tests/unit/core/api-manager.test.ts
git commit -m "refactor: narrow API errors with instanceof"
```

---

### Task 11: Extension message parser and targets

**Files:**

- Create: `src/targets/extension/messages.ts`
- Modify: `src/targets/chrome/service-worker.ts`
- Modify: `src/targets/firefox/background.ts`
- Create: `tests/unit/targets/extension/messages.test.ts`
- Test: `tests/unit/targets/chrome/service-worker.test.ts`
- Test: `tests/unit/targets/firefox/background.test.ts`

**Interfaces:**

- Produces: `interface FMRunMigrationsMessage { type: 'FM_RUN_MIGRATIONS' }`
- Produces: `interface FMFetchMessage { type: 'FM_FETCH'; url: string; options?: HttpFetchOptions }`
- Produces: `type ExtensionMessage = FMRunMigrationsMessage | FMFetchMessage`
- Produces: `parseExtensionMessage(value: unknown): ExtensionMessage | undefined`

- [x] **Step 1: Write the failing parser tests**

Create `tests/unit/targets/extension/messages.test.ts` with cases that assert:

```ts
expect(parseExtensionMessage({ type: 'FM_RUN_MIGRATIONS' })).toEqual({ type: 'FM_RUN_MIGRATIONS' });
expect(parseExtensionMessage({ type: 'FM_FETCH', url: 'https://xmdbapi.com' })).toEqual({
    type: 'FM_FETCH',
    url: 'https://xmdbapi.com',
});
expect(
    parseExtensionMessage({
        type: 'FM_FETCH',
        url: 'https://xmdbapi.com',
        options: { responseType: 'text', timeout: 1234, ignored: true },
    })
).toEqual({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'text', timeout: 1234 } });
expect(parseExtensionMessage({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: {} })).toEqual({
    type: 'FM_FETCH',
    url: 'https://xmdbapi.com',
    options: {},
});
```

And rejects each of these with `toBeUndefined()`:

```ts
null
[]
'FM_FETCH'
{}
{ type: 'OTHER' }
{ type: 'FM_FETCH' }
{ type: 'FM_FETCH', url: 42 }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: 42 }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: [] }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'xml' } }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: -1 } }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: Number.NaN } }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: Number.POSITIVE_INFINITY } }
{ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: '5' } }
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/targets/extension/messages.test.ts`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement the parser**

Create `src/targets/extension/messages.ts` with the types and signature above. Require a non-null, non-array object. Accept `type: 'FM_RUN_MIGRATIONS'`. Accept `FM_FETCH` only with a string `url`.

When `options` is present and not `undefined`, it must be a non-null, non-array object. Rebuild a fresh `HttpFetchOptions`: copy `responseType` only when it is `json` or `text`, and `timeout` only when it is a finite number greater than or equal to zero. Reject the whole message when a present field is invalid. Ignore unknown keys. Omit absent fields so `exactOptionalPropertyTypes` is satisfied.

- [x] **Step 4: Run the parser tests**

Run: `npx vitest run tests/unit/targets/extension/messages.test.ts`

Expected: PASS.

- [x] **Step 5: Wire both targets to the parser**

In `src/targets/chrome/service-worker.ts` and
`src/targets/firefox/background.ts`, delete the local message interfaces and
`ExtensionMessage` alias, import the shared types and parser, and replace
`const message = msg as ExtensionMessage` with:

- Chrome: `const message = parseExtensionMessage(msg); if (!message) return false;`
- Firefox: `const message = parseExtensionMessage(msg); if (!message) return undefined;`

Keep the sender check before parsing and keep every existing response path.

- [x] **Step 6: Add one target-level malformed-options test per target**

Chrome: add a test asserting `messageListener({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'xml' } }, { id: 'test-ext' }, sendResponse)` returns `false` and never calls `sendResponse`.

Firefox: add a test asserting the same message resolves to `undefined`.

- [x] **Step 7: Run the target and parser tests plus the targeted rule**

Run: `npx vitest run tests/unit/targets/extension/messages.test.ts tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts`

Expected: PASS, including the existing custom-timeout and default-timeout tests.

Run: `npx eslint src/targets/extension/messages.ts src/targets/chrome/service-worker.ts src/targets/firefox/background.ts --rule '{"@typescript-eslint/no-unsafe-type-assertion":"error"}'`

Expected: 0 problems.

- [x] **Step 8: Commit**

```bash
git add src/targets/extension/messages.ts src/targets/chrome/service-worker.ts src/targets/firefox/background.ts tests/unit/targets/extension/messages.test.ts tests/unit/targets/chrome/service-worker.test.ts tests/unit/targets/firefox/background.test.ts
git commit -m "refactor: parse extension messages instead of casting"
```

---

### Task 12: Enable the rule and verify the whole branch

**Files:**

- Modify: `eslint.config.js`

**Interfaces:**

- Produces: `@typescript-eslint/no-unsafe-type-assertion: 'error'` in `typescriptRules`.
- Produces: `@typescript-eslint/no-unsafe-type-assertion: 'off'` in the `tests/**/*.ts` relaxation block.

- [x] **Step 1: Enable the rule with an explicit test exception**

Add `'@typescript-eslint/no-unsafe-type-assertion': 'error',` to `typescriptRules` in `eslint.config.js`. Add `'@typescript-eslint/no-unsafe-type-assertion': 'off',` to the `files: ['tests/**/*.ts']` block and update its comment to name narrowing assertions in mocks and fixtures.

- [x] **Step 2: Confirm no findings remain in `src/`**

Run: `npx eslint "src/**/*.ts"`

Expected: 0 problems. Any remaining finding is a missed site from Tasks 1 to 11; fix it in the owning file with a follow-up commit.

- [x] **Step 3: Run the required checks**

Run: `npm run type-check`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with the rule enabled.

Run: `npm test`

Expected: PASS, including all new tests.

- [x] **Step 4: Run the remaining pull-request checks**

Run: `npm run format:check`

Expected: PASS.

Run: `npm run build`

Expected: all three targets build and package.

- [x] **Step 5: Confirm no new disable comments**

Run: `git diff main -- src eslint.config.js | rg "eslint-disable"`

Expected: no new disable comment. The existing `promise-function-async` disable in `src/targets/extension/migrations.ts` and the documented `max-params` disable in `src/core/app.ts` are unchanged.

- [x] **Step 6: Commit**

```bash
git add eslint.config.js docs/superpowers/plans/2026-11-12-no-unsafe-type-assertions.md
git commit -m "chore: enable no-unsafe-type-assertion for source"
```

The plan file is staged here so its completed checkboxes are committed with the final task. If execution continued in a later session, stage the plan file with each task commit instead.
