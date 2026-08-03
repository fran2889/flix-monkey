# Netflix Browse Card Support Design

## Problem

Netflix replaced parts of its browse-page card markup. FlixMonkey still discovers normal legacy title cards, but it does not discover the new Continue Watching or Top 10 cards. Their stable markup is:

- Continue Watching: `a[data-uia="progress-card"][aria-label]`
- Top 10: `a[data-uia="ranked-card"][aria-label]`

The card anchor contains the title in `aria-label` and provides the appropriate boundary for rating overlay injection and fading. This change concerns browse-page thumbnails, not mouseover previews.

## Scope

- Add explicit surface definitions for progress and ranked cards.
- Preserve existing title-card, search-card, mini-preview, and detail-preview support.
- Refresh every existing Netflix fixture from the current live Chromium session.
- Extend the capture script so future captures work with the current carousel layout.
- Add fixture-backed UI coverage for discovery and injection on the new card types.
- Preserve the existing test taxonomy: rendering behavior remains in unit tests.

## Surface Architecture

Add two entries to `NETFLIX_SURFACES`:

1. `PROGRESS_CARD`
    - Title selector: `[data-uia="progress-card"][aria-label]`
    - Container selector: `[data-uia="progress-card"]`
    - Title attribute: `aria-label`
    - Fadeable: `true`
    - Fade toggle: `false`

2. `RANKED_CARD`
    - Title selector: `[data-uia="ranked-card"][aria-label]`
    - Container selector: `[data-uia="ranked-card"]`
    - Title attribute: `aria-label`
    - Fadeable: `true`
    - Fade toggle: `false`

Explicit `data-uia` selectors are preferred over a generic labeled-anchor fallback. They identify the intended Netflix components without matching navigation links, controls, or unrelated modal content.

## Fixture Capture

Update `scripts/capture-surface-fixtures.py` to recognize the current `.carousel-row` browse layout and stable card attributes. The refreshed fixture set will include:

- Normal browse cards
- Continue Watching progress cards
- Top 10 ranked cards
- Search standard cards
- Hover mini-preview
- Full detail preview
- The corresponding aggregate browse, search, hover, and modal fixtures

The script will continue to remove scripts and external stylesheets, anonymize profile information, and strip token-shaped data attributes. Fixture selection will use stable attributes where available instead of generated CSS class names.

If an expected surface is absent, the capture must fail clearly instead of silently writing an empty fixture. Interactive preview capture may use a current browse card suitable for hover behavior while keeping the preview selectors unchanged.

## Testing

Fixture-backed UI tests will verify:

- Surface discovery returns non-empty titles and the expected card container.
- Progress and ranked cards are marked fadeable and do not expose a fade toggle.
- Loading and rating overlays can be injected into each new surface container.

Rendering details, CSS content, links, and conditional badge behavior remain covered by unit tests. Synthetic unit tests will cover only edge cases that fixtures do not represent.

## Error Handling and Compatibility

Existing surface definitions remain unchanged, so installations continue to support accounts or Netflix experiments that still receive older markup. Generated class names will not be used as selectors. Missing live surfaces during fixture capture will produce an actionable error naming the missing surface.

## Verification

Run the focused surface and UI tests first, then run the repository checks required for submission:

```bash
npm run build
npm test
npm run lint
npm run format:check
```

The live Chromium session will also be used for a read-only confirmation that the updated selectors discover Continue Watching and Top 10 cards.
