# Design Spec: HBO Max Surface Regressions

**Date:** 2026-08-01

**Status:** Approved

## Summary

Fix three HBO Max discovery and positioning gaps: Continue Watching cards,
search-grid cards, and Top 10 card badge placement. Preserve the existing
service abstraction, renderer, rating pipeline, and Netflix behavior.

## Requirements

- Continue Watching `video` cards receive the rating of their parent series
  when their accessibility label begins with `Watch <series>` followed by
  season or episode metadata.
- Other video, episode, and sport cards remain excluded.
- Search-grid movie, show, and mini-series cards receive ratings when their
  labels use `Title. Row N of M, Column N of M` position metadata.
- Top 10 movie and series badges sit over the thumbnail, never over the rank
  artwork.
- Existing standard rail and Netflix behavior remain unchanged.

## Design

Extend `extractHboMaxTitle()` with explicit, ordered label formats after
directional-control characters are removed:

1. `Number N: Title. N of M`: return `Title` and mark the card as HBO Max
   Top 10.
2. `Title. Row N of M, Column N of M`: return `Title` for search-grid cards.
3. `Watch Title. Season ...` and `Watch Title, Episode ...`: return `Title`
   only for a `video` tile.
4. Existing `Title. N of M`: return `Title` for movie, show, and mini-series
   rail cards.

All other labels return `null`. This remains fail-closed for unsupported
content and incomplete accessibility metadata.

Match the existing Netflix Top 10 rendering model. `OverlayRenderer` uses the
service-provided Top 10 class and a `TOP_10_OFFSET` service constant for
left-corner placement. Netflix retains its existing effective `50% + 6px`
offset. HBO Max marks only cards recognized by the Number label form with
`fm-hbo-top-10` and provides a `30%` offset, which places the badge at the
observed thumbnail start rather than on the rank artwork. Right-corner
positions retain their existing right alignment.

## Testing

- Unit-test each accepted label format and rejected near-match.
- Fixture-test discovery for Continue Watching, search grid, standard rail,
  and Top 10 cards.
- Assert the HBO Max Top 10 wrapper receives `fm-hbo-top-10`, and renderer CSS
  uses `calc(30% + 6px)` for its left-corner placement.
- Retain assertions that unsupported sport and ordinary episode cards are
  skipped, and that HBO overlays do not create nested anchors.

Run focused unit and UI tests, then lint, format-check, the full test suite,
and all-target build.
