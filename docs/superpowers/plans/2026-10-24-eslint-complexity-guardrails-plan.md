# ESLint Size Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `max-params: 4`, `complexity: 10`, and `sonarjs/cognitive-complexity: 10` to ESLint and refactor every function those limits flag, without changing behavior.

**Architecture:** Two PRs. Each refactors the flagged code first, then enables its limit last, so every commit on the branch is green. One shared dependency shape replaces the repeated API client constructor arguments; the remaining violations are extracted helper functions. `src/core/migrations.ts` is the only exclusion, and the `FlixMonkeyApp` constructor is the only inline exception.

**Tech Stack:** TypeScript, ESLint 10 flat config, `@typescript-eslint` 8, `eslint-plugin-sonarjs` 4, Vitest, Rollup.

**Spec:** `docs/superpowers/specs/2026-10-24-eslint-complexity-guardrails-design.md`

## Global Constraints

- Node.js >= 24. Do not add runtime dependencies. The only new dev dependency is `eslint-plugin-sonarjs` at `^4.2.2`, and only `sonarjs/cognitive-complexity` is enabled from it.
- Limits: `max-params` 4, cyclomatic `complexity` 10, `sonarjs/cognitive-complexity` 10, for `src/` and `tests/`.
- Every change is behavior-preserving. Existing assertions must pass unchanged; only constructor and call-site signatures may be edited in tests.
- No new disable comments except the single documented one on the `FlixMonkeyApp` constructor.
- No reference to any local or transient tracking file in code, comments, commits, or docs. The design document is the tracking anchor.
- Conventional Commits, lowercase imperative, no trailing period. Branch names: `refactor/lint-max-params` and `refactor/lint-complexity`.
- ASCII only. Prose: no em-dashes, Oxford comma.
- Before each PR: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`.

## Review Focus

1. Overlay DOM stays identical for every surface fixture and for the fade toggle shown and hidden states (`tests/ui/`, `tests/unit/core/overlay.test.ts`).
2. Settings rows keep every shape: action rows, checkbox groups, suffix inputs, linked labels, disabled fields (`tests/unit/core/ui/settings-view.test.ts`).
3. XMDb details mapping still falls back to `searchTitle` fields when the response omits `title`, `release_year`, `rating`, `metascore`, or `vote_count` (`tests/unit/core/api/xmdb-api-client.test.ts`).
4. HBO Max extraction still returns `undefined` for non-title tiles and picks the watch pattern set for `sonicType === 'video'` (`tests/unit/core/surfaces/surfaces.test.ts`, `tests/ui/hbomax.ui.test.ts`).
5. `SettingsUI` save, clear-cache, and reset-clients actions still dispatch through the dependency object (`tests/unit/core/ui/settings-ui.test.ts`).

---

## Task 0: Commit the design and plan

**Files:**

- Create: `docs/superpowers/specs/2026-10-24-eslint-complexity-guardrails-design.md` (already written)
- Create: `docs/superpowers/plans/2026-10-24-eslint-complexity-guardrails-plan.md` (this file)

**Interfaces:**

- Consumes: nothing.
- Produces: the spec and plan files that later tasks cite.

- [x] **Step 1: Create the branch**

```bash
git switch -c refactor/lint-max-params
```

- [x] **Step 2: Stage only the two documents**

```bash
git add docs/superpowers/specs/2026-10-24-eslint-complexity-guardrails-design.md docs/superpowers/plans/2026-10-24-eslint-complexity-guardrails-plan.md
```

- [x] **Step 3: Commit**

```bash
git commit -m "docs: add complexity guardrail design and plan"
```

---

## Task 1: Shared `ApiClientDeps`

**Files:**

- Modify: `src/core/api/base-api-client.ts:50` (constructor), export `ApiClientDeps`
- Modify: `src/core/api/agregarr-api-client.ts:31`
- Modify: `src/core/api/omdb-api-client.ts:60`
- Modify: `src/core/api/xmdb-api-client.ts:29`
- Modify: `src/core/api/index.ts` (re-export the type)
- Modify: `src/core/app.ts:371` (`createApiClient`), `src/core/app.ts:392` (`startApp`)
- Test: `tests/unit/core/api/base-api-client.test.ts`, `tests/unit/core/api/agregarr-api-client.test.ts`, `tests/unit/core/api/omdb-api-client.test.ts`, `tests/unit/core/api/xmdb-api-client.test.ts`, `tests/unit/core/app.test.ts`, `tests/integration/api-clients.test.ts`

**Interfaces:**

- Consumes: existing `PlatformAdapter`, `ConfigManager`, `DisabledClientsManager`, `Logger`, `IdOverrideManager`, `RequestQueue`, `ApiSourceType`.
- Produces:
    - `export interface ApiClientDeps { adapter: PlatformAdapter; config: ConfigManager; disabledManager: DisabledClientsManager; logger: Logger; overrideManager: IdOverrideManager; }`
    - `BaseApiClient` constructor: `(deps: ApiClientDeps, queue: RequestQueue, source: ApiSourceType)`
    - Each concrete client: `constructor(deps: ApiClientDeps)`
    - `createApiClient(deps: ApiClientDeps): BaseApiClient` (still module-private in `app.ts`)
    - `export type { ApiClientDeps } from './base-api-client';` in `src/core/api/index.ts`

- [x] **Step 1: Confirm the red state**

Run: `npx eslint src/core/api src/core/app.ts --rule '{"@typescript-eslint/max-params":["error",{"max":4}]}'`
Expected: 6 errors at the five constructors and `createApiClient`.

- [x] **Step 2: Add `ApiClientDeps` and change `BaseApiClient`**

Export the interface from `base-api-client.ts`. Replace the seven constructor parameters with `(deps, queue, source)` and assign fields from `deps`. Update the JSDoc to `@param deps - Dependencies shared by every API client.`

- [x] **Step 3: Change the three subclass constructors**

Each becomes `constructor(deps: ApiClientDeps)`. Keep the existing rate-limit lookup and pass
`super(deps, new RequestQueue(deps.adapter, minIntervalMs, syncKey), ApiSource.<PROVIDER>)`.

- [x] **Step 4: Change `createApiClient` and `startApp`**

`createApiClient(deps: ApiClientDeps)` reads the provider from `deps.config` and returns
`new ClientClass(deps)`. In `startApp`, build the object once after `overrideManager`:

```ts
const clientDeps: ApiClientDeps = {
    adapter,
    config: configManager,
    disabledManager,
    logger,
    overrideManager,
};
const client = createApiClient(clientDeps);
```

- [x] **Step 5: Update the tests**

Import the type with `import type { ApiClientDeps } from '../../../../src/core/api/index';` (adjust the depth per file). In each API client unit test and `tests/unit/core/app.test.ts`, build a local
`const deps: ApiClientDeps = { adapter: mockAdapter, config: mockConfig, disabledManager: mockDisabledManager, logger: mockLogger, overrideManager: mockOverrideManager };`
and pass it. `StubClient` in `base-api-client.test.ts` becomes `constructor(deps: ApiClientDeps, queue: RequestQueue, source: ApiSourceType)` calling `super({ ...deps, logger }, queue, source)`. In `tests/integration/api-clients.test.ts`, add a local
`const clientDeps = (): ApiClientDeps => ({ adapter: adapter as PlatformAdapter, config: configManager, disabledManager, logger, overrideManager });`
and replace every five-argument construction with `new <Client>(clientDeps())`.

- [x] **Step 6: Verify green and behavior**

Run: `npx eslint src/core/api src/core/app.ts --rule '{"@typescript-eslint/max-params":["error",{"max":4}]}'`
Expected: one error left, the `FlixMonkeyApp` constructor in `src/core/app.ts`, which Task 4 handles.

Run: `npm run type-check && npx vitest run tests/unit/core/api tests/unit/core/app.test.ts`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/api src/core/app.ts tests/unit/core/api tests/unit/core/app.test.ts tests/integration/api-clients.test.ts
git commit -m "refactor: pass api client dependencies as one object"
```

