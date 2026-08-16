# Clean Code UI Refactor Design

## Goal

Refactor the settings, overlay, application orchestration, and surface-discovery code so methods remain reasonably short, responsibilities are explicit, and every class follows lifecycle or first-use order. Preserve all public APIs and observable behavior.

## Scope

The refactor addresses five related maintainability problems:

1. `SettingsUI` performs too much DOM construction directly.
2. Settings values are queried repeatedly during validation and saving.
3. `FlixMonkeyApp.#decorateContainer()` mixes request, fade-state, rendering, and cleanup responsibilities.
4. `OverlayRenderer` combines CSS generation, element construction, and DOM injection.
5. Class and service-definition order is inconsistent with lifecycle and first-use reading.

The settings and overlay unit tests will be split to mirror the new production module boundaries. The refactor will not change settings, storage formats, CSS behavior, network behavior, extension messaging, public method signatures, or user-facing text.

## Production Module Design

### Settings controller

`src/core/ui/settings-ui.js` remains the public settings controller. It will own dependencies and coordinate these workflows:

- Load stored settings and render the view.
- Capture one form-value snapshot during save.
- Validate that snapshot before persistence.
- Persist valid values and invoke `onSave`.
- Clear cached ratings.
- Reset disabled providers.

The controller will not construct individual labels, fields, groups, buttons, or status elements.

### Settings view

Create `src/core/ui/settings-view.js` to own settings-page presentation and form access. It will receive field definitions and callbacks rather than storage or manager dependencies. Its responsibilities are:

- Group configured fields for display.
- Build section headers, rows, regular fields, rating controls, service controls, actions, and the status element.
- Read all configured values from its container exactly once per requested snapshot.
- Validate a supplied snapshot and update field error classes.
- Display success and error status messages.
- Enable or disable the save action.

The view will preserve container-scoped queries and the existing element IDs, names, classes, labels, titles, field order, defaults, and stored-value handling.

### Overlay renderer

`src/core/overlay.js` remains the public DOM lifecycle controller. It will own:

- Injecting or updating overlay styles.
- Adding, replacing, and removing loading and completed overlays.
- Maintaining the injected marker attribute.
- Ensuring relative container positioning.
- Applying fade classes.

It will delegate CSS generation and element construction to focused modules.

### Overlay elements

Create `src/core/ui/overlay-elements.js` for overlay element construction. It will build:

- Generic badges.
- Rating, missing-rating, and search badges.
- IMDb links and tooltips.
- Optional Rotten Tomatoes and Metacritic badges.
- Loading overlays.
- Fade-toggle controls.
- Completed overlay containers.

The module will receive configuration decisions and callbacks as explicit arguments. It will not read application configuration or mutate a target surface container. Rating formatting, vote formatting, tooltip construction, and rating-color calculation will live beside the element construction that consumes them.

### Overlay styles

Create `src/core/ui/overlay-styles.js` with a pure `buildOverlayStyles()` export. Inputs will include the overlay class, selected corner, Top 10 selectors, and Top 10 offset. The function will return the complete CSS string without reading the DOM or application configuration.

`OverlayRenderer.injectStyles()` will read configuration, call the builder, and update or create the style element.

### Application orchestration

Refactor `FlixMonkeyApp.#decorateContainer()` into a short workflow. Focused private helpers will own:

- Reading the applicable fade override.
- Returning an existing in-flight title request or creating a new timed request.
- Rendering resolved title data, including fade state, dataset keys, and fade-toggle callbacks.

The loading overlay will still be painted before storage access, requests will still be deduplicated by slug, in-flight entries will still be removed after settlement, removed containers will not be rendered, and loading overlays will always be cleaned up.

### Surface organization

Reorder `src/core/surfaces.js` into consistent service sections. Each section will keep its parsing constants and helpers, surface definitions, and surface-manager class together. Shared surface contracts and `SurfaceManager` remain before service-specific sections.

## Class Ordering Rule

Apply lifecycle and first-use ordering to every class in `src/`. Do not group methods solely by visibility.

Use this order where applicable:

1. Fields.
2. Constructor.
3. Primary lifecycle entry point or primary operation.
4. Helpers in the order first encountered by that operation.
5. Secondary workflows and their helpers.
6. Teardown.
7. Accessors that are not part of the primary flow.

For abstract contracts, adapters, immutable data classes, and other classes without a lifecycle, use semantic consumption order. For example, storage adapters will follow the interface contract order, while data classes will place construction, derived properties, transformations, factories, and normalization helpers in reading order.

Reordering must not change method bodies unless needed by one of the four responsibility refactors above.

## Test Layout

Split the existing settings and overlay tests without duplicating assertions:

- `tests/unit/core/ui/settings-ui.test.js`: controller orchestration, persistence, callbacks, cache clearing, and provider reset.
- `tests/unit/core/ui/settings-view.test.js`: field grouping, DOM construction, defaults and stored values, value snapshots, validation presentation, actions, and status output.
- `tests/unit/core/overlay.test.js`: renderer injection, removal, positioning, injected markers, and fade application.
- `tests/unit/core/ui/overlay-elements.test.js`: badges, IMDb links, tooltips, rating formatting and colors, optional ratings, loading elements, event propagation, and fade toggles.
- `tests/unit/core/ui/overlay-styles.test.js`: corner placement, flex direction, Top 10 selectors and offsets, and stable base style output.

Existing app and surface tests remain in place. Tests moved to new files will retain their behavioral assertions and use the same synthetic DOM because they do not depend on Netflix fixtures. Every new JavaScript test and source file will include the required GPL-3.0 license header.

## Test-Driven Refactoring Strategy

Before moving production behavior, create the destination test file with an assertion against the intended new module boundary and run it to observe the expected missing-module or missing-export failure. Add the smallest production boundary needed to pass, then move the remaining existing assertions by responsibility. Run the focused source and destination suites after each extraction.

Pure reordering does not require new behavioral assertions. Existing tests must pass before and after each reordering batch.

## Error Handling and Compatibility

Storage and manager failures will continue to propagate or display status exactly as they do now. The refactor will preserve optional `onSave` behavior, button re-enablement in `finally`, container-scoped DOM access, click propagation handling, and current configuration defaults.

No production exports currently consumed outside their modules will be removed or renamed. New UI helper exports are internal project boundaries and will be covered directly by unit tests.

## Verification

Run focused tests throughout the refactor, followed by:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

As a clean-code diagnostic, also run ESLint with a 50-line function threshold and a complexity threshold of 10. Any remaining warning in the refactored settings, overlay, or app workflows must be reviewed and either removed or explicitly justified.

## Out of Scope

- User-facing functionality changes.
- New configuration fields.
- Changes to cache, API, platform-adapter, or migration contracts.
- Broad conversion of existing functions into classes.
- Generic component frameworks or reusable DOM factory abstractions beyond the settings and overlay boundaries.
