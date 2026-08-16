# Clean Code UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split settings and overlay presentation into focused modules, shorten application orchestration methods, and order every source class by lifecycle or first use without changing behavior.

**Architecture:** Keep `SettingsUI` and `OverlayRenderer` as public controllers. Move settings DOM ownership to `SettingsView`, overlay element construction to pure exported builders, and overlay CSS generation to a pure function. Decompose `FlixMonkeyApp` with private workflow helpers, then apply semantic lifecycle ordering to all remaining classes.

**Tech Stack:** JavaScript ES2022 modules, DOM APIs, Vitest, jsdom, ESLint, Prettier, and Rollup.

## Global Constraints

- Preserve all existing public APIs, storage formats, CSS behavior, network behavior, messaging, and user-facing text.
- Use ASCII characters unless an existing user-facing or test value specifically requires Unicode.
- Begin every new source and test JavaScript file with the project GPL-3.0 license header.
- Keep settings DOM queries scoped to the rendered container.
- Split tests by production responsibility without duplicating assertions.
- Order class members by constructor, primary operation, helpers in first-use order, secondary workflows, teardown, and accessors.
- For classes without a lifecycle, use semantic consumption order instead of public-first grouping.

---

### Task 1: Extract overlay style generation

**Files:**

- Create: `src/core/ui/overlay-styles.js`
- Create: `tests/unit/core/ui/overlay-styles.test.js`
- Modify: `src/core/overlay.js`
- Modify: `tests/unit/core/overlay.test.js`

**Interfaces:**

- Produces: `buildOverlayStyles({ overlayClass, corner, top10Selectors, top10Offset }): string`
- Consumes: rating overlay class name, configured corner, and service presentation constants.

- [ ] **Step 1: Write the failing pure-style test**

Create `tests/unit/core/ui/overlay-styles.test.js` with the license header and direct tests for the new boundary:

```js
import { describe, expect, it } from 'vitest';

import { buildOverlayStyles } from '../../../../src/core/ui/overlay-styles.js';

describe('buildOverlayStyles', () => {
    it('builds bottom-corner positioning and direction', () => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner: 'bottom-right',
            top10Selectors: [],
            top10Offset: '50%',
        });

        expect(css).toContain('bottom:6px;right:6px;');
        expect(css).toContain('flex-direction: column-reverse');
    });

    it('offsets configured Top 10 selectors on left corners', () => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner: 'top-left',
            top10Selectors: ['.ranked'],
            top10Offset: '30%',
        });

        expect(css).toContain('.ranked .fm-rating-overlay');
        expect(css).toContain('left: calc(30% + 6px)');
    });
});
```

- [ ] **Step 2: Run the test and verify the boundary is missing**

Run: `npx vitest run tests/unit/core/ui/overlay-styles.test.js`

Expected: FAIL because `src/core/ui/overlay-styles.js` does not exist.

- [ ] **Step 3: Move CSS generation into the pure module**

Create `buildOverlayStyles()` by moving the complete CSS template and corner map from `OverlayRenderer.injectStyles()`. Normalize unknown corners before using `includes()`:

```js
export function buildOverlayStyles({ overlayClass, corner, top10Selectors = [], top10Offset = '50%' }) {
    const cornerStyles = {
        'top-left': 'top:6px;left:6px;',
        'top-right': 'top:6px;right:6px;',
        'bottom-left': 'bottom:6px;left:6px;',
        'bottom-right': 'bottom:6px;right:6px;',
    };
    const resolvedCorner = Object.hasOwn(cornerStyles, corner) ? corner : 'top-left';
    const positionCss = cornerStyles[resolvedCorner];
    const flexDirection = resolvedCorner.includes('bottom') ? 'column-reverse' : 'column';
}
```

After these calculations, assign the existing CSS template from `OverlayRenderer.injectStyles()` to `cssText`, replace `this.#OVERLAY_CLASS` with `overlayClass`, replace `TOP_10_SELECTORS` with `top10Selectors`, replace `TOP_10_OFFSET` with `top10Offset`, append the existing left-corner selector rule, and return `cssText`. Do not alter any selector or declaration.