---

## Task 2: `injectOverlay` interaction object

**Files:**

- Modify: `src/core/overlay.ts:105`
- Modify: `src/core/app.ts` (`#decorateContainer`, the `injectOverlay` call near line 238)
- Test: `tests/helpers/surface-tests.ts:48`, `tests/unit/core/overlay.test.ts:20`

**Interfaces:**

- Consumes: `OverlayOptions` from `src/core/ui/overlay-elements.ts`.
- Produces:
    - `export type OverlayInteraction = Pick<OverlayOptions, 'displayTitle' | 'onEditClick' | 'onRefreshClick' | 'fadeToggleState' | 'onFadeToggleClick'>;`
    - `injectOverlay(container: HTMLElement, titleObj: Title, interaction: OverlayInteraction): void`

- [x] **Step 1: Confirm the red state**

Run: `npx eslint src/core/overlay.ts --rule '{"@typescript-eslint/max-params":["error",{"max":4}]}'`
Expected: one error, `injectOverlay` has 7 parameters.

- [x] **Step 2: Add `OverlayInteraction`**

Declare it in `overlay.ts` next to `OverlayCorner`. Change the method to take `interaction` and
spread it into the object passed to `createOverlayElement`, keeping the config-derived keys as
they are.

- [x] **Step 3: Update the call sites**

