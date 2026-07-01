# AGENTS.md

This file is for AI agents. For human contributor guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Project Overview

**FlixMonkey** is a multi-target browser extension and userscript that overlays IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix thumbnails and banners. A shared ES module codebase in `src/` is bundled by Rollup into three distribution targets:

1. **Userscript**: Tampermonkey/Violentmonkey/Greasemonkey (`dist/FlixMonkey.user.js`)
2. **Firefox Extension**: MV3 WebExtension (`dist/firefox/`)
3. **Chrome Extension**: MV3 WebExtension (`dist/chrome/`)

The project uses a **Platform Adapter** pattern to abstract differences between `GM_*` (userscript) and `browser.*` (WebExtension) APIs.

- **Language**: JavaScript (ES2022), `"type": "module"` throughout
- **Runtime**: Node.js >= 24
- **Bundler**: Rollup
- **Linter**: ESLint (flat config, `eslint.config.js`)
- **Formatter**: Prettier
- **Test runner**: Vitest + jsdom + MSW
- **External APIs**: XMDB (`xmdbapi.com`), OMDB (`omdbapi.com`), IMDb API Dev (`api.imdbapi.dev`)

## Setup

```bash
npm install
```

Husky git hooks are installed automatically via the `prepare` script.

## Development & Build Workflow

1. Edit source files in `src/`.
2. Build: `npm run build`
3. Lint + format: `npm run lint && npm run format`
4. Test: `npm test`

### Build Scripts

| Command                    | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `npm run build`            | Build all three targets and run `scripts/package.js`           |
| `npm run build:userscript` | Build only the userscript                                      |
| `npm run build:firefox`    | Build Firefox extension and run `scripts/package.js`           |
| `npm run build:chrome`     | Build Chrome extension and run `scripts/package.js`            |
| `npm run dev`              | Watch mode: rebuild on file changes                            |
| `npm run lint`             | Lint `src/`, `tests/`, `scripts/`, and `*.config.*`            |
| `npm run lint:fix`         | Lint with auto-fix                                             |
| `npm run format`           | Format `src/`, `tests/` JS, `src/` HTML, root JSON/MD/YML/HTML |
| `npm run format:check`     | Check formatting without writing                               |
| `npm run audit`            | Run `npm audit` at high severity level                         |
| `npm run clean`            | Remove `dist/` and `coverage/`                                 |

### Developer Scripts

