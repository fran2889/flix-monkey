# ESLint size guardrails: parameter count and complexity

Status: draft for approval. Date: 2026-10-24.

## Intent

Continue the lint and TypeScript hardening by adding the two size limits the config is
missing, and tightening the one it has:

- `max-params` does not exist. Functions may take any number of parameters.
- Cognitive complexity is not measured at all.
- Cyclomatic `complexity` is `16`, which is loose enough that the worst function in
  the tree (14) passes.

Measured on 2026-10-24 against `main`:

| Metric | Worst value | Sites over the chosen limit |
| --- | --- | --- |
| Parameters | 7 (`BaseApiClient`, `FlixMonkeyApp`, `injectOverlay`) | 8, all in `src/` |
| Cognitive complexity | 21 (`SettingsView.#createFieldValueContainer`) | 9 in `src/`, 0 in tests |
| Cyclomatic complexity | 14 (`SettingsView.#createFieldLabel`) | 7 in `src/`, 1 in tests |

The goal is a durable guardrail: the rules should catch real size problems and stay
quiet on code that is simply wide by nature.

## Goals

- `max-params: 4` for `src/` and `tests/`, and for `scripts/` and config files where it
  costs nothing.
- `sonarjs/cognitive-complexity: 10` for `src/` and `tests/`.
- Cyclomatic `complexity: 10` for the same files, so the three limits tell one story.
- Refactor every newly flagged function outside the documented exclusion.
- Behavior stays identical. Existing tests pass unchanged apart from call-site updates
  for changed signatures.

## Non-goals

- Splitting `FlixMonkeyApp`. It is the wiring point, `startApp()` is its only caller, and
  a dependency object there would add indirection without removing any.
- Refactoring `src/core/migrations.ts`.
- Changing coverage thresholds, test layout, or the integration suite.
- Touching `scripts/` beyond confirming it still passes.

## Anti-goals

A change that technically satisfies the linter but fails any of these is the wrong answer:

- Parameter objects wrapped around values that are naturally 3 or 4 arguments.
- Disable comments spread across the codebase.
- Any behavior change in overlay rendering or the settings UI.
- Effort spent refactoring code that is scheduled for deletion.
- A file-wide rule override where a one-line exception is enough.

## Constraints

- CI gates: type-check, lint and audit, build, test-unit, test-ui, test-coverage.
- `AGENTS.md`: do not enable a rule and then add broad disable comments. Either fix the
  code or scope the rule with a documented reason.
- `linterOptions.reportUnusedDisableDirectives` is `error`, so a stale exception fails
  the build.
- Conventional Commits, Prettier, ASCII, Oxford comma, no em-dashes.

## Decisions made upstream

These were decided in conversation and are not open:

1. Parameter limit is **4**, not 3. At 3 the extra 18 findings are mostly fine
   (`rgbToHsl(r, g, b)`, `RequestQueue(adapter, interval, key)`) and two are the
   platform-mandated Chrome `onMessage` callback and an interface signature.
2. Both complexity limits are **10**, applied to `src/` and `tests/`.
3. `src/core/migrations.ts` is excluded from both complexity rules until the cache
   migration framework is replaced by a cache schema version.
4. `FlixMonkeyApp` keeps its seven-parameter constructor. One caller, pure wiring.

## Decisions made by the builder (check these while reading)

- **Two rules for parameters.** `max-params` (core) applies to JS, and
  `@typescript-eslint/max-params` applies to TS with the core rule off in that block. This
  mirrors how the config already splits `no-unused-vars` and `unused-imports/no-unused-vars`.
- **`eslint-plugin-sonarjs`** is the cognitive-complexity implementation. Only
  `sonarjs/cognitive-complexity` is enabled; no other sonarjs rules. Version 4.2.2 was
  verified against ESLint 10 in a scratch project.
- **`ApiClientDeps`.** One exported interface in `src/core/api/base-api-client.ts` holding
  `adapter`, `config`, `disabledManager`, `logger`, `overrideManager`. `BaseApiClient` takes
  `(deps, queue, source)` (3). Each subclass takes `(deps)` (1) and builds its own
  `RequestQueue` from `PROVIDER_RATE_LIMITS`. `createApiClient(deps)` takes 1.
- **`injectOverlay`** takes `(container, titleObj, interaction)` (3), where `interaction` is
  a `Pick` of the existing `OverlayOptions` for `displayTitle`, `onEditClick`,
  `onRefreshClick`, `fadeToggleState`, and `onFadeToggleClick`. The method already builds
  that object internally to call `createOverlayElement`, so this removes pass-through, not
  adds a bag.
- **`SettingsUI`** takes `(deps, fields = CONFIG_FIELDS)` (2). `deps` holds `adapter`,
  `logger`, `cacheManager`, `disabledClientsManager`. `fields` stays a separate second
  argument because it is a test seam, not a dependency.
- **`FlixMonkeyApp`** gets one inline disable with a reason, not a file-wide override.
  `reportUnusedDisableDirectives` keeps it honest if the constructor later shrinks.
