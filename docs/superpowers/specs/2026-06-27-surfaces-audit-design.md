# Surfaces Audit: Selector Tightening & Comments

**Date:** 2026-06-27
**File:** `src/core/surfaces.js`
**Scope:** Remove dead surfaces and selectors, tighten live ones, add comments that link each surface to its Netflix UI area.

---

## Background

A live-DOM audit was run against Netflix via Chrome DevTools (port 9222) across three contexts — the browse page (row cards), a search results page, and both the hover mini-modal and the full "More Info" detail modal — to verify every selector in `#SURFACES`.

The audit found three categories of dead code:

1. **BOB surface** (`.bob-title` / `.bob-container`): `.bob-title` = 0 matches even after hover simulation. `.bob-container` has 64 elements but each has `childCount: 0, innerHTML: ''` — empty shells nested inside `.title-card`. Netflix no longer populates this mount point; the hover popup is now the previewModal mini-modal.

2. **Three stale previewModal selectors**: Of the four `titleSelectors`, only `.previewModal--player_container img[alt]` ever matches. `.previewModal--player-titleTreatmentWrapper img[alt]` is dead because the logo `<img>` inside that wrapper has `alt=null`. `[data-uia="previewModal-title"]` and `.previewModal--boxarttitle` return 0 across all tested contexts.

3. **jawBone `previewModal--detailsMetadata` sub-selectors**: The jawBone surface has eight title selectors split between `.jawBone`/`.jawBoneContainer` targets (the inline expand panel) and `.previewModal--detailsMetadata` targets (the detail modal's metadata block). The metadata block is confirmed present but only contains synopsis, cast, and genre — never title info. All five `detailsMetadata` title selectors return 0. These are wrong-layer: title info in the full detail modal lives in `.previewModal--player_container`, which is already handled by the previewModal surface.

The `.jawBone`/`.jawBoneContainer` classes themselves are also absent from the current Netflix DOM. They target the older inline-expand row panel that Netflix has largely replaced with the mini-modal, but they remain distinct conceptually and are retained as a deprecated safety net.

---

## Changes

### Remove BOB surface entirely

The entire BOB entry is deleted. No surviving selectors reference `.bob-title` or `.bob-container`.

### Tighten previewModal surface to one selector

Remove:

- `.previewModal--player-titleTreatmentWrapper img[alt]`
- `[data-uia="previewModal-title"]`
- `.previewModal--boxarttitle`

Keep:

- `.previewModal--player_container img[alt]` (matches `.previewModal--boxart` with `alt="<title>"`)

`getTitle` collapses to just `el.getAttribute('alt')?.trim() ?? null`.

### Prune jawBone surface

Remove (wrong layer, covered by previewModal surface):

- `.previewModal--detailsMetadata img[alt]`
- `.jawBone .image-fallback-text`
- `.jawBoneContainer .image-fallback-text`
- `.previewModal--detailsMetadata h3`
- `.previewModal--detailsMetadata .title`
- `.previewModal--detailsMetadata [data-uia="previewModal-title"]`

Keep (speculative, inline expand panel):

- `.jawBone img[alt]`
- `.jawBoneContainer img[alt]`

Update `containerSel` from `.jawBone, .jawBoneContainer, .previewModal--detailsMetadata` → `.jawBone, .jawBoneContainer`.

Add `// @deprecated` block comment marking the surface as unobserved in the current Netflix DOM.

### Add comments to all surviving surfaces

Each surface entry gets a short block comment:

- **title-card**: row cards on browse/genre pages; `.fallback-text` is the text title Netflix renders for cards whose thumbnail has no baked-in title logo.
- **standard-card**: search result grid; the card element carries the title via `aria-label`.
- **previewModal**: hover mini-modal and full "More Info" detail modal; the boxart `<img alt>` inside `.previewModal--player_container` always carries the clean title.
- **jawBone** (deprecated): the older inline-expand row panel; `.jawBone`/`.jawBoneContainer` are absent from the current DOM but retained in case Netflix reinstates this UI path.

---

## Resulting `#SURFACES` (reference)

```js
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
        // Hover mini-modal and full "More Info" detail modal. The boxart <img>
        // inside the player container always carries the clean title in alt.
        titleSelectors: '.previewModal--player_container img[alt]',
        getTitle: el => el.getAttribute('alt')?.trim() ?? null,
        containerSel: '.previewModal--player_container',
        fadeable: false,
    },
    {
        // @deprecated — .jawBone / .jawBoneContainer are absent from the
        // current Netflix DOM. Retained as a safety net for A/B variants and
        // legacy paths that still use the older inline-expand row panel.
        titleSelectors: [
            '.jawBone img[alt]',
            '.jawBoneContainer img[alt]',
        ].join(','),
        getTitle: el => el.getAttribute('alt')?.trim() ?? null,
        containerSel: '.jawBone, .jawBoneContainer',
        fadeable: false,
    },
];
```

---

## What is not changing

- `discover()` logic — no changes to the surface iteration, `seen` set, or fallback to `parentElement`.
- `SurfaceManager` class structure, constructor, and `#logger` usage.
- Surface priority order (title-card → search → previewModal → jawBone).

---

## Testing

Manual verification via the live Netflix DOM is the primary test. Unit tests for `SurfaceManager.discover()` should mock a DOM tree covering each surviving surface and assert that the correct `{ container, title, fadeable }` tuples are returned. The BOB surface should have no corresponding test case after this change.
