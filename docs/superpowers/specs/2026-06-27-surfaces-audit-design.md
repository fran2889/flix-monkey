# Surfaces Audit: Selector Tightening, Comments & Fresh Fixtures

**Date:** 2026-06-27
**File:** `src/core/surfaces.js`, `tests/unit/core/surfaces.test.js`, `tests/fixtures/`
**Scope:** Remove dead surfaces and selectors, tighten live ones, split previewModal into distinct mini-modal and detail-modal surfaces, add comments, capture fresh anonymised DOM fixtures from Chromium and migrate the surfaces unit test to use them.

---

## Background

A live-DOM audit was run against Netflix via Chrome DevTools (port 9222) across three contexts — the browse page (row cards), a search results page, and both the hover mini-modal and the full "More Info" detail modal — to verify every selector in `#SURFACES`.

The audit found three categories of dead code:

1. **BOB surface** (`.bob-title` / `.bob-container`): `.bob-title` = 0 matches even after hover simulation. `.bob-container` has 64 elements but each has `childCount: 0, innerHTML: ''` — empty shells nested inside `.title-card`. Netflix no longer populates this mount point; the hover popup is now the previewModal mini-modal.

2. **Three stale previewModal selectors**: Of the four `titleSelectors`, only `.previewModal--player_container img[alt]` ever matches. `.previewModal--player-titleTreatmentWrapper img[alt]` is dead because the logo `<img>` inside that wrapper has `alt=null`. `[data-uia="previewModal-title"]` and `.previewModal--boxarttitle` return 0 across all tested contexts.

3. **jawBone surface** (`.jawBone` / `.jawBoneContainer` / `.previewModal--detailsMetadata` selectors): `.jawBone` and `.jawBoneContainer` are absent from the current Netflix DOM. All eight title selectors return 0. The five `previewModal--detailsMetadata` sub-selectors are also wrong-layer — the detail metadata block only contains synopsis, cast, and genre, never title info (title lives in `.previewModal--player_container`, handled by the previewModal surface). The entire surface is removed.

The audit also confirmed that the previewModal wrapper carries distinct classes — `mini-modal` for the card hover popup and `detail-modal` for the full "More Info" modal. The single merged previewModal surface is split into two, one per logical Netflix surface, so future UI changes can target each independently.

The existing surfaces unit test uses hand-crafted inline DOM. Two of the four existing fixture files (`netflix-hover.html`, `netflix-modal.html`) are orphaned — no test loads them. All fixture files are stale (oldest meta tags date to 2022). Fixtures are refreshed from the live Chromium session as part of this change.

---

## Changes

### 1. `src/core/surfaces.js` — Remove BOB surface

The entire BOB entry is deleted.

### 2. `src/core/surfaces.js` — Remove jawBone surface

The entire jawBone entry is deleted. No surviving selectors reference `.jawBone`, `.jawBoneContainer`, or `.previewModal--detailsMetadata`.

### 3. `src/core/surfaces.js` — Split previewModal into two surfaces

The single previewModal surface becomes:

**previewModal-mini** — hover mini-modal that appears on card mouse-over:

- `titleSelectors`: `.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]`
- `containerSel`: `.previewModal--player_container`

**previewModal-detail** — full "More Info" detail modal:

- `titleSelectors`: `.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]`
- `containerSel`: `.previewModal--player_container`

Both use `getTitle: el => el.getAttribute('alt')?.trim() ?? null` and `fadeable: false`. The `seen` set stays clean because the two modals are mutually exclusive — opening the detail modal dismisses the mini-modal.

The titleSelector is scoped to the wrapper class so each surface is self-contained: one selector, one logical Netflix UI area.

### 4. `src/core/surfaces.js` — Add comments

Each surface entry gets a short block comment naming the Netflix UI area it targets and explaining why the specific selector was chosen.

### 5. `tests/fixtures/surfaces/` — Capture and anonymise fresh DOM extracts

Capture a minimal but authentic DOM extract for each surface from the live Chromium session (port 9222) and save as:

| File                                          | Surface             | What to capture                                                                                            |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tests/fixtures/surfaces/title-card.html`     | title-card          | A single row of browse cards — enough `.title-card` elements to have 3–5 with `.fallback-text` titles      |
| `tests/fixtures/surfaces/standard-card.html`  | standard-card       | A grid of search result cards — enough `[data-uia="standard-card"]` elements to have 3–5 with `aria-label` |
| `tests/fixtures/surfaces/preview-mini.html`   | previewModal-mini   | The `.previewModal--wrapper.mini-modal` element with its player container and boxart image                 |
| `tests/fixtures/surfaces/preview-detail.html` | previewModal-detail | The `.previewModal--wrapper.detail-modal` element with its player container and boxart image               |

**What is kept (real content data):**

- All show and movie titles — `.fallback-text` text, `img[alt]`, `aria-label` on cards
- All Netflix CDN image URLs — show thumbnails, boxart, title treatment images
- All page structure — class names, `data-uia` attributes, DOM hierarchy

**What is removed (user-identifying data only):**

- **Profile name** — text content of the profile display name element in the nav, and the suffix in "Continue Watching for [Name]" → replaced with `"Test User"`
- **User avatar** — the profile `<img>` `src` attribute → replaced with empty string
- **Cookies** — any `<script>` blocks that set or reference `document.cookie`, and `<meta>` cookie-related tags → removed
- **API keys and session tokens** — Netflix embeds auth tokens and API keys in inline `<script>` blocks and `data-*` attributes (e.g. `authURL`, `esn`, bearer tokens in page state JSON) → those `<script>` blocks are removed; any `data-*` attribute whose value looks like a token (long alphanumeric, base64, or JWT-shaped string) is stripped
- **"My List" row** — the entire row `<div>` whose heading matches "My List" → removed
- **"Continue Watching" row** — the entire row `<div>` whose heading matches "Continue Watching" → removed

All other `<script>` tags (page bootstrap, polyfills, feature flags without tokens) are also removed since they are non-functional outside the Netflix origin and add bulk.

Captures are extracted from the live Chromium DOM at the element level (not full-page saves), wrapped in a minimal `<html><body>…</body></html>` shell.

### 6. `tests/fixtures/netflix-browse.html` and `tests/fixtures/netflix-search.html` — Refresh

Existing UI test fixture files are refreshed from Chromium using the same anonymisation rules. These stay as fuller page captures (more structural context) since `browse.ui.test.js` and `search.ui.test.js` test overlay injection on realistic DOM, not just selector matching.

`netflix-hover.html` and `netflix-modal.html` remain in place but are also refreshed so they're ready when their corresponding UI tests are written. They are not wired up to tests in this change.

### 7. `tests/unit/core/surfaces.test.js` — Migrate to fixture-based tests

The surfaces unit test is split into two groups:

**Fixture-based discovery tests** (new) — load each surface fixture and assert that `discover()` returns the expected surface shape. These prove the selectors work against real Netflix DOM structure.

**Inline DOM edge-case tests** (retained) — hand-crafted minimal DOM for behaviour that doesn't depend on Netflix structure: empty title text, null alt, fallback to `parentElement`, `querySelectorAll` errors, deduplication via `seen`.

Tests for removed surfaces (BOB, jawBone, stale previewModal selectors) are deleted.

---

## Resulting `#SURFACES` (reference)

```js
// Surface priority order: title-card → search → previewModal-mini → previewModal-detail.
#SURFACES = [
    {
        // Browse and genre page row cards. `.fallback-text` is the text title
        // Netflix renders for cards whose thumbnail has no baked-in title logo.
        titleSelectors: '.title-card .fallback-text',
        getTitle: el => el.textContent?.trim() ?? null,
        containerSel: '.title-card',
        fadeable: true,
    },
    {
        // Search result grid cards. The card element itself carries the full
        // title via aria-label; there is no separate fallback-text here.
        titleSelectors: '[data-uia="standard-card"]',
        getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
        containerSel: '[data-uia="standard-card"]',
        fadeable: true,
    },
    {
        // Hover mini-modal (card mouse-over).
        titleSelectors: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
        getTitle: el => el.getAttribute('alt')?.trim() ?? null,
        containerSel: '.previewModal--player_container',
        fadeable: false,
    },
    {
        // Full "More Info" detail modal.
        titleSelectors: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
        getTitle: el => el.getAttribute('alt')?.trim() ?? null,
        containerSel: '.previewModal--player_container',
        fadeable: false,
    },
];
```

---

## What is not changing

- `discover()` logic — no changes to the surface iteration, `seen` set, or fallback to `parentElement`.
- `SurfaceManager` class structure, constructor, and `#logger` usage.
- title-card and standard-card surfaces — confirmed working, no selector changes.
- `browse.ui.test.js` and `search.ui.test.js` test logic — only their fixture files are refreshed.
- `info.ui.test.js` — uses inline DOM for the `previewModal` surface; aligning it to fixture-based is out of scope.
