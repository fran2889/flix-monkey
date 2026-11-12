# Remove remaining unsafe type assertions and enable the rule

**Date:** 2026-11-12

**Status:** proposed

**Issue:** [#237](https://github.com/fran2889/flix-monkey/issues/237)

**Size:** project

## Intent

Finish the assertion cleanup started by #231 (API response parsing) and #232
(cache and storage validation). After this change, production code narrows
untrusted and loosely typed values with runtime checks instead of `as`, and
`@typescript-eslint/no-unsafe-type-assertion` runs as an error for `src/` so a
new narrowing assertion cannot slip back in.

## Context

With the rule enabled ad hoc, `src/` reports 43 findings in 15 files. They fall
into six groups:

- DOM narrowing: `Element` to `HTMLElement` in `app.ts`, `overlay.ts`,
  `ui/modal.ts`, `ui/overlay-elements.ts`, and the Disney+ and HBO Max surface
  definitions.
- Form element narrowing in `ui/settings-view.ts` (`HTMLInputElement`,
  `HTMLSelectElement`) and config lookup keys.
- Untrusted JSON shapes in `migrations.ts` and `id-override-manager.ts`.
- Function-type casts in `request-queue.ts`, `debounce`, and the
  `history.pushState` wrapper in `app.ts`.
- The error object narrowed by shape in `api-manager.ts`.
- `unknown` message payloads cast to `ExtensionMessage` in
  `targets/chrome/service-worker.ts` and `targets/firefox/background.ts`.

The API clients, cache entry, platform storage, and extension content target
are already clean from #231 and #232. `npm run type-check` and `npm run lint`
pass today. `tests/` reports about 240 findings under the same rule and is out
of scope for enforcement.

The surface layer is the reason the DOM casts spread into `app.ts`:
`DiscoveredSurface.container` and the resolver callbacks are typed as `Element`,
while the renderer and `app.ts` need `HTMLElement` APIs such as `dataset` and
`style`. The runtime objects are HTML elements, but the contract does not say
so.

## Goals

- Remove every `@typescript-eslint/no-unsafe-type-assertion` finding in `src/`.
- Enable the rule as an error in `eslint.config.js`, with an explicit `off`
  override for `tests/`.
- Make the surface contract say `HTMLElement` where the overlay code already
  requires it, and narrow once in `SurfaceManager.discover`.
- Replace untyped error handling with `instanceof` checks.
- Add or update tests where behavior at a boundary is now explicit: surface
  discovery, malformed extension messages, ID overrides, and config defaults.
- Keep `npm run type-check`, `npm run lint`, and `npm test` green.

## Non-goals

- No assertion cleanup in `tests/` as a general sweep. Only casts made
  redundant by the production type changes are removed.
- No change to the public web-extension messaging protocol or to fetch-proxy
  behavior for valid messages.
- No schema library and no new runtime dependency.
- No reordering or restructuring of untouched code.
- No user-facing behavior change for valid input.
- No disable comments for the new rule.

## Anti-goals

- Silently accepting a malformed extension message.
- Trading a cast for an unchecked generic that is just as unsafe, such as
  `querySelector<HTMLInputElement>` on an expression that could return another
  element type.
- Adding a runtime check that changes the data written to cache or storage.
- Treating a programmer error, such as a missing config default, as corrupt
  persisted data.
- Cleaning every test assertion in the same pull request.

## Constraints

- TypeScript `strict` and `exactOptionalPropertyTypes` are enabled.
- ESLint complexity is capped at 10 and `max-params` at 4.
- Exported declarations need JSDoc with `@param` and `@returns` where
  applicable.
- Every `{src,tests}/**/*.ts` file keeps its SPDX header.
- ASCII only, no em-dashes.
- `src/core/parse-utils.ts` is the shared home for reusable shape guards.
- The working tree has an unrelated `package.json` change (`allowScripts`);
  preserve it.
- No new dependencies.

## Approaches considered

1. **Narrow only where the cast is.** Keep `Element` in the surface contract and
   add an `instanceof HTMLElement` guard at every `app.ts` entry point. This is
   the smallest production diff and avoids touching test types, but it repeats
   the same guard, leaves the contract lying, and gives no free test cleanup.
   Rejected.
2. **Tighten the DOM contract, narrow locally elsewhere (chosen).** Change the
   surface definitions and `DiscoveredSurface.container` to `HTMLElement`, and
   narrow title elements once in `SurfaceManager.discover`. The `app.ts`,
   Disney+, HBO Max, and surface-test casts then disappear. Handle the remaining
   groups with local guards, concrete DOM element creation, `Map`-backed config
   lookups, and a shared message parser. This fixes the contract at the source
   and removes the most casts with the least repeated code.
3. **Clean `src/` and `tests/` together.** About 240 test findings, including
   32 partial class mocks and 67 synthetic `NodeList` and `MutationRecord`
   fixtures that need a shared test-helper design. This is a separate body of
   work and would bury the production review. Rejected.

## Decisions

### Rule configuration

Add `@typescript-eslint/no-unsafe-type-assertion: 'error'` to the shared
`typescriptRules` object, so it applies to every `.ts` file. Add an `off` entry
to the existing `tests/**/*.ts` relaxation block and update that block's
comment to name the rule. The rule is therefore enforced for production code
and deliberately relaxed for tests, rather than silently absent.

### Surface contract

- `src/types/surfaces.ts`: `getTitle`, `getContainer`, and `decorateContainer`
  take `HTMLElement`; `DiscoveredSurface.container` is `HTMLElement`.
- `src/core/surfaces/surface-manager.ts`: after
  `querySelectorAll(surface.titleSelector)`, skip non-`HTMLElement` title
  elements. Narrow the resolved container with `instanceof HTMLElement`, falling
  back to `titleEl.parentElement`. This is the only production place that has to
  know a surface is an HTML element.
- `containerFromClosest` returns `HTMLElement | undefined` through an
  `instanceof` check. `containerFromParent` returns
  `element.parentElement ?? undefined`, which is already `HTMLElement`.
- Surface definitions in `disney-plus-surfaces.ts` and
  `hbo-max-surfaces.ts` take `HTMLElement` parameters, so `dataset` is direct.
  The frozen pattern arrays keep their inferred `readonly RegExp[]` type; drop
  the `as RegExp[]` widening.
- `app.ts` takes `HTMLElement` in `#decorateContainer` and `#renderTitle`, and
  uses `querySelectorAll<HTMLElement>` for the `data-fm-key` lookups. Every
  former cast at those call sites disappears.

Skipping non-HTML title elements is a deliberate narrowing. The overlays rely
on `dataset`, `style`, and `classList`; no supported streaming service uses
SVG or MathML tiles.

### Other production changes

- **`app.ts` history wrapper:** type the saved originals as
  `(data: unknown, unused: string, url?: string | URL | null) => void`, assign
  `history.pushState` and `history.replaceState` directly, and call the original
  with `.call(history, ...)`.
- **`app.ts` mutation target:** add the target only when
  `m.target instanceof Element`.
- **`app.ts` client map:** type the map as
  `Record<ApiSourceType, new (_deps: ApiClientDeps) => BaseApiClient>` and add a
  small `isApiSource` predicate based on `Object.values(ApiSource).some(...)`.
  The fallback stays Agregarr.
- **`overlay.ts`:** export `OVERLAY_CORNERS`, `OverlayCorner`, and
  `isOverlayCorner` from `ui/overlay-styles.ts`, which already declares the
  union. Use the guard with the configured value and fall back to `top-left`.
- **`ui/modal.ts`:** use `querySelector<HTMLElement>` for the content and body
  elements, and narrow `document.activeElement` with `instanceof HTMLElement`.
- **`ui/overlay-elements.ts`:** guard `lastElementChild instanceof HTMLElement`
  before applying the rating color.
- **`ui/settings-view.ts`:** key `fieldsByGroup` by `GroupKey` in a `Map`, so
  `GROUPS[groupId]` is typed. Add an `isRowLabelKey` predicate for
  `ROW_LABELS`. Build `select` and `input` elements in separate branches so the
  concrete type is known, and return `HTMLInputElement | HTMLSelectElement`.
  In autosave, decide the event from `input instanceof HTMLInputElement` and
  `input.type`.
- **`config/config-fields.ts`:** add an `isCompleteSettingsMap` type predicate
  that checks every setting field key is present, use it to narrow
  `configDefaults` to `Record<SettingKey, ConfigValueType>`, and throw a module
  invariant error if a setting has no default. A missing default is a
  programming error, not untrusted data.
- **`migrations.ts`:** add a non-throwing `isRecord` guard to
  `src/core/parse-utils.ts` and use it for `entry.data`. `assertRecord` calls
  the same guard. Invalid data keeps the existing delete-and-continue path.
- **`id-override-manager.ts`:** reject a non-string stored value, parse JSON as
  `unknown`, require `isRecord`, and read `imdbId` with `optionalString`. A
  parse failure still returns `undefined`.
- **`request-queue.ts`:** store an erased `QueueItem` with
  `run: (_url: string) => Promise<void>` plus `reject`. `enqueue` creates a
  closure that resolves or rejects the caller's promise; `#dispatchNextRequest`
  awaits `run`. This removes the resolve and fetch-function casts without
  changing pacing, priority, or error propagation.
- **`utils/general-utils.ts`:** `DebouncedFunction` returns `void`, which is
  what the implementation has always done. The wrapper forwards `this` and the
  arguments and no longer needs an assertion.
- **`api-manager.ts`:** narrow the caught value with `instanceof
FlixMonkeyError` for `url`, `status`, and `body`, and use `instanceof Error`
  for the message. Other error types keep the existing warn path.
- **Extension targets:** add `src/targets/extension/messages.ts` with
  `parseExtensionMessage(value: unknown): ExtensionMessage | undefined` and a
  small options parser. It accepts `FM_RUN_MIGRATIONS`, or `FM_FETCH` with a
  string `url` and an optional plain-object `options`. When present,
  `responseType` must be `json` or `text`, and `timeout` must be a finite,
  non-negative number; absent fields are omitted from the rebuilt options so
  `exactOptionalPropertyTypes` stays satisfied. Unknown keys are ignored.
  Both targets call the parser and return their existing "ignore" value when it
  rejects the message. A message with a valid URL but malformed options is
  ignored instead of being fetched with defaults: malformed messages are never
  half-trusted. The target's caller then fails through its existing empty or
  missing response path.

    This is a deliberate call: rejecting the message keeps the "never
    half-trusted" rule, and `timeout` validation is required because existing
    service-worker and background tests assert that a custom timeout reaches
    `setTimeout`.

### Test changes

Only remove test casts that the production type changes make unnecessary:

- `tests/helpers/surface-tests.ts`: pass `surface.container` directly to
  `injectOverlay`; drop the `as unknown as HTMLElement`.
- `tests/ui/netflix.ui.test.ts`: same for `hasOverlay` and `injectOverlay`.
- `tests/unit/core/surfaces/surfaces.test.ts`: update resolver signatures to
  `HTMLElement`, return `element.parentElement ?? undefined`, and drop the
  container cast.
- `tests/unit/core/app.test.ts`: change the captured-container helper parameter
  to `HTMLElement`; callers already hold HTML elements.

No other test cast is rewritten. Class mocks, synthetic mutation records, and
`as unknown as` fixtures stay as they are because the rule remains off for
tests. A future issue can decide whether to adopt shared mock interfaces.

### New tests

- Surface discovery skips a non-HTML title element and still resolves HTML
  containers.
- `parseExtensionMessage` rejects a non-object, an unknown type, `FM_FETCH`
  without a string URL, non-object or array `options`, and invalid
  `responseType` or `timeout` values. It accepts both valid message shapes,
  preserves valid `responseType` and `timeout`, and ignores unknown option
  keys.
- `IdOverrideManager` ignores a boolean storage value and JSON that is not an
  object or has a non-string `imdbId`.
- `CONFIG_DEFAULTS` contains every setting key, and the guard rejects a map
  missing one.
- `RequestQueue` still resolves generic results, rejects failures, and rejects
  pending items on `clear()`.

## Verification

Run, in order, from the repository root:

1. `npm run type-check`
2. `npm run lint`
3. `npm test`
4. `npm run format:check`
5. `npm run build`

Also confirm `npx eslint "src/**/*.ts"` reports zero
`no-unsafe-type-assertion` findings and that no new disable comment exists. The
existing documented `max-params` disable in `app.ts` stays.

## Left to the builder

- Exact helper names and placement inside `parse-utils.ts` and
  `targets/extension/messages.ts`.
- Which test cases are covered at unit level versus through existing surface
  fixtures.
- Branch name and commit split, subject to the repository conventions.