Update `OverlayRenderer.injectStyles()` to read configuration, call `buildOverlayStyles()`, and only update or create `#fm-overlay-styles`.

- [ ] **Step 4: Move style-output assertions and run both suites**

Move corner, direction, Top 10 offset, and base CSS assertions from `overlay.test.js` to `overlay-styles.test.js`. Keep style-element creation and replacement assertions in `overlay.test.js`.

Run: `npx vitest run tests/unit/core/ui/overlay-styles.test.js tests/unit/core/overlay.test.js`

Expected: PASS with no duplicated style-output assertions.

- [ ] **Step 5: Commit the style extraction**

```bash
git add src/core/overlay.js src/core/ui/overlay-styles.js tests/unit/core/overlay.test.js tests/unit/core/ui/overlay-styles.test.js
git commit -m "refactor(overlay): extract style generation"
```

### Task 2: Extract overlay element construction and split tests

**Files:**

- Create: `src/core/ui/overlay-elements.js`
- Create: `tests/unit/core/ui/overlay-elements.test.js`
- Modify: `src/core/overlay.js`
- Modify: `tests/unit/core/overlay.test.js`

**Interfaces:**

- Produces: `createOverlayElement(title, options): HTMLElement`
- Produces: `createLoadingOverlayElement(overlayClass, loadingClass): HTMLElement`
- Consumes: `showRtRating`, `showMcRating`, `showFadeToggle`, `fadeToggleState`, and `onFadeToggleClick` as explicit options.

- [ ] **Step 1: Write the failing element-builder test**

Create `overlay-elements.test.js` with the license header and this initial boundary test:

```js
import { describe, expect, it } from 'vitest';

import { createOverlayElement } from '../../../../src/core/ui/overlay-elements.js';
import { Title } from '../../../../src/core/title.js';

describe('createOverlayElement', () => {
    it('builds the IMDb rating link', () => {
        const element = createOverlayElement(new Title({ imdbId: 'tt1234567', rating: 7.5 }), {
            overlayClass: 'fm-rating-overlay',
            showRtRating: false,
            showMcRating: false,
            showFadeToggle: false,
            fadeToggleState: null,
            onFadeToggleClick: null,
        });

        expect(element.className).toBe('fm-rating-overlay');
        expect(element.querySelector('a').href).toContain('/title/tt1234567/');
        expect(element.textContent).toContain('IMDb 7.5');
    });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `npx vitest run tests/unit/core/ui/overlay-elements.test.js`

Expected: FAIL because `overlay-elements.js` does not exist.

- [ ] **Step 3: Move element construction into the new module**

Move `FADE_STATE_LABELS`, badge creation, rating color calculation, formatting, tooltip creation, completed overlay construction, loading overlay construction, and fade-toggle construction from `overlay.js` into `overlay-elements.js`. Export this explicit surface while preserving the existing implementation bodies:

```js
export const FADE_STATE_LABELS = Object.freeze({
    auto: 'Auto',
    always: 'Always',
    never: 'Never',
});
```

Export `createOverlayElement(title, options)` by adapting the current `#createOverlay(titleObj)` body. Destructure `overlayClass`, `showRtRating`, `showMcRating`, `showFadeToggle`, `fadeToggleState`, and `onFadeToggleClick` from `options`; replace configuration reads with those booleans; append the fade toggle only when both `showFadeToggle` and `onFadeToggleClick` are truthy. Export `createLoadingOverlayElement(overlayClass, loadingClass)` by moving the current `#createLoadingOverlay()` body and replacing private-field references with its parameters.

Re-export `FADE_STATE_LABELS` from `overlay.js` so the existing `app.js` import remains compatible. Make `OverlayRenderer.injectOverlay()` translate configuration into builder options and attach the returned element.

- [ ] **Step 4: Move element assertions by responsibility**

Move these groups from `overlay.test.js` into `overlay-elements.test.js`: overlay content, optional ratings, loading content, fade toggle, pointer-event click propagation, tooltip formatting, vote formatting, and rating colors. Keep injection replacement, loading removal, marker attributes, container positioning, clear-all behavior, and fade-class behavior in `overlay.test.js`.

Run: `npx vitest run tests/unit/core/ui/overlay-elements.test.js tests/unit/core/overlay.test.js`

