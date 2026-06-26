# Fade Toggle — Bob-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the fade toggle from hover-on-browse-thumbnail to always-visible on the bob popup only, with icon-based knob states and sibling title-card updates.

**Architecture:** `showToggle` surface property gates toggle rendering; `data-fm-dedup-key` attribute stamped on fadeable containers lets the bob's toggle click handler find and re-fade sibling title-cards. `FadeManager` and `config-fields.js` are unchanged — only `surfaces.js`, `overlay.js`, and `app.js` change.

**Tech Stack:** Vanilla JS (ES modules), Vitest, JSDOM

## Global Constraints

- Test runner: `npm run test:unit` (Vitest)
- No new dependencies
- Commit after each task passes

---

### Task 1: Add `showToggle` to surface definitions

**Files:**

- Modify: `src/core/surfaces.js`
- Test: `tests/unit/core/surfaces.test.js`

**Interfaces:**

- Produces: each surface object in `SurfaceManager#SURFACES` now carries `showToggle: boolean`; `discover()` returns `{ container, title, fadeable, showToggle }` for each result

- [ ] **Step 1: Write failing tests**

Add these assertions to the existing surface tests in `tests/unit/core/surfaces.test.js`. Append them to the matching `it` blocks (right after the existing `fadeable` assertion in each):

```js
// in "should discover title card surfaces"
expect(results[0].showToggle).toBe(false);

// in "should discover search video card surfaces"
expect(results[0].showToggle).toBe(false);

// in "should discover bob container surfaces"
expect(results[0].showToggle).toBe(true);
```

For the `.each` tables in `describe('previewModal fallback selectors')` and `describe('jawBone / detail-view fallback selectors')`, add `showToggle: false` assertions inside the callback:

```js
expect(results[0].showToggle).toBe(false);
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:unit -- tests/unit/core/surfaces.test.js
```

Expected: multiple failures — `undefined` is not `false` / `true`

- [ ] **Step 3: Add `showToggle` to each surface in `src/core/surfaces.js`**

Replace the `#SURFACES` array with:

```js
#SURFACES = [
    {
        titleSelectors: '.title-card .fallback-text',
        getTitle: el => el.textContent?.trim() ?? null,
        containerSel: '.title-card',
        fadeable: true,
        showToggle: false,
    },
    {
        titleSelectors: '[data-uia="standard-card"]',
        getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
        containerSel: '[data-uia="standard-card"]',
        fadeable: true,
        showToggle: false,
    },
    {
        titleSelectors: '.bob-title',
        getTitle: el => el.textContent?.trim() ?? null,
        containerSel: '.bob-container',
        fadeable: false,
        showToggle: true,
    },
    {
        titleSelectors: [
            '.previewModal--player-titleTreatmentWrapper img[alt]',
            '.previewModal--player_container img[alt]',
            '[data-uia="previewModal-title"]',
            '.previewModal--boxarttitle',
        ].join(','),
        getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
        containerSel: '.previewModal--player_container',
        fadeable: false,
        showToggle: false,
    },
    {
        titleSelectors: [
            '.jawBone img[alt]',
            '.jawBoneContainer img[alt]',
            '.previewModal--detailsMetadata img[alt]',
            '.jawBone .image-fallback-text',
            '.jawBoneContainer .image-fallback-text',
            '.previewModal--detailsMetadata h3',
            '.previewModal--detailsMetadata .title',
            '.previewModal--detailsMetadata [data-uia="previewModal-title"]',
        ].join(','),
        getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
        containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
        fadeable: false,
        showToggle: false,
    },
];
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:unit -- tests/unit/core/surfaces.test.js
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/surfaces.js tests/unit/core/surfaces.test.js
git commit -m "feat: add showToggle property to surface definitions (true for bob only)"
```

---

### Task 2: Update toggle CSS — smaller, icons, no hover rules, no track-color states

**Files:**

- Modify: `src/core/overlay.js` (only `injectStyles()`)
- Test: `tests/unit/core/overlay.test.js`

**Interfaces:**

- Consumes: nothing from Task 1
- Produces: updated `injectStyles()` that emits smaller toggle CSS with `::after` icon rules and no `.title-card:hover` / `[data-uia="standard-card"]:hover` visibility rules

- [ ] **Step 1: Write failing tests**