In `app.ts`, pass `{ displayTitle, onEditClick, onRefreshClick, fadeToggleState: showFadeToggle ? fadeOverride : undefined, onFadeToggleClick: ... }` as the third argument. In `tests/helpers/surface-tests.ts` and `tests/unit/core/overlay.test.ts`, pass the same five keys as an object literal.

- [x] **Step 4: Verify green and behavior**

Run: `npx eslint src/core/overlay.ts --rule '{"@typescript-eslint/max-params":["error",{"max":4}]}'`
Expected: no output.

Run: `npm run type-check && npx vitest run tests/unit/core/overlay.test.ts tests/ui`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/overlay.ts src/core/app.ts tests/helpers/surface-tests.ts tests/unit/core/overlay.test.ts
git commit -m "refactor: group overlay interaction options"
```

---

## Task 3: `SettingsUI` dependency object

**Files:**

- Modify: `src/core/ui/settings-ui.ts:31`
- Modify: `src/targets/extension/options.ts:34`
- Modify: `src/targets/userscript/entry.ts:49`
- Test: `tests/unit/core/ui/settings-ui.test.ts:40,110`

**Interfaces:**

- Consumes: `PlatformAdapter`, `Logger`, `CacheManager`, `DisabledClientsManager`, `ConfigField`, `CONFIG_FIELDS`.
- Produces:
    - `export interface SettingsUIDeps { adapter: PlatformAdapter; logger: Logger; cacheManager: CacheManager; disabledClientsManager: DisabledClientsManager; }`
    - `constructor(deps: SettingsUIDeps, fields: readonly ConfigField[] = CONFIG_FIELDS)`

- [x] **Step 1: Confirm the red state**

Run: `npx eslint src/core/ui/settings-ui.ts --rule '{"@typescript-eslint/max-params":["error",{"max":4}]}'`
Expected: one error, constructor has 5 parameters.

- [x] **Step 2: Add `SettingsUIDeps` and update the constructor**

Export the interface, change the constructor to `(deps, fields = CONFIG_FIELDS)`, and assign the four fields from `deps`.

- [x] **Step 3: Update the two production call sites and two test call sites**

Both targets pass `{ adapter, logger, cacheManager, disabledClientsManager }` as the first argument. The test at line 110 keeps its field array as the second argument.

- [x] **Step 4: Verify green and behavior**

Run: `npx eslint src/core/ui/settings-ui.ts --rule '{"@typescript-eslint/max-params":["error",{"max":4}]}'`
Expected: no output.

Run: `npm run type-check && npx vitest run tests/unit/core/ui/settings-ui.test.ts tests/unit/targets`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/ui/settings-ui.ts src/targets/extension/options.ts src/targets/userscript/entry.ts tests/unit/core/ui/settings-ui.test.ts
git commit -m "refactor: pass settings ui dependencies as one object"
```

---

## Task 4: Enable `max-params` 4

**Files:**

- Modify: `eslint.config.js:11-53`
- Modify: `src/core/app.ts:57` (one disable comment)
- Modify: `AGENTS.md` (Conventions)

**Interfaces:**

- Consumes: the fixes from Tasks 1 to 3.
- Produces: the rule pair `max-params` (JS) and `@typescript-eslint/max-params` (TS), both at 4.

- [x] **Step 1: Add the rules**

In `commonRules`: `'max-params': ['error', 4]`. In `typescriptRules`, next to the existing `no-unused-vars` split: `'max-params': 'off'` and `'@typescript-eslint/max-params': ['error', { max: 4 }]`.

- [x] **Step 2: Add the one documented exception**