Expected: PASS, with `overlay.test.js` testing only renderer-owned behavior.

- [ ] **Step 5: Run the clean-code diagnostic for overlay modules**

Run:

```bash
npx eslint src/core/overlay.js src/core/ui/overlay-elements.js src/core/ui/overlay-styles.js --rule 'max-lines-per-function: [warn, {max: 50, skipBlankLines: true, skipComments: true}]' --rule 'complexity: [warn, 10]'
```

Expected: no warning for `OverlayRenderer.injectStyles()` or completed-overlay construction.

- [ ] **Step 6: Commit the element extraction**

```bash
git add src/core/overlay.js src/core/ui/overlay-elements.js tests/unit/core/overlay.test.js tests/unit/core/ui/overlay-elements.test.js
git commit -m "refactor(overlay): extract element builders"
```

### Task 3: Extract the settings view and split tests

**Files:**

- Create: `src/core/ui/settings-view.js`
- Create: `tests/unit/core/ui/settings-view.test.js`
- Modify: `src/core/ui/settings-ui.js`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

**Interfaces:**

- Produces: `new SettingsView(fields, actions)`
- Produces: `render(container, settings): void`, `readValues(): object`, `validate(values): string[]`, `showStatus(message, type): void`, and `setSaveDisabled(disabled): void`
- Consumes: callbacks `{ onSave, onClearCache, onResetClients }`.

- [ ] **Step 1: Write a failing view snapshot test**

Create `settings-view.test.js` with the license header and the intended view API:

```js
import { describe, expect, it, vi } from 'vitest';

import { SettingsView } from '../../../../src/core/ui/settings-view.js';

describe('SettingsView', () => {
    it('reads one value snapshot from its rendered fields', () => {
        const fields = [{ key: 'debug', label: 'Debug', type: 'checkbox', default: false }];
        const view = new SettingsView(fields, {
            onSave: vi.fn(),
            onClearCache: vi.fn(),
            onResetClients: vi.fn(),
        });
        const container = document.createElement('div');
        view.render(container, {});
        container.querySelector('#fm-debug').checked = true;

        expect(view.readValues()).toEqual({ debug: true });
    });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `npx vitest run tests/unit/core/ui/settings-view.test.js`

Expected: FAIL because `settings-view.js` does not exist.

- [ ] **Step 3: Move presentation and form access into `SettingsView`**

Move field grouping, ratings and services groups, label construction, input construction, action construction, status construction, form reading, validation classes, and style injection out of `SettingsUI`. `SettingsView` must store `fields`, `actions`, and the rendered container in private fields. Its controller-facing methods are `render(container, settings)`, `readValues()`, `validate(values)`, `showStatus(message, type)`, and `setSaveDisabled(disabled)`. `render()` invokes `actions.onSave`, `actions.onClearCache`, and `actions.onResetClients` from the three existing button handlers. `showStatus()` assigns the supplied message and `fm-status--${type}` class to `#fm-status`. `setSaveDisabled()` updates `#fm-saveBtn` when present.

Order the class by constructor, `render()`, its first-use builders, `readValues()`, `validate()`, status and action state helpers, and style injection at its point of first use.

- [ ] **Step 4: Make `SettingsUI` a controller using one snapshot**

Construct the view in `SettingsUI` and wire its callbacks to controller methods. Implement save in this exact flow:

```js
async save() {
    const values = this.#view.readValues();
    const errors = this.#view.validate(values);
    if (errors.length > 0) {
        this.#view.showStatus(errors.join('\n'), 'error');
        return;
    }

    this.#view.setSaveDisabled(true);
    try {
        await this.#adapter.storageSetMany(values);
        this.#view.showStatus('Saved!', 'success');
        await this.#onSave?.();
    } finally {
        this.#view.setSaveDisabled(false);
    }
}
```

- [ ] **Step 5: Split existing settings assertions**

Move rendering, field population, validation-value semantics, and container-scoping assertions into `settings-view.test.js`. Keep storage persistence, asynchronous save state, `onSave`, cache clearing, reset behavior, and action error handling in `settings-ui.test.js`. Controller tests may render the real view but must assert controller-owned outcomes.

