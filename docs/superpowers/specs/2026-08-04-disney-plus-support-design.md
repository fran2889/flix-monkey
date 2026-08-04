# Design Spec: Disney+ Support

**Date:** 2026-08-04

**Status:** Approved

## Summary

Add Disney+ as a supported streaming service across the userscript, Firefox
extension, and Chrome extension. Reuse the shared service abstraction, rating
lookup pipeline, overlay renderer, cache, fade behavior, and SPA observers.

The first release decorates standard Disney+ movie and series cards on home,
browse, watchlist, search, and collection shelves. It excludes the large home
hero, title-detail pages, live sports, scheduled events, and collection-page
cards.

## Goals

- Detect and run on `www.disneyplus.com`, including all locale paths.
- Let users enable or disable Disney+ through the existing service settings.
- Enable Disney+ by default for existing and new users.
- Add ratings and all shared fade behavior to supported movie and series cards.
- Preserve Netflix and HBO Max behavior and avoid changes to the rating
  pipeline.

## Non-Goals

- Decorating the Disney+ home hero or title-detail pages.
- Looking up live sports, scheduled events, episodes, or collection pages.
- Adding a new rating provider or changing cache behavior.
- Supporting Disney+ marketing, account, help, or authentication pages.

## Architecture

Add `DisneyPlusService` alongside `NetflixService` and `HboMaxService` in
`src/core/services.js`. It exposes the `disneyplus` ID, the `disneyplus.com`
runtime domain, `DisneyPlusSurfaceManager`, no service-specific overlay
constants, and an `isEnabled()` implementation backed by `enableDisneyPlus`.

Add `DisneyPlusSurfaceManager` alongside the existing service-specific surface
managers in `src/core/surfaces.js`. It continues to inherit from the shared
`SurfaceManager` and uses a declarative surface definition.

The Disney+ definition selects card links with:

```css
a[data-testid="set-item"][data-item-id][href*="/browse/entity-"]
```

The selector limits discovery to title entities and excludes collection-page
links. The title extractor reads the card's accessible label, removes known
availability and branding badges, and extracts the title before Disney+'s
rating, release-year, genre, or "Select for details" metadata. It rejects
labels marked `LIVE` or `Upcoming`, as well as malformed labels. Returning no
title causes discovery to skip the card rather than issue an incorrect API
request.

The tile link is the overlay container. It is fadeable and does not expose the
hover-preview fade toggle, consistent with Netflix browse cards and HBO Max
tiles. Shared fade settings and per-title fade overrides therefore work on
Disney+ without service-specific changes.

## Runtime Behavior

All extension manifests add `https://www.disneyplus.com/*` to host permissions
and content-script matches. Userscript metadata adds the same `@match` pattern.
The shared content script continues to bootstrap the app, and `ServiceRegistry`
selects Disney+ on that host.

Add `enableDisneyPlus` to the existing `services` settings row in
`CONFIG_FIELDS`, defaulting to `true`. Update the extension options save hook
to reload matching Netflix, HBO Max, and Disney+ tabs. Userscript settings
continue to reload the current page after saving.

The existing mutation observer and navigation patches rediscover cards after
Disney+ loads rows or changes its SPA route. The existing cache, in-flight
request de-duplication, API clients, renderer, fading, and configuration
behavior are shared without modification.

## Testing

Add sanitized Disney+ fixture HTML containing supported movie and series cards,
a live-event card, a scheduled-event card, and a collection-page card. UI tests
load the fixture and verify discovery and overlay attachment for supported cards
only.

Add unit coverage for:

- `DisneyPlusService` metadata, enablement, registry membership, and host
  detection.
- Disney+ title extraction, including accessibility badges and title metadata.
- Rejection of live, scheduled, collection, and malformed cards.
- The `enableDisneyPlus` default and options-page reload query covering
  Disney+.

Run the affected unit and UI suites, then lint, format-check, build all targets,
and run the full test suite before implementation is considered complete.

## Documentation

Update the README to list Disney+ as a supported service and adjust
Netflix-only user-facing wording. Update the package description in
`package.json` and the store copy in `docs/store-description.txt` to name
Netflix, HBO Max, and Disney+. Add screenshots only when a representative
Disney+ capture is available.