Above the `FlixMonkeyApp` constructor:

```ts
// eslint-disable-next-line @typescript-eslint/max-params -- single wiring point; see AGENTS.md
```

- [x] **Step 3: Document it**

Under Conventions in `AGENTS.md`, add: parameter lists stay at four or fewer; the `FlixMonkeyApp` constructor is the only exception because it is the single wiring point and `startApp()` is its only caller.

- [x] **Step 4: Verify**

Run: `npm run lint`
Expected: exit 0, no output.

Run: `npm run type-check && npm test && npm run format:check && npm run build`
Expected: PASS.

- [x] **Step 5: Commit and open the PR**

```bash
git add eslint.config.js src/core/app.ts AGENTS.md
git commit -m "build: enforce a four-parameter limit"
```

Then push and open the PR with `.github/pull_request_template.md` filled in. Title: `build: enforce a four-parameter limit`.

---

## Task 5: Add `eslint-plugin-sonarjs` and register it

**Files:**

- Modify: `package.json`, `package-lock.json`
- Modify: `eslint.config.js` (imports and both `plugins` blocks)

**Interfaces:**

- Consumes: nothing.
- Produces: the `sonarjs` plugin registered for JS and TS, with no rules enabled yet, so `--rule '{"sonarjs/cognitive-complexity":["error",10]}'` works in later tasks.

- [ ] **Step 1: Create the branch**

```bash
git switch main && git pull && git switch -c refactor/lint-complexity
```

- [ ] **Step 2: Install and register**

```bash
npm install --save-dev eslint-plugin-sonarjs@^4.2.2
```

Add `import sonarjs from 'eslint-plugin-sonarjs';` and register `sonarjs` in the `plugins` object of both the JS and TS config blocks.

- [ ] **Step 3: Verify the plugin loads**

Run: `npx eslint src/core/app.ts --rule '{"sonarjs/cognitive-complexity":["error",10]}'`
Expected: no output (the app root is below 10), and no configuration error.

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json eslint.config.js
git commit -m "build: add eslint-plugin-sonarjs"
```

---

## Task 6: `SettingsView.#createFieldValueContainer`

**Files:**

- Modify: `src/core/ui/settings-view.ts:199`
- Test: `tests/unit/core/ui/settings-view.test.ts` (no edits expected)

**Interfaces:**

- Consumes: `SettingsFieldRow`, `isActionField()`, `isSettingField()`, `#createActionField()`, `#createInput()`, `#createInputWithSuffix()`.
- Produces: private helpers `#renderActionFields(fields: readonly ConfigField[]): HTMLElement[]`, `#renderCheckboxGroup(fields: readonly ConfigField[], settings: Record<string, unknown>): HTMLElement`, `#renderSettingFields(fields: readonly ConfigField[], settings: Record<string, unknown>): HTMLElement[]`.

- [ ] **Step 1: Confirm the red state**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"sonarjs/cognitive-complexity":["error",10],"complexity":["error",10]}'`
Expected: errors for `#createFieldValueContainer` (21 cognitive, 11 cyclomatic) and the functions handled in Task 7.

- [ ] **Step 2: Extract the three row shapes**

Move the action branch, the checkbox-group branch, and the default branch each into their own helper, returning the elements to append. `#createFieldValueContainer` becomes: create the container, pick the helper, append, return.

- [ ] **Step 3: Verify green and behavior**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"sonarjs/cognitive-complexity":["error",10]}'`
Expected: no error for `#createFieldValueContainer`.

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts`
Expected: PASS with no test edits.

- [ ] **Step 4: Commit**

```bash
git add src/core/ui/settings-view.ts
git commit -m "refactor: split settings field value rendering"
```

---

## Task 7: `SettingsView.#createFieldLabel`

**Files:**

- Modify: `src/core/ui/settings-view.ts:164`
- Test: `tests/unit/core/ui/settings-view.test.ts` (no edits expected)

**Interfaces:**

- Consumes: `ROW_LABELS`, `SettingsFieldRow`, `isActionField()`.
- Produces: private helpers `#createSpacerLabel(): HTMLLabelElement`, `#createLinkedLabel(field: SettingConfigField, text: string, tooltip: string): HTMLLabelElement`, `#createPlainLabel(field: SettingConfigField, text: string, tooltip: string): HTMLLabelElement`.

