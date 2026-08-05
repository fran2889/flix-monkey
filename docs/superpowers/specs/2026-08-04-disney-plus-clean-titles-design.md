# Design Spec: Disney+ Clean Card Titles

**Date:** 2026-08-04

**Status:** Approved

## Summary

Replace Disney+ aria-label title parsing with title values already exposed by
the rendered cards. Add Continue Watching as a supported Disney+ surface.

## Evidence

Live Disney+ DOM inspection found these stable, clean title sources:

- Standard shelf cards expose their title as a non-empty descendant `img[alt]`.
  This covers cards with New Movie, New Episode, Hulu Original Series, and
  subtitles badges.
- Continue Watching cards are marked by
  `[data-testid="set-section"][data-set-style="continue_watching"]`. Each
  `[data-testid="cw-set-item-wrapper"]` contains
  `[data-testid="cw-set-item-metadata"]`; its second direct child contains
  the title text.

The current implementation reads only the standard card `aria-label`. This
requires brittle removal of badge, provider, rating, release-year, and genre
metadata. It also excludes Continue Watching because its playback link uses
`/play/` rather than `/browse/entity-`.

## Chosen Design

Keep two declarative Disney+ surface definitions in `src/core/surfaces.js`:

1. Standard shelf cards select existing title-entity links and obtain the title
   from the first non-empty descendant `img[alt]`. The shelf-item parent remains
   the overlay container.
2. Continue Watching selects its wrapper only within the `continue_watching`
   section. It obtains the title from the metadata link's title child and uses
   the enclosing shelf item as the overlay container.

Both surfaces remain fadeable and do not show the hover-preview fade toggle.
They return `null` if their clean source is missing or empty, so no fallback to
aria-label parsing can issue a lookup for badge text or episode metadata.

## Alternatives Considered

- Extend the aria-label parser for every badge and metadata ordering: rejected
  because Disney+ changes these strings by content type and locale.
- Use aria-label as a fallback when clean title metadata is absent: rejected to
  preserve the requirement that title lookups use only clean title values.

## Testing

- Update the Disney+ unit tests to assert clean title extraction for the
  reported badge patterns and Continue Watching metadata.
- Extend the Disney+ fixture with standard cards containing title-art `alt`
  values and a Continue Watching section with title metadata.
- Update the Disney+ UI test to verify discovery and overlay injection for both
  surface types, including the shelf-item container.
- Run affected tests first, then lint, formatting checks, the full test suite,
  and the all-target build.