- **Two PRs**, config plus fixes in each so CI is green on both:
  `refactor/lint-max-params` and `refactor/lint-complexity`.

## Inventory

### `max-params: 4` (8 sites, all `src/`)

| Site | Params | Fix |
| --- | --- | --- |
| `core/api/base-api-client.ts:50` | 7 | `(deps, queue, source)` |
| `core/api/agregarr-api-client.ts:31` | 5 | `(deps)` |
| `core/api/omdb-api-client.ts:60` | 5 | `(deps)` |
| `core/api/xmdb-api-client.ts:29` | 5 | `(deps)` |
| `core/app.ts:371` `createApiClient` | 5 | `(deps)` |
| `core/app.ts:57` `FlixMonkeyApp` | 7 | inline disable |
| `core/overlay.ts:105` `injectOverlay` | 7 | `(container, title, interaction)` |
| `core/ui/settings-ui.ts:31` `SettingsUI` | 5 | `(deps, fields?)` |

`CacheEntry`, `FlixMonkeyError`, `ApiClientManager`, and `#decorateContainer` sit at
exactly 4 and are left alone. Call sites to update: `startApp()` in `app.ts`, both
`SettingsUI` constructions (`targets/extension/options.ts`, `targets/userscript/entry.ts`),
the `injectOverlay` calls in `app.ts`, `tests/helpers/surface-tests.ts`, and
`tests/unit/core/overlay.test.ts`, and the constructors invoked from tests.

### Cognitive complexity 10 (9 sites) and cyclomatic 10 (7 sites)

Excluded: `src/core/migrations.ts` (`21`, `67`, `160`, `207` cognitive; `21`, `67`, `207`
cyclomatic).

| Site | Cognitive | Cyclomatic | Fix |
| --- | --- | --- | --- |
| `core/ui/settings-view.ts:199` `#createFieldValueContainer` | 21 | 11 | Extract action-row, checkbox-group, and setting-row renderers |
| `core/ui/settings-view.ts:164` `#createFieldLabel` | 12 | 14 | Extract linked-label and plain-label variants |
| `core/ui/settings-view.ts:365` `readValues` | 11 | - | Extract per-field input read |
| `core/ui/settings-view.ts:388` `validate` | 12 | - | Extract per-field validation and error toggle |
| `core/surfaces/surface-definitions/hbo-max-surfaces.ts:37` | 11 | 13 | Extract first-pattern match and tile-kind check |
| `core/api/xmdb-api-client.ts:104` `getDetails` | 6 | 11 | Extract response-to-`Title` mapping |
| `tests/mocks/title.ts:129` `fromCacheJSON` | - | 12 | Delete: no caller in the suite |

`buildTitle.fromCacheJSON` in `tests/mocks/title.ts` has no callers; the suite uses
`Title.fromCacheJSON` directly. Deleting it removes the only complexity finding under
`tests/` and is smaller than refactoring it.

## Config shape

```js
const commonRules = {
    // ...
    complexity: ['error', 10],
    'max-params': ['error', 4],
    'sonarjs/cognitive-complexity': ['error', 10],
};

const typescriptRules = {
    ...commonRules,
    'max-params': 'off',
    '@typescript-eslint/max-params': ['error', { max: 4 }],
    // ...
};
```

Both the JS and TS config blocks register the `sonarjs` plugin. The exclusion is its own
block after them, with a comment naming this document and the reason:

```js
{
    // Cache migrations are scheduled for replacement by a cache schema version.
    // See docs/superpowers/specs/2026-10-24-eslint-complexity-guardrails-design.md.
    files: ['src/core/migrations.ts'],
    plugins: { sonarjs },
    rules: { complexity: 'off', 'sonarjs/cognitive-complexity': 'off' },
}
```

`eslint-plugin-sonarjs` is added to `devDependencies`.

## Documentation

- `AGENTS.md`: state the three limits in Conventions, and the single sanctioned
  `max-params` exception at the app root.
- This design document records the chosen values and the exclusion. No other tracking
  file is referenced.
- No README change: nothing here is user-facing.

## Verification

```bash
npm run type-check
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
```

Each PR additionally asserts that its new rule reports zero findings outside the
documented exception.

## Risks

- The settings-view refactor is the largest behavioral risk. Its unit and UI tests must
  pass unchanged; no test edits are expected there.
- `injectOverlay` and the `SettingsUI` constructors are touched by tests, so a signature
  slip shows up as a type error, which is desired.
- Sonarjs adds a dependency whose rules change between majors. Only one rule is enabled,
  and the version is pinned by the lockfile.
- `migrations.ts` can drift in complexity until the cache schema version replaces the
  framework. The exclusion comment names the reason and the condition for removal.

## Left to the builder

- Exact helper names and extraction boundaries for the seven refactors, as long as each
  falls under both limits and behavior is unchanged.
- Whether the settings-view extractions become private methods or module-level functions.
- Commit sequencing inside each PR.