- [ ] **Step 1: Confirm the red state**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"complexity":["error",10]}'`
Expected: an error for `#createFieldLabel` (14).

- [ ] **Step 2: Extract the three label variants**

Keep the resolved row label and tooltip in the main method; each helper builds one variant. The linked variant sets `href`, `target`, `textContent`, and the tooltip. The plain variant sets `textContent`, `htmlFor` for a single field without `labelUrl`, and the tooltip.

- [ ] **Step 3: Verify green and behavior**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"complexity":["error",10],"sonarjs/cognitive-complexity":["error",10]}'`
Expected: no error for `#createFieldLabel`.

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts`
Expected: PASS with no test edits.

- [ ] **Step 4: Commit**

```bash
git add src/core/ui/settings-view.ts
git commit -m "refactor: split settings field labels"
```

---

## Task 8: `SettingsView.readValues` and `validate`

**Files:**

- Modify: `src/core/ui/settings-view.ts:365` (`readValues`), `src/core/ui/settings-view.ts:388` (`validate`)
- Test: `tests/unit/core/ui/settings-view.test.ts` (no edits expected)

**Interfaces:**

- Consumes: `ConfigValueType`, `isActionField()`.
- Produces: private helpers `#fieldInput(field: SettingConfigField): HTMLInputElement | undefined` and `#readInputValue(field: SettingConfigField, input: HTMLInputElement): ConfigValueType`, plus `#validateField(field: SettingConfigField, values: Record<string, ConfigValueType>): string | undefined`.

- [ ] **Step 1: Confirm the red state**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"sonarjs/cognitive-complexity":["error",10]}'`
Expected: errors for `readValues` (11) and `validate` (12).

- [ ] **Step 2: Extract**

`#fieldInput` returns `undefined` for action fields, disabled fields, and fields with no rendered input, so both loops reduce to an early-continue plus one call. `#readInputValue` owns the checkbox/text split. `#validateField` runs the validator, toggles the `error` class, and returns the message.

- [ ] **Step 3: Verify green and behavior**

Run: `npx eslint src/core/ui/settings-view.ts --rule '{"sonarjs/cognitive-complexity":["error",10]}'`
Expected: no output.

Run: `npx vitest run tests/unit/core/ui/settings-view.test.ts`
Expected: PASS with no test edits.

- [ ] **Step 4: Commit**

```bash
git add src/core/ui/settings-view.ts
git commit -m "refactor: simplify settings reading and validation"
```

---

## Task 9: HBO Max title extraction

**Files:**

- Modify: `src/core/surfaces/surface-definitions/hbo-max-surfaces.ts:37`
- Test: `tests/unit/core/surfaces/surfaces.test.ts` (no edits expected)

**Interfaces:**

- Consumes: `getNormalizedHboMaxAriaLabel()`, `HBO_MAX_WATCH_TITLE_PATTERNS`, `HBO_MAX_TITLE_PATTERNS`.
- Produces: `function firstMatchingPattern(label: string, patterns: readonly RegExp[]): string | undefined`.

- [ ] **Step 1: Confirm the red state**

Run: `npx eslint src/core/surfaces/surface-definitions/hbo-max-surfaces.ts --rule '{"complexity":["error",10],"sonarjs/cognitive-complexity":["error",10]}'`
Expected: an error for `extractHboMaxTitle` (13 cyclomatic, 11 cognitive).

- [ ] **Step 2: Extract the pattern loop**

`extractHboMaxTitle` keeps: read the label, return `undefined` when empty, dispatch on `dataset.sonicType` (`'video'` uses the watch patterns; movie, show, and mini-series use the title patterns; anything else returns `undefined`).

- [ ] **Step 3: Verify green and behavior**

Run: `npx eslint src/core/surfaces/surface-definitions/hbo-max-surfaces.ts --rule '{"complexity":["error",10],"sonarjs/cognitive-complexity":["error",10]}'`
Expected: no output.

Run: `npx vitest run tests/unit/core/surfaces tests/ui/hbomax.ui.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/surfaces/surface-definitions/hbo-max-surfaces.ts
git commit -m "refactor: simplify hbo max title extraction"
```

---

## Task 10: XMDb details mapping

**Files:**

- Modify: `src/core/api/xmdb-api-client.ts:104` (`getDetails`)
- Test: `tests/unit/core/api/xmdb-api-client.test.ts` (no edits expected)

