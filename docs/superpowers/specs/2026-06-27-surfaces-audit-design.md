# Surfaces Audit: Selector Tightening & Comments

**Date:** 2026-06-27
**File:** `src/core/surfaces.js`
**Scope:** Remove dead surfaces and selectors, tighten live ones, split previewModal into distinct mini-modal and detail-modal surfaces, add comments that link each surface to its Netflix UI area.

---

## Background

A live-DOM audit was run against Netflix via Chrome DevTools (port 9222) across three contexts — the browse page (row cards), a search results page, and both the hover mini-modal and the full "More Info" detail modal — to verify every selector in `#SURFACES`.

The audit found three categories of dead code:

1. **BOB surface** (`.bob-title` / `.bob-container`): `.bob-title` = 0 matches even after hover simulation. `.bob-container` has 64 elements but each has `childCount: 0, innerHTML: ''` — empty shells nested inside `.title-card`. Netflix no longer populates this mount point; the hover popup is now the previewModal mini-modal.

2. **Three stale previewModal selectors**: Of the four `titleSelectors`, only `.previewModal--player_container img[alt]` ever matches. `.previewModal--player-titleTreatmentWrapper img[alt]` is dead because the logo `<img>` inside that wrapper has `alt=null`. `[data-uia="previewModal-title"]` and `.previewModal--boxarttitle` return 0 across all tested contexts.

3. **jawBone surface** (`.jawBone` / `.jawBoneContainer` / `.previewModal--detailsMetadata` selectors): `.jawBone` and `.jawBoneContainer` are absent from the current Netflix DOM. All eight title selectors return 0. The five `previewModal--detailsMetadata` sub-selectors are also wrong-layer — the detail metadata block only contains synopsis, cast, and genre, never title info (title lives in `.previewModal--player_container`, handled by the previewModal surface). The entire surface is removed.

The audit also confirmed that the previewModal wrapper carries distinct classes — `mini-modal` for the card hover popup and `detail-modal` for the full "More Info" modal. The single merged previewModal surface is split into two, one per logical Netflix surface, so future UI changes can target each independently.

---

## Changes

### Remove BOB surface entirely

The entire BOB entry is deleted.

### Remove jawBone surface entirely

The entire jawBone entry is deleted. No surviving selectors reference `.jawBone`, `.jawBoneContainer`, or `.previewModal--detailsMetadata`.

### Split previewModal into two surfaces

The single previewModal surface becomes:

**previewModal-mini** — hover mini-modal that appears on card mouse-over:

- `titleSelectors`: `.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]`
- `containerSel`: `.previewModal--player_container`

**previewModal-detail** — full "More Info" detail modal:

- `titleSelectors`: `.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]`
- `containerSel`: `.previewModal--player_container`

Both use `getTitle: el => el.getAttribute('alt')?.trim() ?? null` and `fadeable: false`. The `seen` set stays clean because the two modals are mutually exclusive — opening the detail modal dismisses the mini-modal.

The titleSelector is scoped to the wrapper class so each surface is self-contained: one selector, one logical Netflix UI area.

### Add comments to all surviving surfaces

Each surface entry gets a short block comment naming the Netflix UI area it targets.

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
- title-card and standard-card surfaces — confirmed working, no changes.

---

## Testing

Manual verification via the live Netflix DOM is the primary test. Unit tests for `SurfaceManager.discover()` should mock DOM trees covering each of the four surviving surfaces and assert that the correct `{ container, title, fadeable }` tuples are returned.