Add these `it` blocks to `tests/unit/core/overlay.test.js`, inside the `describe('OverlayRenderer')` block, after the existing "should include fade toggle CSS" test:

```js
it('should not include hover-visibility rules for title-card or standard-card toggles', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).not.toContain('.title-card:hover .fm-fade-toggle');
    expect(css).not.toContain('[data-uia="standard-card"]:hover .fm-fade-toggle');
});

it('should not default the toggle to opacity 0', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    // toggle should be visible when rendered — no hidden-by-default rule
    expect(css).not.toMatch(/fm-fade-toggle[^{]*\{[^}]*opacity:\s*0/);
});

it('should render toggle track at 41px wide by 15px tall', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('width: 41px');
    expect(css).toContain('height: 15px');
});

it('should render toggle knob at 12px square', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('width: 12px');
    expect(css).toContain('height: 12px');
});

it('should include red X icon for faded state and green checkmark for not-faded', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('✕'); // ✕
    expect(css).toContain('#e53935');
    expect(css).toContain('✓'); // ✓
    expect(css).toContain('#43a047');
});

it('should not include per-state track background color rules', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).not.toContain('[data-state="faded"] .fm-toggle-track');
    expect(css).not.toContain('[data-state="not-faded"] .fm-toggle-track');
    expect(css).not.toContain('[data-state="auto"] .fm-toggle-track');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:unit -- tests/unit/core/overlay.test.js
```

Expected: the 6 new tests FAIL; existing tests still pass

- [ ] **Step 3: Replace the toggle CSS block in `src/core/overlay.js`**

In `injectStyles()`, find the toggle block that starts with `` cssText += ` `` and contains `.fm-fade-toggle` and ends before `if (existing)`. Replace it entirely with:

```js
cssText += `
    .fm-fade-toggle {
        cursor: pointer;
        padding: 0;
        background: transparent !important;
    }
    .fm-fade-toggle:hover {
        background: transparent !important;
    }
    .fm-toggle-track {
        width: 41px;
        height: 15px;
        border-radius: 8px;
        background: rgba(255,255,255,0.25);
        position: relative;
    }
    .fm-toggle-knob {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        position: absolute;
        top: 1.5px;
        left: 2px;
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        line-height: 1;
    }
    .fm-fade-toggle[data-state="faded"] .fm-toggle-knob { transform: translateX(0); }
    .fm-fade-toggle[data-state="auto"] .fm-toggle-knob { transform: translateX(12px); }
    .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob { transform: translateX(25px); }
    .fm-fade-toggle[data-state="faded"] .fm-toggle-knob::after {
        content: '✕';
        color: #e53935;
    }
    .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob::after {
        content: '✓';
        color: #43a047;
    }
`;
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:unit -- tests/unit/core/overlay.test.js
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/overlay.js tests/unit/core/overlay.test.js
git commit -m "feat: update toggle CSS — bob-only visibility, smaller size, state icons"
```

---

### Task 3: Wire `showToggle` in app, stamp `data-fm-dedup-key`, update siblings on click

**Files:**

- Modify: `src/core/app.js`
- Test: `tests/unit/core/app.test.js`

**Interfaces:**

- Consumes: `showToggle` from `SurfaceManager.discover()` (Task 1)
- Produces:
    - `#decorateContainer(container, displayTitle, fadeable, showToggle = false)` — new fourth param
    - Fadeable containers decorated with `data-fm-dedup-key` attribute (value = dedupKey slug)
    - `#handleToggleClick` updates all `[data-fm-dedup-key="${dedupKey}"]` containers' fade state

- [ ] **Step 1: Update existing tests that will break and add new failing tests**

In `tests/unit/core/app.test.js`:

**Replace** the test "should cycle toggle state on click and update fade" (currently uses title-card) with:

