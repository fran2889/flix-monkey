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

## Setup

```bash
npm install
```

## Development Workflow

1. Edit source files in `src/`.
2. Run the build to generate distribution artifacts in `dist/`.
3. Run lint and format to ensure code quality.

### Build Scripts

| Command | Description |
|---|---|
| `npm run build` | Build all targets (userscript, firefox, chrome) |
| `npm run build:userscript` | Build only the userscript |
| `npm run build:firefox` | Build only the Firefox extension |
| `npm run build:chrome` | Build only the Chrome extension |
| `npm run lint` | Lint `src/` modules and legacy script |
| `npm run format` | Format with Prettier |

### Loading for Testing

- **Userscript**: Point your userscript manager at `dist/FlixMonkey.user.js`.
- **Firefox**: Load `dist/firefox/` as a temporary add-on in `about:debugging`.
- **Chrome**: Load `dist/chrome/` as an unpacked extension in `chrome://extensions`.

## Architecture

The project is structured into three main layers:

### 1. Core (`src/core/`)
Platform-agnostic business logic.

| Module | Responsibility |
|---|---|
| `app.js` | Main application class and `startApp` factory |
| `api-manager.js` | Orchestrates multiple API clients and handles fallbacks |
| `api-clients.js` | Client implementations for XMDB, OMDB, and IMDb API Dev |
| `cache.js` | Async cache manager with TTL logic |
| `disabled-clients.js` | Tracks failing API endpoints to avoid redundant requests |
| `request-queue.js` | Handles rate limiting and cross-tab synchronization |
| `overlay.js` | UI rendering of the rating badges |
| `surfaces.js` | DOM discovery logic for Netflix UI elements |
| `config.js` | Reactive configuration object |
| `config-fields.js` | Single source of truth for settings definitions |
| `title.js` | Pure data class representing a movie/show |
| `constants.js` | Shared constants and enumerations |

### 2. Platform (`src/platform/`)
Implementation of the `PlatformAdapter` interface.

| Module | Responsibility |
|---|---|
| `adapter.js` | Abstract base class defining the platform interface |
| `userscript.js` | Implementation using `GM_*` APIs |
| `webextension.js` | Implementation using `browser.*` APIs (via `webextension-polyfill`) |

### 3. Targets (`src/targets/`)
Entry points and platform-specific manifests.

- `userscript/`: `entry.js` (GM_config wiring)
- `extension/`: Shared extension logic (`content.js`, `options.html`, `options.js`)
- `firefox/`: Firefox manifest and `background.js` proxy
- `chrome/`: Chrome manifest and `service-worker.js` proxy

## Platform Adapter Interface

All platform-specific code must go through the `adapter` instance:

```js
class PlatformAdapter {
    async storageGet(key)
    async storageSet(key, value)
    async httpFetch(url, options)
    registerMenuCommand(label, fn)
}
```

## Code Style

- **ES modules**: Use `import`/`export` in all `src/` files.
- **Async/Await**: All storage and network operations are asynchronous.
- **Private Fields**: Use `#field` for class-private state.
- **Naming**: PascalCase for classes, camelCase for methods/variables.
- **Conventional Commits**: Strictly enforced for all changes.
- **Tooling Preference**: Prefer using IntelliJ IDEA MCP tools over standard text tools for file operations and codebase exploration.
- **Post-Task Protocol**: Always print the suggested commit message once the task is complete.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format.

**Allowed types:** `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `chore`.

## Pull Request Guidelines

- `npm run build` must pass.
- `npm run lint` and `npm run format` must pass.
- Logic changes should be accompanied by a version bump in `package.json`.
- The legacy `FlixMonkey.user.js` in the root is preserved for now but should not be the primary target of new features.

## Common Gotchas

- **CORS**: Extensions use a background proxy (`background.js` / `service-worker.js`) to bypass Netflix's CSP and CORS. Userscripts use `GM_xmlhttpRequest`.
- **Config Sync**: In extensions, `browser.storage.onChanged` is used to react to settings changes without page reloads.
- **Rate Limiting**: `RequestQueue` uses `fm_last_req` in storage to synchronize rate limits across multiple Netflix tabs.
