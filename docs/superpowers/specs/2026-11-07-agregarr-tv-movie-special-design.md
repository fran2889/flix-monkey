# Agregarr TV Movies and TV Specials Design

> Date: 2026-11-07
> Issue: [#273](https://github.com/fran2889/flix-monkey/issues/273)

## Context

The Agregarr provider resolves a streaming-service display title to an IMDb ID
through the IMDb Suggestions endpoint, then fetches the rating from Agregarr.
`AgregarrApiClient.search()` only accepts results whose `qid` is in
`AGREGARR_TITLE_TYPES` (`movie`, `tvSeries`, `tvMiniSeries`). IMDb also uses
`tvMovie`, `tvSpecial`, `tvShort`, and `short` for one-off titles, so TV movies
and TV specials are discarded before the rating lookup. The title is then cached
as not found, and no rating appears.

Live examples include _A Charlie Brown Christmas_ (`tt0059026`, `tvMovie`),
_The Office Retrospective_ (`tt3150140`, `tvMovie`), _Bo Burnham: Inside_
(`tt14544192`, `tvSpecial`), and _Friends: The Reunion_ (`tt11337862`,
`tvSpecial`).

## Goals

- Resolve `tvMovie` and `tvSpecial` IMDb Suggestions results to their IMDb IDs.
- Map both to the existing `TitleType.MOVIE` value.
- Keep the current search behavior otherwise: return the first supported
  result and leave all other `qid` values excluded.

## Non-goals

- `tvShort` and `short`. They stay excluded in this fix because the original
  design deliberately excluded short-form content and the false-positive risk
  is higher.
- `video`, `videoGame`, `musicVideo`, and `podcastSeries`.
- Changing the search URL, response parsing, rating lookup, or caching.
- Deduplicating `AGREGARR_TITLE_TYPES` against the mapper.

## Anti-goals

- A short-form title resolving to a rating because its `qid` was widened.
- The allowlist and the type mapper disagreeing about which `qid` values are
  supported.
- Any change to persisted data shape or cache keys.

## Constraints

- `AGREGARR_TITLE_TYPES` gates which results are accepted; it must contain the
  same values `mapAgregarrTitleType` recognizes.
- The design spec at
  `docs/superpowers/specs/2026-06-23-agregarr-api-client-design.md` is a
  historical record and stays unchanged; this design supersedes its allowlist.
- Unit tests cover every business-logic change. No storage migration is needed.

## Approaches Considered

1. **Add the two values to the allowlist and the mapper (chosen).** This is the
   smallest change that fixes the reported behavior, keeps the contract between
   the two lists explicit, and leaves the search flow untouched.
2. **Derive the allowlist from the mapper.** One source of truth would prevent
   future drift, but it changes the mapper's module shape and exported surface
   for no user-visible gain. The two values are still added in this fix; a
   follow-up can remove the duplication if it becomes a recurring problem.
3. **Also accept `tvShort` and `short`.** Rejected by decision: it broadens
   short-form coverage at a higher false-positive risk and is out of scope for
   the issue.

## Implementation

- `src/core/api/agregarr-api-client.ts`: add `tvMovie` and `tvSpecial` to
  `AGREGARR_TITLE_TYPES`.
- `src/core/api/title-type-mappers.ts`: map `tvMovie` and `tvSpecial` to
  `TitleType.MOVIE` in `mapAgregarrTitleType`.
- `tests/unit/core/api/title-type-mappers.test.ts`: assert both values map to
  `MOVIE`, and remove `tvMovie` from the unrecognized-value cases.
- `tests/unit/core/api/agregarr-api-client.test.ts`: assert search accepts and
  maps `tvMovie` and `tvSpecial` results, and that `short` remains excluded.
- `docs/superpowers/specs/2026-06-23-agregarr-api-client-design.md`: leave
  unchanged. Historical plans and specs are immutable; this design supersedes
  its allowlist.

## Verification

- `npm test -- tests/unit/core/api/title-type-mappers.test.ts tests/unit/core/api/agregarr-api-client.test.ts`
- `npm run type-check`
- `npm run lint && npm run format:check`
- `npm run test:coverage`

## Left to the Builder

- Create the branch from `main` as `fix/agregarr-tv-movie-special`, leaving the
  current `refactor/validate-storage-payloads` branch and untracked
  `docs/reviews/` untouched.
- Choose the exact test names and whether the short-form exclusion assertion
  belongs in the client test or only in the mapper test.