```js
it('should render toggle in bob and update title-card fade on click', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? true : undefined),
    });
    document.body.innerHTML = `
        <div class="bob-container">
            <div class="bob-title">Toggle Movie</div>
        </div>
        <div class="title-card">
            <div class="fallback-text">Toggle Movie</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 8.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        expect(document.querySelector('.bob-container .fm-fade-toggle')).not.toBeNull();
    });

    const toggle = document.querySelector('.bob-container .fm-fade-toggle');
    expect(toggle.dataset.state).toBe('auto');
    expect(document.querySelector('.title-card .fm-fade-toggle')).toBeNull();

    toggle.click();
    await vi.runAllTimersAsync();

    expect(toggle.dataset.state).toBe('faded');
    expect(document.querySelector('.title-card').classList.contains('fm-faded')).toBe(true);
});
```

**Replace** the test "should not render toggle when enableFadeToggle is false" with:

```js
it('should not render toggle in bob when enableFadeToggle is false', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? false : undefined),
    });
    document.body.innerHTML = `
        <div class="bob-container">
            <div class="bob-title">No Toggle Movie</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 8.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        expect(document.querySelector('.fm-rating-overlay')).not.toBeNull();
    });

    expect(document.querySelector('.fm-fade-toggle')).toBeNull();
});
```

**Add** these new tests:

```js
it('should not render toggle on title-card even when enableFadeToggle is true', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? true : undefined),
    });
    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">No Toggle Here</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 7.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        expect(document.querySelector('.fm-rating-overlay')).not.toBeNull();
    });

    expect(document.querySelector('.fm-fade-toggle')).toBeNull();
});

it('should stamp data-fm-dedup-key on decorated title-card containers', async () => {
    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Stamp Test</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 7.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(createMockAdapter());
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        const card = document.querySelector('.title-card');
        expect(card.dataset.fmDedupKey).toBe('stamp-test');
    });
});
```

- [ ] **Step 2: Run tests to verify expected failures**

```
npm run test:unit -- tests/unit/core/app.test.js
```

Expected: "should render toggle in bob…", "should not render toggle on title-card…", and "should stamp data-fm-dedup-key…" FAIL. All other tests still pass.

- [ ] **Step 3: Update `decorateRoot` to pass `showToggle`**

In `src/core/app.js`, update `decorateRoot`:

```js
decorateRoot(root) {
    this.#surfaces.discover(root).forEach(({ container, title, fadeable, showToggle = false }) => {
        this.#decorateContainer(container, title, fadeable, showToggle).catch(err =>
            this.#logger.error('Failed to decorate container', err)
        );
    });
}
```

- [ ] **Step 4: Update `#decorateContainer` signature and toggle gating**

Change the method signature from:

```js
async #decorateContainer(container, displayTitle, fadeable) {
```

to:

```js
async #decorateContainer(container, displayTitle, fadeable, showToggle = false) {
```

Then inside the method, find the line:

```js
const enableToggle = this.#config.get('enableFadeToggle', true);
```

Replace it with:

```js
const enableToggle = showToggle && this.#config.get('enableFadeToggle', true);
```

After `this.#renderer.applyFade(container, shouldFade);`, add the dedup-key stamp:

```js
this.#renderer.injectOverlay(container, data, toggleOptions);
this.#renderer.applyFade(container, shouldFade);
if (fadeable) {
    container.dataset.fmDedupKey = dedupKey;
}
```

- [ ] **Step 5: Update `#handleToggleClick` to update sibling title-cards**

Replace the body of `#handleToggleClick` with:

```js
async #handleToggleClick(container, dedupKey, data, fadeable) {
    const toggle = container.querySelector('.fm-fade-toggle');
    if (!toggle) return;

    const currentState = toggle.dataset.state;
    const nextState = this.#fade.nextToggleState(currentState);

    const overrideMap = { faded: true, 'not-faded': false, auto: null };
    const newOverride = overrideMap[nextState];

    await this.#fade.setOverride(dedupKey, newOverride);

    toggle.dataset.state = nextState;
    const shouldFade = this.#fade.shouldFade(newOverride, data?.rating, fadeable);
    this.#renderer.applyFade(container, shouldFade);
    const siblingFade = this.#fade.shouldFade(newOverride, data?.rating, true);
    document.querySelectorAll(`[data-fm-dedup-key="${dedupKey}"]`).forEach(sibling => {
        this.#renderer.applyFade(sibling, siblingFade);
    });
}
```

- [ ] **Step 6: Run tests to verify they pass**

```
npm run test:unit -- tests/unit/core/app.test.js
```

Expected: all PASS

- [ ] **Step 7: Run full test suite**

```
npm run test
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "feat: toggle on bob only — showToggle gating, dedup-key stamp, sibling fade update"
```