Run: `npx vitest run tests/unit/core/ui/settings-view.test.js tests/unit/core/ui/settings-ui.test.js`

Expected: PASS with each behavior asserted in exactly one file.

- [ ] **Step 6: Run the clean-code diagnostic for settings modules**

Run:

```bash
npx eslint src/core/ui/settings-ui.js src/core/ui/settings-view.js --rule 'max-lines-per-function: [warn, {max: 50, skipBlankLines: true, skipComments: true}]' --rule 'complexity: [warn, 10]'
```

Expected: no warning for `SettingsUI.render()`, `SettingsView.render()`, or field construction.

- [ ] **Step 7: Commit the settings extraction**

```bash
git add src/core/ui/settings-ui.js src/core/ui/settings-view.js tests/unit/core/ui/settings-ui.test.js tests/unit/core/ui/settings-view.test.js
git commit -m "refactor(settings): extract view rendering"
```

### Task 4: Decompose application decoration flow

**Files:**

- Modify: `src/core/app.js`
- Verify: `tests/unit/core/app.test.js`

**Interfaces:**

- Keeps: all existing `FlixMonkeyApp` public methods and `startApp(adapter)` behavior.
- Adds only private helpers for fade-state lookup, in-flight requests, and resolved rendering.

- [ ] **Step 1: Establish the green characterization baseline**

Run: `npx vitest run tests/unit/core/app.test.js`

Expected: PASS. The existing suite characterizes in-flight deduplication, timeout rejection, loading cleanup, removed-container handling, fade behavior, and navigation observation. This task is the refactor phase of the already-green TDD cycle and adds no behavior.

- [ ] **Step 2: Extract the request helper without changing timer behavior**

Add `#getTitleRequest(dedupKey, displayTitle)` that reuses an existing promise or creates the same timed promise currently built inside `#decorateContainer()`:

```js
#getTitleRequest(dedupKey, displayTitle) {
    const existing = this.#inFlight.get(dedupKey);
    if (existing) return existing;

    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('inflight timeout')), INFLIGHT_TIMEOUT_MS);
    });
    const request = Promise.race([this.#api.getData(displayTitle), timeout]).finally(() => {
        this.#inFlight.delete(dedupKey);
    });
    this.#inFlight.set(dedupKey, request);
    return request;
}
```

- [ ] **Step 3: Extract fade lookup and resolved rendering**

Create `#getFadeOverride(dedupKey, fadeable, showFadeToggle)` and `#renderTitle(container, data, options)`. Leave `#decorateContainer()` as preparation, paint yield, helper calls, await, render, and cleanup. Preserve the existing `document.contains(container)` guard and fade-toggle callback behavior.

- [ ] **Step 4: Run the complete app suite and diagnostic**

Run:

```bash
npx vitest run tests/unit/core/app.test.js
npx eslint src/core/app.js --rule 'max-lines-per-function: [warn, {max: 50, skipBlankLines: true, skipComments: true}]' --rule 'complexity: [warn, 10]'
```

Expected: all app tests pass and `#decorateContainer()` has no length or complexity warning.

- [ ] **Step 5: Commit application decomposition**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "refactor(app): clarify decoration workflow"
```

### Task 5: Apply lifecycle and first-use class ordering project-wide

**Files:**

- Modify: `src/core/api-clients.js`
- Modify: `src/core/api-manager.js`
- Modify: `src/core/app.js`
- Modify: `src/core/cache.js`
- Modify: `src/core/config-manager.js`
- Modify: `src/core/disabled-clients.js`
- Modify: `src/core/fade-manager.js`
- Modify: `src/core/logger.js`
- Modify: `src/core/overlay.js`
- Modify: `src/core/request-queue.js`
- Modify: `src/core/services.js`
- Modify: `src/core/surfaces.js`
- Modify: `src/core/title.js`
- Modify: `src/core/ui/modal.js`
- Modify: `src/core/ui/settings-ui.js`
- Modify: `src/core/ui/settings-view.js`
- Inspect: `src/core/utils.js`
- Modify: `src/platform/adapter.js`
- Modify: `src/platform/userscript.js`
- Modify: `src/platform/webextension.js`

**Interfaces:**

- Produces no new runtime interface.
- Preserves every method body outside the responsibility refactors from Tasks 1 through 4.

- [ ] **Step 1: Record a green pre-reorder baseline**

Run: `npm run test:unit`

Expected: all unit tests pass before mechanical member movement.

- [ ] **Step 2: Reorder lifecycle-oriented classes**

Apply this sequence to `FlixMonkeyApp`, `SettingsUI`, `SettingsView`, `OverlayRenderer`, `Modal`, and `RequestQueue`:

```text
fields
constructor
primary entry point
private helpers in first-use order
secondary workflows and their helpers
teardown
accessors not needed earlier in the flow
```

For `FlixMonkeyApp`, begin with `constructor`, `init`, `#initNavigationObservers`, `decorateRoot`, `#decorateContainer`, its extracted helpers, `#handleFadeToggleClick`, `redecorate`, administrative methods, `disconnect`, and accessors.

