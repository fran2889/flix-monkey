# Cross-service fade-toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing manual fade override on the correct hoverable surface for Netflix, HBO Max, and Disney+.

**Architecture:** Surface definitions continue to declare the placement capability through `showFadeToggle`. Netflix keeps that capability on its mini preview because its cards are replaced by the preview on hover. HBO Max and Disney+ set it on every fadeable card; shared overlay CSS hides the already-rendered control until the owning surface is hovered or contains keyboard focus.

**Tech Stack:** ES2022 modules, Vitest with jsdom, existing Netflix, HBO Max, and Disney+ HTML fixtures.

## Global Constraints

- Preserve the existing three-state override cycle: Auto -> Always -> Never -> Auto.
- Render a toggle only when both `showFadeToggle` and the `enableFadeToggle` setting permit it.
- Keep Netflix browse cards toggle-free and keep the Netflix mini preview as the sole Netflix toggle surface.
- Reveal a rendered toggle with `:hover` and `:focus-within`; retain its layout space while hidden and prevent it receiving pointer input until revealed.
- Use ASCII-only prose and retain GPL-3.0 headers on every changed source and test file.
- Update README text for user-facing behavior changes.

---

## File Structure

- `src/core/surfaces.js`: declares which service surfaces expose the existing fade toggle.
- `src/core/overlay.js`: owns shared fade-toggle visibility CSS.
- `src/core/config-fields.js`: replaces Netflix-specific setting help text with cross-service wording.
- `tests/unit/core/surfaces.test.js`: covers surface-definition flags without loading a service fixture.
- `tests/unit/core/overlay.test.js`: validates the generated selector rules for hidden and revealed toggle states.
- `tests/unit/core/config-fields.test.js`: protects the cross-service setting title.
- `tests/ui/hbomax-browse.ui.test.js` and `tests/ui/disneyplus-browse.ui.test.js`: verify fixture-discovered cards now expose a toggle-capable surface.
- `README.md`: documents where the override is available.

### Task 1: Mark HBO Max and Disney+ fadeable cards as toggle surfaces

**Files:**

- Modify: `src/core/surfaces.js:172-222`
- Modify: `tests/unit/core/surfaces.test.js:235-365`
- Modify: `tests/ui/hbomax-browse.ui.test.js:25-58`
- Modify: `tests/ui/disneyplus-browse.ui.test.js:30-53`

**Interfaces:**

- Consumes: `SurfaceDefinition.showFadeToggle`, which `SurfaceManager.discover()` copies to every `DiscoveredSurface`.
- Produces: all `HBO_MAX_SURFACES` and `DISNEY_PLUS_SURFACES` card definitions return `showFadeToggle: true`; Netflix definitions remain unchanged.

- [ ] **Step 1: Write failing surface assertions**

    Change the existing Disney+ unit expectations from `showFadeToggle: false` to `showFadeToggle: true`. Add an HBO Max discovery assertion that exercises a `data-sonic-type="show"` tile and expects the discovered surface to match the following shape:

    ```js
    expect(surface).toMatchObject({ title: 'Movie', fadeable: true, showFadeToggle: true });
    ```

    In both fixture UI tests, assert the discovered surfaces expose the same capability:

    ```js
    expect(surfaces.every(({ fadeable, showFadeToggle }) => fadeable && showFadeToggle)).toBe(true);
    ```

- [ ] **Step 2: Run the focused tests to verify they fail**

    Run:

    ```bash
    npx vitest run tests/unit/core/surfaces.test.js tests/ui/hbomax-browse.ui.test.js tests/ui/disneyplus-browse.ui.test.js
    ```

    Expected: failures report that HBO Max and Disney+ discovered surfaces have `showFadeToggle: false`.

- [ ] **Step 3: Set the surface flags**

    In `src/core/surfaces.js`, change each of the three non-Netflix card definitions as follows. Do not alter any Netflix definition.

    ```js
    export const HBO_MAX_SURFACES = Object.freeze({
        TILE: Object.freeze({
            // Existing selectors and callbacks unchanged.
            fadeable: true,
            showFadeToggle: true,
        }),
    });

    export const DISNEY_PLUS_SURFACES = Object.freeze({
        SHELF_CARD: Object.freeze({
            // Existing selectors and callbacks unchanged.
            fadeable: true,
            showFadeToggle: true,
        }),
        CONTINUE_WATCHING: Object.freeze({
            // Existing selectors and callbacks unchanged.
            fadeable: true,
            showFadeToggle: true,
        }),
    });
    ```

- [ ] **Step 4: Run the focused tests to verify they pass**

    Run:

    ```bash
    npx vitest run tests/unit/core/surfaces.test.js tests/ui/hbomax-browse.ui.test.js tests/ui/disneyplus-browse.ui.test.js
    ```

    Expected: all three files pass, including the existing Netflix mini-preview tests that prove Netflix placement is unchanged.

- [ ] **Step 5: Commit the surface capability change**

    ```bash
    git add src/core/surfaces.js tests/unit/core/surfaces.test.js tests/ui/hbomax-browse.ui.test.js tests/ui/disneyplus-browse.ui.test.js
    git commit -m "feat(fade): expose overrides on service cards"
    ```

