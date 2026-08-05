# Disney+ Clean Card Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover Disney+ standard and Continue Watching cards using clean DOM title values instead of parsing accessible-label metadata.

**Architecture:** `DisneyPlusSurfaceManager` continues to use declarative surface definitions. Standard shelf cards read a non-empty descendant image `alt`; Continue Watching wrappers read the second child of their stable metadata link. Both attach overlays to the enclosing shelf item.

**Tech Stack:** JavaScript ES2022, Vitest, jsdom, and existing Disney+ fixtures.

## Global Constraints

- Keep all application changes in `src/` as ES modules.
- Add the GPL-3.0 header to every modified source or test file.
- Use clean DOM title values only: do not add an aria-label parsing fallback.
- Put synthetic DOM assertions in `tests/unit/`; use the Disney+ fixture only in `tests/ui/`.
- Preserve fadeability and keep `showFadeToggle` false for both Disney+ surfaces.
- Use ASCII-only prose and Oxford commas.

---

## File Structure

- `src/core/surfaces.js`: Clean-title extraction and the two Disney+ surface definitions.
- `tests/unit/core/surfaces.test.js`: Synthetic title extraction and container tests.
- `tests/fixtures/disneyplus-browse.html`: Title-art standard cards and Continue Watching markup.
- `tests/ui/disneyplus-browse.ui.test.js`: Fixture discovery and overlay attachment tests.

### Task 1: Replace standard-card aria-label extraction

**Files:**

- Modify: `tests/unit/core/surfaces.test.js:267-310`
- Modify: `src/core/surfaces.js:216-257`

**Interfaces:**

- Consumes: `extractDisneyPlusTitle(tile: Element): string|null`
- Produces: The first non-empty descendant image `alt`, or `null` when absent.

- [ ] **Step 1: Write the failing unit tests**

Replace the aria-label-only extraction cases with:

```js
it.each([
    ["Marvel Studios' The Avengers", "New Movie Badge Marvel Studios' The Avengers Rated 12+"],
    ['The Devil Wears Prada 2', 'New Movie Badge The Devil Wears Prada 2 Rated 12+'],
    ['Furious', 'Hulu Original Series New Episode Badge Furious Rated 18+'],
    ['BLEACH: Thousand-Year Blood War', 'New Episode Badge BLEACH: Thousand-Year Blood War Rated 16+'],
    ['The Bear', 'Hulu Original Series Subtitles Available Badge The Bear'],
])('extracts the clean Disney+ title for %s', (title, ariaLabel) => {
    const tile = document.createElement('a');
    tile.setAttribute('aria-label', ariaLabel);
    tile.innerHTML = `<img alt=""><img alt="${title}">`;
    expect(extractDisneyPlusTitle(tile)).toBe(title);
});

it('rejects a Disney+ card without a clean title image', () => {
    const tile = document.createElement('a');
    tile.setAttribute('aria-label', 'New Movie Badge The Devil Wears Prada 2 Rated 12+');
    tile.innerHTML = '<img alt="">';
    expect(extractDisneyPlusTitle(tile)).toBeNull();
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `npx vitest run tests/unit/core/surfaces.test.js -t "Disney+"`

Expected: FAIL because `extractDisneyPlusTitle` still derives its value from the aria-label.

- [ ] **Step 3: Implement the minimal clean-title extractor**

Replace the aria-label cleanup body with:

```js
export function extractDisneyPlusTitle(tile) {
    return [...tile.querySelectorAll('img[alt]')].map(image => image.alt.trim()).find(Boolean) ?? null;
}
```

Keep the `SHELF_CARD` selector and shelf-item parent container unchanged.

- [ ] **Step 4: Run the focused unit tests to verify they pass**

Run: `npx vitest run tests/unit/core/surfaces.test.js -t "Disney+"`

Expected: PASS, including all five badge patterns and the missing-title case.

- [ ] **Step 5: Commit the extraction change**

```bash
git add src/core/surfaces.js tests/unit/core/surfaces.test.js
git commit -m "fix(surfaces): use disney plus image title metadata"
```

### Task 2: Add Continue Watching discovery and fixture coverage

**Files:**

- Modify: `tests/unit/core/surfaces.test.js:267-310`
- Modify: `src/core/surfaces.js:241-257`
- Modify: `tests/fixtures/disneyplus-browse.html:20-70`
- Modify: `tests/ui/disneyplus-browse.ui.test.js:46-64`

**Interfaces:**

- Consumes: a wrapper matching `[data-testid="set-section"][data-set-style="continue_watching"] [data-testid="cw-set-item-wrapper"]`.
- Produces: a surface whose title is the second child text of `[data-testid="cw-set-item-metadata"]` and whose container is the enclosing `[data-testid="set-shelf-item"]`.

- [ ] **Step 1: Write the failing Continue Watching unit test**

```js
it('discovers a Continue Watching title from its metadata', () => {
    document.body.innerHTML = `
        <section data-testid="set-section" data-set-style="continue_watching">
            <div data-testid="set-shelf-item">
                <span data-testid="cw-set-item-wrapper">
                    <a data-testid="set-item" href="/play/title-id"><img alt=""></a>
                    <a data-testid="cw-set-item-metadata" href="/browse/entity-title-id">
                        <div>9m remaining</div><div>How I Met Your Mother</div>
                    </a>
                </span>
            </div>
        </section>
    `;
    const [surface] = new DisneyPlusSurfaceManager(createMockLogger()).discover(document.body);
    expect(surface).toMatchObject({ title: 'How I Met Your Mother', fadeable: true, showFadeToggle: false });
    expect(surface.container).toBe(document.querySelector('[data-testid="set-shelf-item"]'));
});
```

- [ ] **Step 2: Run the Continue Watching test to verify it fails**

Run: `npx vitest run tests/unit/core/surfaces.test.js -t "Continue Watching title"`

Expected: FAIL because `DISNEY_PLUS_SURFACES` has no Continue Watching definition.

- [ ] **Step 3: Add the Continue Watching surface definition**

Add this definition beside `SHELF_CARD`:

```js
CONTINUE_WATCHING: Object.freeze({
    titleSelector:
        '[data-testid="set-section"][data-set-style="continue_watching"] [data-testid="cw-set-item-wrapper"]',
    getTitle: wrapper => wrapper.querySelector('[data-testid="cw-set-item-metadata"]')?.children[1]?.textContent,
    getContainer: containerFromClosest('[data-testid="set-shelf-item"]'),
    fadeable: true,
    showFadeToggle: false,
}),
```

- [ ] **Step 4: Run the Continue Watching test to verify it passes**

Run: `npx vitest run tests/unit/core/surfaces.test.js -t "Continue Watching title"`

Expected: PASS with the metadata title and the shelf-item container.

- [ ] **Step 5: Extend the fixture and UI expectation**

Update standard cards with title-art image `alt` values. Add a `continue_watching` section with a `cw-set-item-wrapper`, a playback link, and a metadata link whose second child is `How I Met Your Mother`. Update the UI expected title list to include that title, and increase both overlay counts from `3` to `4`.

- [ ] **Step 6: Run the focused UI test to verify it passes**

Run: `npx vitest run tests/ui/disneyplus-browse.ui.test.js`

Expected: PASS with four discovered titles and four shelf-item child overlays.

- [ ] **Step 7: Commit the Continue Watching support**

```bash
git add src/core/surfaces.js tests/unit/core/surfaces.test.js tests/fixtures/disneyplus-browse.html tests/ui/disneyplus-browse.ui.test.js
git commit -m "fix(surfaces): support disney plus continue watching"
```

### Task 3: Verify the complete change

**Files:**

- Verify only: `src/core/surfaces.js`
- Verify only: `tests/unit/core/surfaces.test.js`
- Verify only: `tests/fixtures/disneyplus-browse.html`
- Verify only: `tests/ui/disneyplus-browse.ui.test.js`

**Interfaces:**

- Consumes: completed clean standard-card extraction and Continue Watching discovery.
- Produces: evidence that the project remains formatted, lint-clean, tested, and buildable.

- [ ] **Step 1: Run focused Disney+ tests**

Run: `npx vitest run tests/unit/core/surfaces.test.js tests/ui/disneyplus-browse.ui.test.js`

Expected: PASS with no failed Disney+ surface tests.

- [ ] **Step 2: Run static checks**

Run: `npm run lint && npm run format:check`

Expected: Both commands exit with status 0.

- [ ] **Step 3: Run the complete test suite and build**

Run: `npm test && npm run build`

Expected: Both commands exit with status 0, and the build produces all three distribution targets.

- [ ] **Step 4: Commit formatter-only changes if they exist**

```bash
git status --short
git add src/core/surfaces.js tests/unit/core/surfaces.test.js tests/fixtures/disneyplus-browse.html tests/ui/disneyplus-browse.ui.test.js
git commit -m "style: format disney plus surface tests"
```

Run the commit only if the status command reports formatter changes in the listed files. Otherwise, leave the working tree unchanged.