**Interfaces:**

- Consumes: `Title`, `XmdbDetailsResponse`, `mapXmdbTitleType()`.
- Produces: `function titleFromDetails(searchTitle: Title, id: string, details: XmdbDetailsResponse): Title`.

- [ ] **Step 1: Confirm the red state**

Run: `npx eslint src/core/api/xmdb-api-client.ts --rule '{"complexity":["error",10]}'`
Expected: an error for `getDetails` (11).

- [ ] **Step 2: Extract the mapping**

`getDetails` keeps the fetch, the failure guard, and the log. `titleFromDetails` destructures the response and builds the `Title` with the same `??` fallbacks to `searchTitle`.

- [ ] **Step 3: Verify green and behavior**

Run: `npx eslint src/core/api/xmdb-api-client.ts --rule '{"complexity":["error",10],"sonarjs/cognitive-complexity":["error",10]}'`
Expected: no output.

Run: `npx vitest run tests/unit/core/api/xmdb-api-client.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/api/xmdb-api-client.ts
git commit -m "refactor: extract xmdb details mapping"
```

---

## Task 11: Delete the unused mock parser

**Files:**

- Modify: `tests/mocks/title.ts:124-144`
- Test: `tests/unit/core/title.test.ts` (unchanged)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. Removes `extractFromObj` and `buildTitle.fromCacheJSON`.

- [ ] **Step 1: Confirm there is no caller**

Run: `grep -rn "buildTitle.fromCacheJSON" src tests scripts`
Expected: only the definition in `tests/mocks/title.ts`.

- [ ] **Step 2: Delete both**

Remove the `extractFromObj` function and the `buildTitle.fromCacheJSON` assignment.

- [ ] **Step 3: Verify**

Run: `npx eslint tests/mocks/title.ts --rule '{"complexity":["error",10]}'`
Expected: no output.

Run: `npm run type-check && npx vitest run tests/unit/core/title.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/mocks/title.ts
git commit -m "test: drop unused cache json mock parser"
```

---

## Task 12: Enable the complexity limits

**Files:**

- Modify: `eslint.config.js:11-53`, plus a new exclusion block after the TS block
- Modify: `AGENTS.md` (Conventions)

**Interfaces:**

- Consumes: Tasks 5 to 11.
- Produces: `complexity: ['error', 10]` and `'sonarjs/cognitive-complexity': ['error', 10]` in `commonRules`, and the `src/core/migrations.ts` exclusion.

- [ ] **Step 1: Change the limits**

Set `complexity` to `['error', 10]` and add `'sonarjs/cognitive-complexity': ['error', 10]` in `commonRules`.

- [ ] **Step 2: Add the exclusion**

```js
// Cache migrations are replaced by a cache schema version; see
// docs/superpowers/specs/2026-10-24-eslint-complexity-guardrails-design.md.
{
    files: ['src/core/migrations.ts'],
    plugins: { sonarjs },
    rules: { complexity: 'off', 'sonarjs/cognitive-complexity': 'off' },
}
```

- [ ] **Step 3: Document the limits**

In `AGENTS.md` Conventions, add: cyclomatic complexity and cognitive complexity stay at 10 or below; `src/core/migrations.ts` is exempt from both until the cache schema version replaces the framework.

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: exit 0, no output.

Run: `npm run type-check && npm test && npm run format:check && npm run build`
Expected: PASS.

Run: `npm run test:coverage`
Expected: PASS, thresholds unchanged.

- [ ] **Step 5: Commit and open the PR**

```bash
git add eslint.config.js AGENTS.md
git commit -m "build: enforce complexity limits"
```

Push and open the PR with `.github/pull_request_template.md` filled in. Title: `build: enforce complexity limits`.

---

## Final check before the second PR merges

- [ ] `npm run type-check && npm run lint && npm run format:check && npm test && npm run test:coverage && npm run build` all pass
- [ ] `npx eslint src tests --rule '{"@typescript-eslint/max-params":["error",{"max":4}],"sonarjs/cognitive-complexity":["error",10],"complexity":["error",10]}'` reports only the excluded file
- [ ] Exactly one `max-params` disable directive exists in `src/`: the `FlixMonkeyApp` constructor
- [ ] `git ls-files | grep -i "todo"` returns nothing, and no committed document references a local tracking file