- [ ] **Step 3: Reorder semantic and contract classes**

Use semantic consumption order for API clients, managers, data classes, services, and adapters:

- `BaseApiClient`: constructor, `fetch`, `getStatus`, `isDisabled`, `search`, `getDetails`, request and disable operations, then dependency accessors at their first meaningful use.
- Provider clients: constructor, status gate, search, search helpers, details, and details helpers.
- `Title`: constructor, normalization helper, derived properties, transformations, and static factories.
- `PlatformAdapter` and implementations: configuration seeding where applicable, storage contract order, HTTP, configuration reads, and optional platform operations.
- Managers: constructor, primary read or operation, helpers in first-use order, then maintenance operations.

Do not change method bodies during this step.

- [ ] **Step 4: Group surface code by service**

Keep shared typedefs, shared helpers, and `SurfaceManager` first. Then use these self-contained sections:

```text
Netflix constants and definitions
NetflixSurfaceManager
HBO Max patterns and extraction helpers
HBO_MAX_SURFACES
HboMaxSurfaceManager
Disney+ patterns and canonicalization helpers
DISNEY_PLUS_SURFACES
DisneyPlusSurfaceManager
```

- [ ] **Step 5: Verify the mechanical reorder**

Run:

```bash
npm run test:unit
npm run lint
npm run format:check
git diff --check
```

Expected: all commands pass. Inspect `git diff --word-diff=porcelain` to confirm files outside Tasks 1 through 4 contain movement only.

- [ ] **Step 6: Commit project-wide ordering**

```bash
git add src
git commit -m "refactor: order classes by lifecycle"
```

### Task 6: Final verification and documentation consistency

**Files:**

- Modify only if required by verification: files already listed in Tasks 1 through 5.

**Interfaces:**

- Confirms all three build targets and all non-integration tests retain behavior.

- [ ] **Step 1: Format the refactor**

Run: `npm run format`

Expected: Prettier completes successfully. Review any formatting changes before staging them.

- [ ] **Step 2: Run repository lint and formatting checks**

Run:

```bash
npm run lint
npm run format:check
```

Expected: both commands pass with no warnings or errors.

- [ ] **Step 3: Run all unit and UI tests**

Run: `npm test`

Expected: all unit and UI tests pass. Do not run integration tests because they require live API credentials and are outside per-PR verification.

- [ ] **Step 4: Build every distribution target**

Run: `npm run build`

Expected: userscript, Firefox, and Chrome builds complete, and extension packages are produced successfully.

- [ ] **Step 5: Run the clean-code diagnostic**

Run:

```bash
npx eslint src scripts --rule 'max-lines-per-function: [warn, {max: 50, skipBlankLines: true, skipComments: true}]' --rule 'complexity: [warn, 10]'
```

Expected: no length warning for the refactored settings, overlay, or app workflows. Review unrelated complexity warnings from provider parsing and immutable data normalization without expanding this refactor.

- [ ] **Step 6: Review the final diff and status**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: no whitespace errors, no unexpected untracked files, and changes limited to the approved source, tests, specification, and plan.

- [ ] **Step 7: Commit any verification-only corrections**

If formatting or verification required source corrections, commit only those reviewed changes:

```bash
git add src tests
git commit -m "style: finalize clean code refactor"
```

If there are no remaining changes, do not create an empty commit.
