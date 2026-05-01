# AGENTS.md

## Project Overview

**FlixMonkey** is a single-file Tampermonkey/Violentmonkey/Greasemonkey userscript (`FlixMonkey.user.js`) that overlays IMDb ratings on Netflix thumbnails and banners. It fetches data from the [OMDB API](https://www.omdbapi.com/) and caches results locally using `GM_getValue`/`GM_setValue`.

- **Language**: JavaScript (ES2020, IIFE, `'use strict'`)
- **Target environment**: Browser userscript (not Node.js)
- **Userscript managers**: Tampermonkey, Violentmonkey, Greasemonkey
- **External API**: OMDB (`https://www.omdbapi.com/`)
- **Greasemonkey APIs used**: `GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue`
- **Dev tooling**: ESLint (flat config), Prettier
- **Package manager**: npm

There is **no build step** and **no test suite**. The entire script is `FlixMonkey.user.js`.

## Setup

```bash
npm install
```

This installs ESLint, Prettier, and their configs as dev dependencies.

## Development Workflow

All logic lives in the single self-contained IIFE inside `FlixMonkey.user.js`. To test changes:

1. Edit `FlixMonkey.user.js`.
2. Run lint and format (see below).
3. Reload the script in your browser extension dashboard and refresh Netflix.

**Reloading the script:**
- **Tampermonkey**: Enable *Settings → Allow access to file URLs*, point the script at the local file, or paste source into the dashboard editor and save.
- **Violentmonkey**: Use *Track local file* in the script editor.
- **Greasemonkey**: Re-install from the local file or edit via the dashboard.

Always refresh the Netflix tab after updating the script.

## Scripts

| Command | Description |
|---|---|
| `npm run lint` | Lint `FlixMonkey.user.js` with ESLint |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Prettier |

Always run `npm run lint` and `npm run format` before committing.

## Code Style

- **ESLint**: Flat config in `eslint.config.js`. Rules enforced: `prefer-const`, `no-var`, `eqeqeq`, `no-console` (warn, allowing `console.warn`/`console.error`).
- **Prettier**: Default config (120-char line width implied by the README).
- **Globals**: Browser globals plus `GM_xmlhttpRequest`, `GM_getValue`, `GM_setValue` are declared in `eslint.config.js` — do not use `var` or add new undeclared globals.
- Use `const`/`let` only; never `var`.
- All async work via `async/await`; network calls wrapped in `gmFetch()` (returns a `Promise`).

## Architecture

The script is structured as a single IIFE with clearly labelled sections (comments separate them):

| Section | Purpose |
|---|---|
| `CONFIG` | User-facing options: `omdbApiKey`, `overlayCorner`, cache TTLs |
| Cache helpers | `cacheKey`, `readCache`, `writeCache` – thin wrappers around `GM_getValue`/`GM_setValue` |
| OMDB API | `gmFetch` (Promise wrapper), `fetchOmdb`, `getOmdbData` (cache-aware) |
| Overlay rendering | CSS injection, `createOverlay`, `ensureRelative`, `injectOverlay` |
| Surface discovery | `SURFACES` config array + `discoverSurfaces` – maps Netflix DOM surfaces to title strings |
| Core decoration | `decorateContainer`, `decorateRoot` – ties discovery → API → overlay |
| SPA navigation | Patches `history.pushState`/`replaceState`, listens for `popstate`, runs `MutationObserver` |

### Adding a new Netflix UI surface

Add an entry to the `SURFACES` array in the *Surface discovery* section:

```js
{
    titleSelectors: 'css-selector-for-title-element',
    getTitle: el => el.getAttribute('alt')?.trim() || el.textContent?.trim() || null,
    containerSel: '.container-to-attach-overlay',
}
```

`discoverSurfaces` will pick it up automatically on the next DOM scan.

### Cache keys

Cache entries are stored with keys prefixed `fm_cache_`. The key format is:
```
fm_cache_<lowercase_title_underscored>[_<year>]
```

## Configuration

All user-facing options are in the `CONFIG` object at the top of `FlixMonkey.user.js`:

| Option | Default | Description |
|---|---|---|
| `omdbApiKey` | `'YOUR_OMDB_API_KEY'` | OMDB API key — **required**, never commit a real key |
| `overlayCorner` | `'top-left'` | Badge position: `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| `cacheTtlRated` | 7 days (ms) | Cache TTL for titles with a rating |
| `cacheTtlNoRating` | 24 h (ms) | Cache TTL for titles found but with no rating |

> **Security**: Never commit a real OMDB API key. The placeholder `'YOUR_OMDB_API_KEY'` is the expected value in source control.

## Pull Request Guidelines

- Run `npm run lint` and `npm run format` — both must pass before merging.
- Keep the single-file structure; do not split into modules (userscript managers load one file).
- Bump the `@version` header in `FlixMonkey.user.js` and `package.json` together.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Allowed types:**

| Type | When to use |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvement |
| `style` | Formatting only (no logic change) |
| `docs` | Documentation changes only |
| `chore` | Tooling, config, dependencies |

**Examples:**

```
feat: add rating overlay for hover zoom (bob) surface
fix: correct badge position on Top 10 cards for left-side corners
refactor: replace seenTitleEls with single container-based deduplication
docs: add AGENTS.md with architecture and workflow notes
```

- Use the imperative mood in the description ("add", not "added" or "adds").
- Keep the description under 72 characters.
- Reference issues or PRs in the footer where applicable: `Closes #12`.
- After every code change, output a suggested conventional commit message for the change.

## Common Gotchas

- **`sourceType: 'script'`** is set in ESLint config because the IIFE is not an ES module — do not add `import`/`export` statements.
- **`GM_*` globals** must remain listed in `eslint.config.js` if new Greasemonkey APIs are added.
- Netflix is a SPA — DOM elements appear and disappear dynamically. The `MutationObserver` and patched `history` methods handle this, but changes to Netflix's DOM structure may require updating `SURFACES` selectors.
- OMDB "not found" results (`Response === 'False'`) are intentionally **not cached** so a future lookup can succeed if the title is later added to OMDB.
- The `inFlight` map deduplicates concurrent API calls for the same title key — preserve this when modifying the fetch path.

