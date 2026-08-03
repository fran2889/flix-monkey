# Netflix Browse Card Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore rating overlays on Netflix Continue Watching and Top 10 browse thumbnails, and refresh the complete Netflix fixture set from the current live UI.

**Architecture:** Extend the declarative Netflix surface registry with explicit stable `data-uia` selectors for progress and ranked cards. Update the existing CDP fixture capture script to extract the new carousel surfaces, reject empty captures, and regenerate all aggregate and surface fixtures without relying on generated CSS class names.

**Tech Stack:** JavaScript ES2022, Vitest, jsdom, Python 3 standard library, Chrome DevTools Protocol, and Netflix HTML fixtures.

## Global Constraints

- Preserve existing title-card, search-card, mini-preview, and detail-preview support.
- Use stable `data-uia` and semantic attributes instead of generated Netflix CSS class names.
- Keep progress and ranked cards fadeable, with no fade toggle.
- Keep rendering behavior tests in `tests/unit/`; fixture-backed discovery and injection tests belong in `tests/ui/`.
- Refresh every existing Netflix fixture from the current authenticated Chromium session on port 9222.
- Fail capture with an actionable error instead of writing an empty expected surface fixture.
- Preserve unrelated working-tree changes.
- Every modified JavaScript test or source file retains the GPL-3.0 license header.
- Repository prose and source additions use ASCII characters and no em dashes.

---

### Task 1: Capture the current Netflix surface fixtures

**Files:**

- Modify: `scripts/capture-surface-fixtures.py`
- Create: `tests/fixtures/surfaces/progress-card.html`
- Create: `tests/fixtures/surfaces/ranked-card.html`
- Refresh: `tests/fixtures/surfaces/title-card.html`
- Refresh: `tests/fixtures/surfaces/standard-card.html`
- Refresh: `tests/fixtures/surfaces/preview-mini.html`
- Refresh: `tests/fixtures/surfaces/preview-detail.html`
- Refresh: `tests/fixtures/netflix-browse.html`
- Refresh: `tests/fixtures/netflix-search.html`
- Refresh: `tests/fixtures/netflix-hover.html`
- Refresh: `tests/fixtures/netflix-modal.html`

**Interfaces:**

- Consumes: an authenticated Netflix page exposed through CDP at `http://localhost:9222`.
- Produces: `require_capture(name: str, html: str) -> str`, which returns non-empty HTML or raises `RuntimeError`; surface fixtures containing stable card attributes for Task 2.

- [ ] **Step 1: Add explicit capture validation**

Add this helper after `capture_row_html`:

```python
def require_capture(name, html):
    """Return captured HTML or fail before an empty fixture is written."""
    if not html or not html.strip():
        raise RuntimeError(f'Could not capture required Netflix surface: {name}')
    return html
```

- [ ] **Step 2: Capture all browse card variants using stable selectors**

Replace the legacy browse-row extraction with explicit surface captures:

```python
    browse_surfaces = {
        'title-card': '.title-card a[aria-label]',
        'progress-card': '[data-uia="progress-card"][aria-label]',
        'ranked-card': '[data-uia="ranked-card"][aria-label]',
    }
    for name, selector in browse_surfaces.items():
        card_html = capture_row_html(s, selector)
        card_html = require_capture(name, card_html)
        save(
            ROOT / f'tests/fixtures/surfaces/{name}.html',
            wrap(anonymise(card_html, profile_name)),
        )

    body_html = require_capture('browse page', ev(s, 'document.body.outerHTML') or '')
    body_html = remove_row_by_heading(body_html, 'My List')
    save(
        ROOT / 'tests/fixtures/netflix-browse.html',
        anonymise(body_html, profile_name),
    )
```

Do not remove Continue Watching from the aggregate browse fixture. Keep Top 10 rows so Task 2 can assert both new surface variants against real Netflix markup.

- [ ] **Step 3: Validate every remaining capture before saving**

Wrap search, mini-preview, and detail-preview values with descriptive validation:

```python
    grid_html = require_capture('standard card', grid_html)
    body_html = require_capture('search page', ev(s, 'document.body.outerHTML') or '')
    mini_html = require_capture(
        'mini preview',
        capture_outer_html(s, '.previewModal--wrapper.mini-modal') or '',
    )
    detail_html = require_capture(
        'detail preview',
        capture_outer_html(s, '.previewModal--wrapper.detail-modal') or '',
    )
```

Keep the existing anonymization calls and aggregate fixture writes after validation.

- [ ] **Step 4: Run the live capture**

Run:

```bash
python3 scripts/capture-surface-fixtures.py
```

Expected: exit code 0, a non-zero character count for every fixture, and final output `Done.`. If Netflix has moved the hover target, update `hover_card()` to choose a visible `.title-card` with a non-zero bounding rectangle while retaining `.title-card` as the stable legacy surface selector.

- [ ] **Step 5: Check anonymization and fixture completeness**

Run:

```bash
rg -n 'data-uia="progress-card"' tests/fixtures/surfaces/progress-card.html tests/fixtures/netflix-browse.html
rg -n 'data-uia="ranked-card"' tests/fixtures/surfaces/ranked-card.html tests/fixtures/netflix-browse.html
rg -n 'data-auth|authorization|eyJ[A-Za-z0-9_-]*\.' tests/fixtures
```

