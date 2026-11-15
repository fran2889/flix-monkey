# Netflix More Like This Ratings Design

## Problem

Netflix's title detail modal has a "More Like This" section whose tiles use
`.titleCard--container` and `.titleCard-imageWrapper` markup. The current Netflix
surface definitions only match browse rows through `.title-card a[aria-label]`, so
the recommendations never receive rating badges even though the modal hero and the
page behind it do.

## Intent

Every More Like This tile shows the same rating badges as the other Netflix
surfaces. These are ordinary browse-style cards: they follow the same fade rules
and the same rating retrieval path, with no recommendation-specific behavior.

## Goals

- Add a `MORE_LIKE_THIS` surface scoped to `.moreLikeThis--wrapper .titleCard--container`.
- Read the title from the tile's `aria-label`, falling back to the artwork's `alt`
  when the label is missing or unusable.
- Anchor the badge to `.titleCard-imageWrapper` so it sits on the artwork at the
  configured overlay corner.
- Use `fadeable: true` and `showFadeToggle: false`, matching browse cards.
- Discover tiles when the modal opens and when the section expands or re-renders,
  using the existing `MutationObserver` and discovery path.
- Avoid duplicate overlays on the same tile.
- Leave every existing Netflix surface and the shared rating pipeline unchanged.

## Non-Goals

- No visibility or lazy-loading logic. All discovered tiles are decorated at once,
  exactly as browse cards are today. This includes collapsed tiles, at the cost of
  their initial lookups.
- No changes to overlay rendering, providers, configuration, caching, or API
  clients.
- No support for other streaming services or for unrelated Netflix sections.

## Anti-Goals

- Matching browse rows, search cards, Continue Watching cards, Top 10 cards, or the
  modal hero.
- A separate rating pipeline or a different overlay behavior for recommendations.
- Duplicate overlays or duplicate lookups for the same tile.
- Editing generated output under `dist/` or `coverage/`.

## Constraints

- Follow the existing `SurfaceDefinition` architecture and `NETFLIX_SURFACES` map.
- Strict TypeScript, sorted imports, SPDX headers, and JSDoc on exported
  declarations.
- Fixture-backed UI coverage belongs in `tests/ui/`; synthetic edge cases belong in
  `tests/unit/`.
- Preserve the unrelated working-tree changes currently on `fix/provider-miss-logging`
  by branching from `main`.
- `npm run type-check`, `npm run lint`, `npm run format:check`, `npm run build`, and
  `npm run test:coverage` must pass.

## Approaches

1. **New `MORE_LIKE_THIS` definition in `NETFLIX_SURFACES`** (chosen). Selector
   `.moreLikeThis--wrapper .titleCard--container`, a dedicated title extractor, and
   an image-wrapper container resolver. Isolated from existing selectors and easy to
   cover with a section fixture.
2. **Widen the existing `TITLE_CARD` definition**. Fewer definitions, but it couples
   unrelated Netflix layouts and risks changing browse behavior.
3. **Match `.titleCard-imageWrapper` directly**. The badge container is trivial, but
   title extraction must read an ancestor label and duplicate the fallback logic.

## Decisions

### Surface definition

- Name: `MORE_LIKE_THIS`.
- Title selector: `.moreLikeThis--wrapper .titleCard--container`.
- Title extraction: exported `extractNetflixMoreLikeThisTitle(element)`.
    - Use a trimmed `aria-label` when it has content.
    - Otherwise use the trimmed `alt` of the first
      `.titleCard-imageWrapper img[alt]`, or any `img[alt]` inside the tile when the
      wrapper is absent.
    - Return `undefined` when neither source has usable text.
- Container: the tile's `.titleCard-imageWrapper`, falling back to the tile itself
  when the wrapper is absent. The fallback keeps the overlay on the tile instead of
  letting the generic parent fallback put it on the surrounding row.
- `fadeable: true`, `showFadeToggle: false`.

### Scope and decoration

- Scope to `.moreLikeThis--wrapper` rather than a specific modal ancestor. The class
  identifies the recommendation section, and if Netflix reuses it elsewhere the same
  browse-style behavior is still correct. This is my call.
- Decorate all discovered tiles immediately, including collapsed ones. This follows
  the browse-card behavior the issue asks for and avoids visibility checks that jsdom
  cannot represent reliably.
- Reuse the app's existing mutation and `hasOverlay()` guards for modal re-renders
  and section expansion. No new observer is needed.

### Testing

- Add a sanitized multi-tile More Like This section fixture to
  `tests/fixtures/netflix-surfaces.ts`, covering collapsed and expanded tiles. A
  named export holds the section because the generic fixture helper asserts exactly
  one surface per entry.
- Add a dedicated UI test in `tests/ui/netflix.ui.test.ts` that loads the section,
  verifies discovery of every collapsed and expanded tile, injects overlays into the
  image wrappers, and asserts repeated discovery and injection do not duplicate
  overlays.
- Add unit tests for `extractNetflixMoreLikeThisTitle`: label wins, artwork alt is
  used when the label is missing, whitespace-only labels fall through to the alt,
  whitespace is trimmed, and a tile with no usable label or alt is not discovered.
- Update `README.md` to mention recommendations in the rating badge feature line.

## What Is Left to the Builder

- Create a branch from `main` matching the eventual Conventional Commit type, for
  example `feat/netflix-more-like-this`.
- Implement the surface definition, fixture, UI test, unit tests, and README update.
- Run the required checks and commit with a Conventional Commit message.
