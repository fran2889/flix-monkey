# Design Spec: HBO Max Support

**Date:** 2026-08-01

**Status:** Approved

## Summary

Add HBO Max as a supported streaming service across the userscript, Firefox
extension, and Chrome extension. Reuse the shared service abstraction, rating
lookup pipeline, overlay renderer, cache, fade behavior, and SPA observers.

The first release decorates standard HBO Max movie, show, and mini-series tiles
on home, catalog, and search pages. It excludes title-page hero artwork,
episodes, sport, topical content, menus, and hover-specific surfaces.

## Goals

- Detect and run on `play.hbomax.com`.
- Let users enable or disable HBO Max through the existing service settings.
- Enable HBO Max by default for existing and new users.
- Add ratings to movie, show, and mini-series tiles only.
- Preserve Netflix behavior and avoid broad changes to the rating pipeline.

## Non-Goals

- Decorating HBO Max title-page hero artwork.
- Looking up episode, live-sport, topical, or video tiles.
- Adding a new rating provider or changing cache behavior.
- Supporting HBO Max marketing, account, help, or authentication domains.

## Architecture

Add `HboMaxService` alongside `NetflixService` in `src/core/services.js`.
It exposes the `hbomax` ID, the `play.hbomax.com` runtime domain,
`HboMaxSurfaceManager`, no service-specific overlay constants, and an
`isEnabled()` implementation backed by `enableHboMax`.

Add `HboMaxSurfaceManager` alongside `NetflixSurfaceManager` in
`src/core/surfaces.js`. Both continue to inherit from the shared
`SurfaceManager` and use declarative surface definitions.

Extend a surface definition with an optional `getTitle(element)` callback.
When present, `SurfaceManager` uses it instead of `titleAttribute`. Existing
Netflix definitions remain unchanged and continue using attributes. This is a
small generalization that keeps the service-specific parsing localized.

The HBO Max definition selects:

```css
a[data-testid$="_tile"][data-sonic-type]
```

The title extractor accepts only `movie`, `show`, and `mini-series` values for
`data-sonic-type`. It reads the tile `aria-label`, removes directional-control
characters, and extracts the leading title before HBO Max's card-position
metadata. It returns no title when the label does not match the expected shape,
which causes discovery to skip the tile rather than submit an incorrect lookup.
The tile link is the overlay container and is fadeable, consistent with Netflix
browse and search cards.

## Runtime Behavior

Both extension manifests add `https://play.hbomax.com/*` to host permissions
and content-script matches. Userscript metadata adds the same `@match` pattern.
The shared content script continues to bootstrap the app; `ServiceRegistry`
selects HBO Max on that host.

Add `enableHboMax` to the existing `services` settings row in
`CONFIG_FIELDS`, defaulting to `true`. Update the extension options save hook
to reload matching Netflix and HBO Max tabs. Userscript settings continue to
reload the current page after saving.

The existing mutation observer and navigation patches rediscover tiles after
HBO Max loads more content or changes its SPA route. The existing cache,
in-flight request de-duplication, API clients, renderer, fading, and config
behavior are shared without modification.

## Testing

Add sanitized HBO Max fixture HTML containing movie, show, mini-series, video,
and sport tiles. UI tests load the fixture and verify discovery and overlay
attachment for supported tiles only.

Add unit coverage for:

- `HboMaxService` metadata, enablement, registry membership, and host detection.
- HBO Max title extraction, including directional-control characters.
- Filtering of unsupported `video`, sport, and malformed tiles.
- The optional `getTitle()` surface-definition path, while preserving existing
  attribute-based behavior.
- The `enableHboMax` default and options-page reload query covering HBO Max.

Run the affected unit and UI suites, then lint, format-check, build all targets,
and run the full test suite before implementation is considered complete.

## Documentation

Update the README to list HBO Max as a supported service and adjust any
Netflix-only user-facing wording. Update the package description in
`package.json` and the store copy in `docs/store-description.txt` to name both
Netflix and HBO Max. Add screenshots only when a representative HBO Max capture
is available.