Expected: the first two commands find the new surfaces. The final command prints no authorization data or JWT-shaped value. Search separately for the profile name printed by the capture script and confirm that it does not appear in any fixture.

- [ ] **Step 6: Commit the capture workflow and fixtures**

```bash
git add scripts/capture-surface-fixtures.py tests/fixtures
git commit -m "test(fixtures): refresh Netflix surface markup"
```

Expected: the commit includes only the capture script and Netflix fixture files.

---

### Task 2: Discover and inject overlays into progress and ranked cards

**Files:**

- Modify: `src/core/surfaces.js`
- Modify: `tests/ui/netflix-browse.ui.test.js`

**Interfaces:**

- Consumes: `NetflixSurfaceManager.discover(root)` and the refreshed `tests/fixtures/netflix-browse.html` from Task 1.
- Produces: `NETFLIX_SURFACES.PROGRESS_CARD` and `NETFLIX_SURFACES.RANKED_CARD`, each compatible with the existing generic `SurfaceManager` discovery contract.

- [ ] **Step 1: Write failing fixture-backed discovery tests**

Add these tests to `tests/ui/netflix-browse.ui.test.js`:

```js
it.each([
    ['progress-card', '[data-uia="progress-card"]'],
    ['ranked-card', '[data-uia="ranked-card"]'],
])('should discover and inject on %s surfaces', (_name, selector) => {
    const expectedContainer = document.querySelector(selector);
    expect(expectedContainer).not.toBeNull();

    const surface = surfaceManager.discover(document.body).find(candidate => candidate.container === expectedContainer);

    expect(surface).toMatchObject({
        title: expectedContainer.getAttribute('aria-label'),
        fadeable: true,
        showFadeToggle: false,
    });

    overlayRenderer.injectLoadingOverlay(surface.container, surface.title);
    expect(surface.container.querySelector('.fm-loading')).not.toBeNull();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npx vitest run tests/ui/netflix-browse.ui.test.js
```

Expected: FAIL because discovery returns no surface whose container is the progress or ranked card.

- [ ] **Step 3: Add minimal declarative surface definitions**

Add these frozen entries to `NETFLIX_SURFACES` in `src/core/surfaces.js`, after `SEARCH_CARD` and before preview surfaces:

```js
PROGRESS_CARD: Object.freeze({
    titleSelector: '[data-uia="progress-card"][aria-label]',
    containerSelector: '[data-uia="progress-card"]',
    titleAttribute: 'aria-label',
    fadeable: true,
    showFadeToggle: false,
}),
RANKED_CARD: Object.freeze({
    titleSelector: '[data-uia="ranked-card"][aria-label]',
    containerSelector: '[data-uia="ranked-card"]',
    titleAttribute: 'aria-label',
    fadeable: true,
    showFadeToggle: false,
}),
```

Document each entry as a browse-page surface and note that generated Netflix CSS classes are intentionally avoided.

- [ ] **Step 4: Run focused UI and surface tests**

Run:

```bash
npx vitest run tests/ui/netflix-browse.ui.test.js tests/unit/core/surfaces.test.js
```

Expected: both test files pass. Existing title, search, and preview discovery remains green.

- [ ] **Step 5: Confirm selectors against the live DOM**

Run through the Chrome DevTools CLI:

```bash
chrome-devtools evaluate_script "() => ({ progress: document.querySelectorAll('[data-uia=progress-card][aria-label]').length, ranked: document.querySelectorAll('[data-uia=ranked-card][aria-label]').length })"
```

Expected: both counts are greater than zero on the logged-in browse page.

- [ ] **Step 6: Commit surface support and tests**

```bash
git add src/core/surfaces.js tests/ui/netflix-browse.ui.test.js
git commit -m "fix(surfaces): support new Netflix browse cards"
```

Expected: the commit contains the surface registry and fixture-backed UI tests only.

---

### Task 3: Verify the complete change

**Files:**

- Verify all files committed in Tasks 1 and 2.
- Modify only files changed by automated formatting if required.

**Interfaces:**

- Consumes: the refreshed fixtures and new Netflix surface definitions.
- Produces: verified userscript, Firefox, and Chrome builds with passing unit and UI suites.

- [ ] **Step 1: Run formatting without changing files**

Run:

```bash
npm run format:check
```

Expected: exit code 0. If it fails, run `npx prettier --write` only on files modified by this implementation, inspect the diff, and commit the formatting with the relevant task files.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run unit and UI tests**

Run:

```bash
npm test
```

Expected: exit code 0 and every unit and UI test passes. Do not run integration tests because they require live API credentials and are outside per-PR verification.

- [ ] **Step 4: Build every distribution target**

Run:

```bash
npm run build
```

Expected: exit code 0, with userscript, Firefox, and Chrome artifacts produced successfully.

- [ ] **Step 5: Inspect the final diff and repository state**

Run:

```bash
git status --short
git log -3 --oneline
git diff --check HEAD~2..HEAD
```

Expected: no whitespace errors. Any pre-existing unrelated modified files remain unstaged and unchanged. The two implementation commits appear after the design commit.

- [ ] **Step 6: Report manual verification**

Report automated checks as complete. Leave this manual check open for the user:

```text
[ ] Reload FlixMonkey in Chromium and verify ratings appear on Continue Watching and Top 10 thumbnails.
```