| Script                                | Description                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/capture-surface-fixtures.py` | Captures and anonymises Netflix surface DOM extracts from a live Chromium debug session. Requires Chromium running with `--remote-debugging-port=9222` and `www.netflix.com/browse` open. Writes `tests/fixtures/surfaces/*.html` and refreshes `tests/fixtures/netflix-*.html`. Run: `python3 scripts/capture-surface-fixtures.py`. No pip dependencies. |

### Build Notes

- `rollup.config.js` is the single build configuration. It reads `process.env.TARGET` (`userscript`, `firefox`, `chrome`) to select which configs to export.
- **Manifest injection**: `name`, `version`, `description`, and `icons` fields in `manifest.json` source files use placeholder strings (`__NAME__`, etc.) and are populated at build time from `package.json` by the `injectManifestMetadata` Rollup plugin.
- **Icon resizing**: `src/assets/icons/icon.png` is the single source icon; `sharp` resizes it to 16/32/48/128px at build time into `dist/<target>/icons/`.
- **Packaging**: `scripts/package.js` creates ZIP archives of the built extension directories for distribution.
- **Userscript**: Bundled as IIFE with a `==UserScript==` banner generated at build time. Non-ASCII characters are unicode-escaped. License headers are stripped from the output (they're already in the banner).

## Testing

### Test Suites

| Command                    | What it runs                          |
| -------------------------- | ------------------------------------- |
| `npm test`                 | `tests/unit/**` + `tests/ui/**`       |
| `npm run test:unit`        | `tests/unit/**`                       |
| `npm run test:ui`          | `tests/ui/**`                         |
| `npm run test:integration` | `tests/integration/**` (nightly only) |
| `npm run test:coverage`    | unit + ui with V8 coverage report     |
| `npx vitest -t "name"`     | Filter by test name                   |

### Test Environment

- **jsdom** is the global test environment (configured in `vitest.config.js`).
- **MSW** (`msw/node`) is used in `tests/setup.js` for HTTP mocking. The shared server instance (`server`) is exported from that file; individual test files import it to add handlers.
- **`@testing-library/jest-dom`** matchers are registered globally in `tests/setup.js`.
- **Coverage thresholds**: 90% lines and 90% functions (enforced by Vitest).

### Test Layout

```
tests/
  setup.js              # Global: MSW server lifecycle + jest-dom matchers
  fixtures/             # HTML snapshots of Netflix DOM states for UI tests
    netflix-browse.html
    netflix-hover.html
    netflix-modal.html
    netflix-search.html
  mocks/                # Shared mock factories
    adapter.js          # Mock PlatformAdapter
    chrome.js           # chrome.* API stubs
    logger.js           # Mock Logger
    platform.js         # Platform-level helpers
    userscript.js       # GM_* API stubs
    webextension.js     # browser.* API stubs
  unit/                 # Unit tests mirroring src/ structure
  ui/                   # DOM-level tests using fixture HTML files
  integration/
    setup.js              # Loads .env + fails if required API keys are missing
    api-clients.test.js
```

### Test Taxonomy

These rules determine where a test lives and what it asserts. Apply them to all new tests.

**Location rule (sole determinant):** A test lives in `tests/ui/` if it loads a Netflix HTML fixture from `tests/fixtures/`. It lives in `tests/unit/` if it does not.

**UI tests** (`tests/ui/`) assert two things against real Netflix fixture HTML:

- _Surface discovery_: `SurfaceManager.discover()` returns the expected surfaces (count, title, container, fadeable).
- _Injection_: overlay or style elements are created and attached to the surface container. Minimal content checks (e.g., the rating value appears in the overlay) are acceptable as injection sanity checks, not for testing rendering logic.

**Unit tests** (`tests/unit/`) assert:

- _OverlayRenderer rendering logic_: tooltip text, CSS string content, conditional sub-elements (🔍, N/A, RT/MC badges), pointer events, click propagation, config-driven output.
- _SurfaceManager edge cases_ that no fixture represents: empty or null titles, deduplication, `parentElement` fallback, `querySelectorAll` throwing.
- _UI component logic_ (`Modal`, `SettingsUI`, etc.) that does not depend on Netflix fixture HTML.

**No duplication across layers:** if a surface type's basic discovery is covered by a fixture test, unit tests do not repeat that case with synthetic HTML. If rendering logic is covered in unit, UI tests do not re-assert it.

**Fixture preference:** when adding a new surfaces or overlay test, check existing fixtures first. Use synthetic DOM only if no fixture represents the case.

**The deciding question for any new test:** does this assertion require Netflix HTML to be meaningful? If yes, it is a UI test. If it would pass equally against a synthetic `<div>`, it is a unit test.

### Integration Tests

Integration tests in `tests/integration/` make live HTTP requests to external
APIs. They run only via `npm run test:integration` (the dedicated
`vitest.integration.config.js`) and on the nightly `Nightly Integration`
workflow: never in per-PR CI. They require `XMDB_API_KEY` and `OMDB_API_KEY`
in the environment: locally via a `.env` file (loaded by
`tests/integration/setup.js` through `dotenv`), and in CI via repository Actions
secrets. If either key is missing the suite **fails fast** with a clear error
rather than skipping. Do not mock HTTP in integration tests.

## Architecture

### 1. Core (`src/core/`)

Platform-agnostic business logic. All modules are pure ES modules.

| Module                | Responsibility                                                           |
| --------------------- | ------------------------------------------------------------------------ |
| `app.js`              | Main `FlixMonkeyApp` class and `startApp` factory function               |
| `api-manager.js`      | Orchestrates API clients, handles provider selection and fallbacks       |
| `api-clients.js`      | Client implementations for XMDB, OMDB, and IMDb API Dev                  |
| `cache.js`            | Async cache with per-entry TTL logic backed by the platform adapter      |
| `disabled-clients.js` | Tracks failing API clients to avoid redundant requests (1-hour lockout)  |
| `request-queue.js`    | Rate limiting and cross-tab synchronization via `fm_last_req` in storage |
| `overlay.js`          | DOM rendering of rating badges on Netflix thumbnails and banners         |
| `surfaces.js`         | Netflix DOM discovery: locates thumbnails, banners, and modal elements   |
| `config-manager.js`   | Reactive configuration object; dispatches change events                  |
| `config-fields.js`    | Single source of truth for all settings definitions and defaults         |
| `logger.js`           | Centralized logging; honours the `debug` config flag                     |
| `utils.js`            | Shared helpers; defines `FlixMonkeyError`                                |
| `title.js`            | Pure data class representing a movie/show title                          |
| `constants.js`        | Shared constants: timing values, `ApiSource` enum, `RATE_LIMITS`         |

**`src/core/ui/`**: Shared UI components

| Module           | Responsibility                                        |
| ---------------- | ----------------------------------------------------- |
| `modal.js`       | Accessible modal dialog component                     |
| `settings-ui.js` | Settings panel built dynamically from `config-fields` |
| `styles.js`      | Shared CSS injected into the Netflix page             |

### 2. Platform (`src/platform/`)

Implementations of the `PlatformAdapter` abstract interface.

| Module            | Responsibility                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `adapter.js`      | Abstract base class; all methods throw `FlixMonkeyError` if not overridden                         |
| `userscript.js`   | `UserscriptAdapter`: implements all methods using `GM_*` APIs                                      |
| `webextension.js` | `WebExtensionAdapter`: implements all methods using `browser.*` APIs (via `webextension-polyfill`) |

### 3. Targets (`src/targets/`)

Entry points and platform-specific files.

**`src/targets/extension/`**: Shared between Firefox and Chrome

| File             | Role                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| `content.js`     | Content script entry point; bootstraps the app                                         |
| `options.js`     | Options page entry point                                                               |
| `options.html`   | Options page HTML (copied verbatim to `dist/<target>/`)                                |
| `fetch-proxy.js` | Background fetch handler shared by both Firefox and Chrome                             |
| `domains.js`     | Domain allowlist (`ALLOWED_DOMAINS`) and `validateDomain()` used by background scripts |

**`src/targets/firefox/`**:

- `manifest.json`: Firefox MV3 manifest (uses `"background": { "scripts": [...] }`)
- `background.js`: Background page that imports `fetch-proxy.js`

**`src/targets/chrome/`**:

- `manifest.json`: Chrome MV3 manifest (uses `"background": { "service_worker": ... }`)
- `service-worker.js`: Service worker that imports `fetch-proxy.js`

**`src/targets/userscript/`**:

- `entry.js`: Userscript entry; wires GM_config and starts the app

## Platform Adapter Interface

All platform-specific I/O must go through the `adapter` instance. All abstract methods throw `FlixMonkeyError` if the subclass does not implement them.

```js
class PlatformAdapter {
    // All abstract; must be implemented:
    async storageGet(key)           // Returns stored value or undefined
    async storageGetAll()           // Returns all key/value pairs as object
    async storageSet(key, value)    // Stores a single key/value
    async storageSetMany(obj)       // Stores multiple key/values atomically
    async storageDelete(key)        // Removes a key
    async storageGetKeys(prefix)    // Returns keys matching the given prefix
    async httpFetch(url, options)   // Makes an HTTP request via the platform mechanism
    configGet(key)                  // Synchronous config read (must be implemented)

    // Optional; no-op defaults provided:
    registerMenuCommand(label, fn)  // Registers a UI menu entry (userscript only)
    setConfigData(data)             // Pre-loads config data (WebExtensionAdapter overrides this)
}
```

## Settings (`config-fields.js`)

`CONFIG_FIELDS` is the single source of truth for all user-configurable settings. Each entry defines `key`, `label`, `type` (`text`, `checkbox`, `select`), `default`, `title`, and optionally a `validate` function. `CONFIG_DEFAULTS` is a derived object of `{ key: default }` pairs.

| Key                     | Type     | Default    | Description                                                    |
| ----------------------- | -------- | ---------- | -------------------------------------------------------------- |
| `apiClient`             | select   | `imdbapi`  | Primary API provider (`imdbapi`, `omdb`, `xmdb`)               |
| `xmdbApiKey`            | text     | `''`       | API key for XMDB (required if provider is `xmdb`)              |
| `omdbApiKey`            | text     | `''`       | API key for OMDB (required if provider is `omdb`)              |
| `overlayCorner`         | select   | `top-left` | Badge position on thumbnails                                   |
| `showRtRating`          | checkbox | `true`     | Show Rotten Tomatoes score                                     |
| `showMcRating`          | checkbox | `true`     | Show Metacritic score                                          |
| `cacheTtlRatedOldYear`  | text     | `'-1'`     | Cache TTL (days) for rated titles > 1 year old; `-1` = forever |
| `cacheTtlRatedNewYear`  | text     | `'30'`     | Cache TTL (days) for rated titles < 1 year old                 |
| `cacheTtlNoRating`      | text     | `'1'`      | Cache TTL (days) for unrated/not-found titles                  |
| `enableFadeUnderRating` | checkbox | `false`    | Fade thumbnails below the IMDb threshold                       |
| `fadeRatingThreshold`   | text     | `'6.0'`    | IMDb rating threshold for fading                               |
| `debug`                 | checkbox | `true`     | Enable verbose console logging                                 |

## Constants (`constants.js`)

| Export                    | Value / Type  | Notes                                                                |
| ------------------------- | ------------- | -------------------------------------------------------------------- |
| `DAYS_TO_MS`              | `86400000`    | Milliseconds per day                                                 |
| `DECORATION_DEBOUNCE_MS`  | `250`         | DOM observer debounce                                                |
| `INFLIGHT_TIMEOUT_MS`     | `30000`       | Max time to wait for in-flight request                               |
| `CLIENT_DISABLE_DURATION` | `3600000`     | How long a failing client is disabled (1 hr)                         |
| `DEFAULT_FETCH_TIMEOUT`   | `8000`        | HTTP request timeout                                                 |
| `ApiSource`               | frozen object | `{ XMDB, OMDB, IMDBAPI }`: canonical client names                    |
| `RATE_LIMITS`             | object        | Per-client minimum interval in ms: XMDB 1500, OMDB 250, IMDBAPI 4000 |
| `TOP_10_BADGE`            | string        | CSS class identifying Netflix Top-10 badge elements                  |

## Code Style & Conventions

- **ES modules**: `import`/`export` everywhere in `src/` and `tests/`.
- **Async/Await**: Mandatory for storage and network operations.
- **Private fields**: Use `#field` syntax for class-private state.
- **Naming**: PascalCase for classes, camelCase for methods/variables.
- **License headers**: Every file in `src/` and `tests/` must begin with the GPL-3.0 license block matching `LICENSE_HEADER.template`. ESLint (`eslint-plugin-headers`) enforces this: a missing or malformed header is a lint error.
- **Conventional Commits**: Enforced by `commitlint` via a Husky `commit-msg` hook. Format: `type(scope)?: description` (imperative mood). Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Pre-commit**: Husky runs `lint-staged` on staged files before every commit (Prettier + ESLint auto-fix).
- **Testing**: Business logic changes must add or update tests covering the new logic.
- **README**: Update if the change is user-facing or affects documented functionality.
- **Protocol**: Always print a suggested commit message at the end of a task.
- **Prose style**: Do not use em-dashes. Use a colon, a semicolon, or break the sentence in two.
- **Prose style**: Use the Oxford comma: "A, B, and C".

## Branches & Pull Requests

### Branch Naming

`type/kebab-case-slug`: `type` matches a Conventional Commits type (see above), slug is 2–4 words.

```
feat/add-metacritic-fallback
fix/cache-ttl-overflow
docs/update-readme-setup
test/expand-api-client-coverage
chore/npm-audit-fix-undici
```

### PR Titles

PRs are squash-merged. The title becomes the merge commit and is parsed by release-please. Use Conventional Commits format:

```
type(scope)?: description
```

- Imperative mood, lowercase, no trailing period.
- Include scope when targeting a specific module: `fix(cache): prevent TTL overflow on negative values`.

### PR Descriptions

Use imperative mood. Skip sections that don't apply:

```
## Summary
- <What this PR does, 1–3 bullets>

## Test Plan
- [x] <Automated: e.g., 335 unit tests pass, 5 integration tests pass, all targets build>
- [ ] <Manual: e.g., load extension, verify feature X is default, ratings appear on browse pages>
- [ ] <Manual: e.g., verify non-ASCII titles resolve correctly>

## Breaking Changes
- <Only if applicable: describe what breaks and migration steps>
```

**Test Plan rules**: use `[x]` for automated tests that have passed and `[ ]` for manual verification steps requiring human testing.

### Pre-submission Checklist

Run before opening a PR:

```bash
npm run build && npm test
```

## Git Hooks (Husky)

| Hook         | What it does                                                            |
| ------------ | ----------------------------------------------------------------------- |
| `pre-commit` | Runs `lint-staged`: Prettier + ESLint `--fix` on staged JS/JSON/MD/HTML |
| `commit-msg` | Runs `commitlint` to enforce Conventional Commits format                |

**Note**: `Generated by Mistral Vibe.` and `Co-Authored-By:` footers are automatically stripped from commit messages by a global git hook. Do not include these in commit messages.

## Common Gotchas

- **CORS/CSP**: The Netflix page blocks direct `fetch()` to external APIs. Extensions route API calls through a background page/service worker (`background.js` / `service-worker.js`) via `browser.runtime.sendMessage`. Userscripts use `GM_xmlhttpRequest` which bypasses CORS. All fetches must go through `adapter.httpFetch()`.
- **Domain allowlist**: `domains.js` defines `ALLOWED_DOMAINS`. Background scripts call `validateDomain()` before proxying any request. Adding a new API endpoint requires updating this list.
- **Config sync**: In extensions, `browser.storage.onChanged` pushes config changes to the content script without a page reload. Do not assume config values are static after init.
- **Rate limiting**: `RequestQueue` uses `fm_last_req` in storage to synchronize rate limits across multiple Netflix tabs. Per-client delays are defined in `RATE_LIMITS` in `constants.js`.
- **Manifest metadata**: `manifest.json` source files contain placeholder strings for `name`, `version`, and `description`. Do not hardcode these: they are injected from `package.json` at build time.
- **No `console.log` ban**: ESLint allows all `console.*` methods (debug, info, warn, error, log). Use `logger.js` for application logging, not raw `console` calls in `src/`.
- **No `configGet` default**: Unlike `registerMenuCommand` and `setConfigData`, `configGet` is fully abstract: it throws if not implemented. Every adapter must implement it.
- **Integration test credentials**: Tests in `tests/integration/` need real API keys (`XMDB_API_KEY`, `OMDB_API_KEY`) in the environment: a local `.env` or CI Actions secrets. Without them the suite fails fast (it does not skip). These tests run nightly, not in per-PR CI. Do not mock HTTP in integration tests.