### Task 2: Hide and reveal fade controls through shared overlay CSS

**Files:**

- Modify: `src/core/overlay.js:101-105`
- Modify: `tests/unit/core/overlay.test.js:296-303`

**Interfaces:**

- Consumes: `OverlayRenderer.injectOverlay(container, title, state, onFadeToggleClick)`, which already appends `.fm-fade-toggle` only for toggle-capable surfaces with the setting enabled.
- Produces: a `.fm-fade-toggle` that is visually hidden and non-interactive by default, then visible and interactive whenever its container is hovered or contains focus.

- [ ] **Step 1: Write the failing CSS-content assertions**

    Extend the existing fade-toggle CSS test to assert the stylesheet includes each required declaration and selector:

    ```js
    expect(css).toContain('.fm-rating-overlay .fm-fade-toggle { opacity: 0; pointer-events: none; }');
    expect(css).toContain(':hover > .fm-rating-overlay .fm-fade-toggle');
    expect(css).toContain(':focus-within > .fm-rating-overlay .fm-fade-toggle');
    expect(css).toContain('opacity: 1; pointer-events: auto;');
    ```

- [ ] **Step 2: Run the focused test to verify it fails**

    Run:

    ```bash
    npx vitest run tests/unit/core/overlay.test.js
    ```

    Expected: the fade-toggle CSS test fails because the hidden and reveal rules do not yet exist.

- [ ] **Step 3: Add hidden and reveal rules without changing toggle creation or click handling**

    Replace the current fade-toggle CSS block in `OverlayRenderer.injectStyles()` with this block. Its descendant relationship means only the container that owns the overlay reveals its toggle.

    ```js
    cssText += `
        .${this.#OVERLAY_CLASS} .fm-fade-toggle {
            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s;
        }
        :hover > .${this.#OVERLAY_CLASS} .fm-fade-toggle,
        :focus-within > .${this.#OVERLAY_CLASS} .fm-fade-toggle {
            opacity: 1;
            pointer-events: auto;
        }
        .${this.#OVERLAY_CLASS} .fm-fade-toggle .fm-label { color: #aaa; }
        .${this.#OVERLAY_CLASS} .fm-fade-toggle--faded { opacity: 0.35; }
    `;
    ```

    Do not use `display: none`, remove the element, or change `#createFadeToggle()`: retaining the element preserves overlay layout and existing click propagation behavior.

- [ ] **Step 4: Run the focused test to verify it passes**

    Run:

    ```bash
    npx vitest run tests/unit/core/overlay.test.js
    ```

    Expected: all OverlayRenderer tests pass, including click propagation and state-cycle rendering tests.

- [ ] **Step 5: Commit the shared presentation change**

    ```bash
    git add src/core/overlay.js tests/unit/core/overlay.test.js
    git commit -m "feat(fade): reveal controls on hover and focus"
    ```

### Task 3: Make override copy service-neutral and verify the complete change

**Files:**

- Modify: `src/core/config-fields.js:126-133`
- Modify: `tests/unit/core/config-fields.test.js:1-90`
- Modify: `README.md:87-94`

**Interfaces:**

- Consumes: `CONFIG_FIELDS`, the single source of truth for setting labels and help text.
- Produces: service-neutral description of the manual override, consistent with the README.

- [ ] **Step 1: Write the failing setting-copy test**

    Add this test to `tests/unit/core/config-fields.test.js`:

    ```js
    it('describes the fade override without naming a Netflix preview', () => {
        expect(CONFIG_FIELDS.find(field => field.key === 'enableFadeToggle').title).toBe(
            'Allow manual override of fade state on supported title surfaces'
        );
    });
    ```

- [ ] **Step 2: Run the focused test to verify it fails**

    Run:

    ```bash
    npx vitest run tests/unit/core/config-fields.test.js
    ```

    Expected: failure because the current title says `in hover preview`.

- [ ] **Step 3: Update setting and README copy**

    Change the `enableFadeToggle` field title to exactly:

    ```js
    title: 'Allow manual override of fade state on supported title surfaces',
    ```

    Change the README Fade Settings row to:

    ```markdown
    | Allow Override | No | Show a fade override button on supported title surfaces |
    ```

- [ ] **Step 4: Run focused and project verification**

    Run:

    ```bash
    npx vitest run tests/unit/core/config-fields.test.js
    npm run format:check && npm run lint && npm test && npm run build
    ```

    Expected: the focused test passes; formatting, linting, unit/UI tests, and all target builds succeed.

- [ ] **Step 5: Commit the copy and verification-ready change**

    ```bash
    git add src/core/config-fields.js tests/unit/core/config-fields.test.js README.md
    git commit -m "docs: clarify fade override availability"
    ```

## Self-review

- Spec coverage: Task 1 implements the service-specific placement table while preserving Netflix; Task 2 implements hidden hover and keyboard-focus presentation, layout stability, and pointer gating; Task 3 implements service-neutral user-facing copy and full verification.
- Placeholder scan: no unresolved scope markers or deferred implementation steps are present.
- Type consistency: all tasks use the existing `showFadeToggle` boolean, existing `OverlayRenderer.injectOverlay()` interface, and existing `enableFadeToggle` setting key.
