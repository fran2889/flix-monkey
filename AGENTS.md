# AGENTS.md

## Project Overview

**FlixMonkey** is a multi-target extension that overlays IMDb, Rotten Tomatoes, and Metacritic ratings on Netflix thumbnails and banners. It is built from a shared ES module codebase into three distribution targets:

1. **Userscript**: Tampermonkey/Violentmonkey/Greasemonkey (`dist/FlixMonkey.user.js`)
2. **Firefox Extension**: MV3 WebExtension (`dist/firefox/`)
3. **Chrome Extension**: MV3 WebExtension (`dist/chrome/`)

The project uses a **Platform Adapter** pattern to abstract differences between `GM_*` and `browser.*` APIs.

- **Language**: JavaScript (ES2022)
- **Architecture**: Modular ES modules in `src/`, bundled with Rollup
- **External APIs**: XMDB (`xmdbapi.com`), OMDB (`omdbapi.com`), IMDb API Dev (`api.imdbapi.dev`)
- **Dev tooling**: Rollup, ESLint (flat config), Prettier
- **Package manager**: npm

## Setup Commands

```bash
npm install
```

## Development & Build Workflow

1. Edit source files in `src/`.
2. Build artifacts: `npm run build`
3. Run lint/format: `npm run lint && npm run format`
4. Run tests: `npm test` (or use `vitest` directly for targeted runs).

### Build Scripts

| Command                    | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `npm run build`            | Build all targets (userscript, firefox, chrome)       |
| `npm run build:userscript` | Build only the userscript                             |
| `npm run build:firefox`    | Build only the Firefox extension                      |
| `npm run build:chrome`     | Build only the Chrome extension                       |
| `npm run dev`              | Watch mode — rebuild on file changes                  |
| `npm run lint`             | Lint `src/`, `tests/`, `scripts/`, and config files   |
| `npm run lint:fix`         | Lint with auto-fix                                    |
| `npm run format`           | Format all JS, HTML, JSON, and Markdown with Prettier |
| `npm run format:check`     | Check formatting without writing                      |
| `npm run clean`            | Remove `dist/` and `coverage/`                        |

### Testing Instructions

- **All suites**: `npm test`
- **By category**: `npm run test:unit`, `npm run test:ui`, `npm run test:integration`
- **With coverage**: `npm run test:coverage`
- **Filtering by name**: `npx vitest -t "test name"`
- **Fixtures**: UI tests use `tests/fixtures/*.html` to mock Netflix DOM states.
- **Mocks**: Shared mock helpers live in `tests/mocks/` (adapter, logger, platform, browser APIs).

## Architecture

The project is structured into three main layers:

### 1. Core (`src/core/`)

Platform-agnostic business logic.

| Module                | Responsibility                                           |
| --------------------- | -------------------------------------------------------- |
| `app.js`              | Main application class and `startApp` factory            |
| `api-manager.js`      | Orchestrates multiple API clients and handles fallbacks  |
| `api-clients.js`      | Client implementations for XMDB, OMDB, and IMDb API Dev  |
| `cache.js`            | Async cache manager with TTL logic                       |
| `disabled-clients.js` | Tracks failing API endpoints to avoid redundant requests |
| `request-queue.js`    | Handles rate limiting and cross-tab synchronization      |
| `overlay.js`          | UI rendering of the rating badges                        |
| `surfaces.js`         | DOM discovery logic for Netflix UI elements              |
| `config-manager.js`   | Reactive configuration object                            |
| `config-fields.js`    | Single source of truth for settings definitions          |
| `logger.js`           | Centralized logging utility                              |
| `utils.js`            | Shared helper functions                                  |
| `title.js`            | Pure data class representing a movie/show                |
| `constants.js`        | Shared constants and enumerations                        |

**`src/core/ui/`** — Shared UI components used across targets:

| Module           | Responsibility                                        |
| ---------------- | ----------------------------------------------------- |
| `modal.js`       | Accessible modal dialog component                     |
| `settings-ui.js` | Settings panel built from `config-fields` definitions |
| `styles.js`      | Shared CSS injected into the page                     |

### 2. Platform (`src/platform/`)

Implementation of the `PlatformAdapter` interface.

| Module            | Responsibility                                                      |
| ----------------- | ------------------------------------------------------------------- |
| `adapter.js`      | Abstract base class defining the platform interface                 |
| `userscript.js`   | Implementation using `GM_*` APIs                                    |
| `webextension.js` | Implementation using `browser.*` APIs (via `webextension-polyfill`) |

### 3. Targets (`src/targets/`)

Entry points and platform-specific manifests.

- `userscript/`: `entry.js` (GM_config wiring)
- `extension/`: Shared extension logic — `content.js`, `options.html`, `options.js`, `domains.js` (allowlist + URL validation), `fetch-proxy.js` (background fetch handler used by both Firefox and Chrome)
- `firefox/`: Firefox manifest and `background.js` proxy
- `chrome/`: Chrome manifest and `service-worker.js` proxy

## Platform Adapter Interface

All platform-specific code must go through the `adapter` instance:

```js
class PlatformAdapter {
    async storageGet(key)
    async storageGetAll()
    async storageSet(key, value)
    async storageSetMany(obj)
    async storageDelete(key)
    async storageGetKeys(prefix)
    async httpFetch(url, options)
    configGet(key)
    registerMenuCommand(label, fn)  // no-op default; override if platform supports it
    setConfigData(data)             // no-op default; WebExtensionAdapter overrides to pre-load config
}
```

## Code Style & Conventions

- **ES modules**: Use `import`/`export` in all `src/` files.
- **Async/Await**: Mandatory for storage/network operations.
- **Private Fields**: Use `#field` for class-private state.
- **Naming**: PascalCase for classes, camelCase for methods/variables.
- **Conventional Commits**: Strictly enforced. Use `type(scope)?: description` (imperative mood). Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Testing**: Business logic changes must add or update test validating the new logic, unless trivial.
- **Documentation**: README must be updated if the change is user-facing or affects a documented functionality.
- **IntelliJ MCP**: Prefer IntelliJ IDEA tools for refactoring and navigation.
- **Protocol**: Always print a suggested commit message at the end of a task.

## Common Gotchas

- **CORS**: Extensions use a background proxy (`background.js` / `service-worker.js`) to bypass Netflix's CSP and CORS. Userscripts use `GM_xmlhttpRequest`.
- **Config Sync**: In extensions, `browser.storage.onChanged` is used to react to settings changes without page reloads.
- **Rate Limiting**: `RequestQueue` uses `fm_last_req` in storage to synchronize rate limits across multiple Netflix tabs.
