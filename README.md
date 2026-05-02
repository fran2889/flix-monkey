# FlixMonkey

A multi-platform browser extension and userscript that overlays IMDb, Rotten Tomatoes, and Metacritic ratings on Netflix thumbnails, hover cards, preview modals, and the hero billboard.

## Overview

FlixMonkey enriches your Netflix browsing experience by displaying aggregated ratings from multiple sources. It fetches data from independent APIs (IMDb API, XMDB, and OMDB) with automatic fallback, caches results locally for fast subsequent lookups, and intelligently deduplicates concurrent requests for the same title.

The project is available as a **Chrome Extension**, **Firefox Add-on**, and a **Tampermonkey/Violentmonkey Userscript**. All versions share a common core and provide a feature-equivalent experience.

**Zero API keys needed to start.** By default, it uses the free IMDb API. Optional keys for OMDB and XMDB unlock Rotten Tomatoes and Metacritic scores.

---

## Installation

### Userscript (Tampermonkey / Violentmonkey)

Compatible with all major userscript managers. This is the easiest way to get started.

1. Install [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [Greasemonkey](https://www.greasespot.net/).
2. Visit the [raw script file](https://raw.githubusercontent.com/fran/FlixMonkey/main/FlixMonkey.user.js) to trigger installation.
3. Confirm the installation and refresh Netflix. Rating badges should appear immediately.

### Browser Extension (Chrome & Firefox)

The browser extensions provide a more seamless integration and better performance by using background processes for network requests.

1. **Chrome / Edge**:
   - Download the latest [Chrome release](https://github.com/fran/FlixMonkey/releases) (or build from source).
   - Go to `chrome://extensions/` and enable **Developer mode**.
   - Click **Load unpacked** and select the `dist/chrome` folder.
2. **Firefox**:
   - Download the latest [Firefox release](https://github.com/fran/FlixMonkey/releases) (or build from source).
   - Go to `about:debugging#/runtime/this-firefox`.
   - Click **Load Temporary Add-on...** and select `dist/firefox/manifest.json`.

---

## Features

### Rating Badges
Displays a compact badge in your chosen corner on:
- Browse grid thumbnails
- Hover zoom cards
- Preview modals
- Hero banner images

### Supported Scores
- **IMDb** rating (0.0–10.0)
- **Rotten Tomatoes** score (0–100, requires OMDB key)
- **Metacritic** score (0–100, requires OMDB key)

### Interactive Badges
| Badge State | Appearance | Action |
|---|---|---|
| **Found & Rated** | `IMDb 8.3` | Click to open the IMDb title page |
| **Found, No Rating** | `IMDb N/A` | Click to open the IMDb title page |
| **Not Found on IMDb** | `IMDb 🔍` | Click to search for the title on IMDb |

### Smart Technology
- **Caching**: Local storage caching with intelligent TTLs based on release year.
- **Deduplication**: Only one API call per title, even if it appears multiple times on the page.
- **Auto-Disable**: Slow or failing APIs are temporarily disabled for 1 hour to prevent UI lag.

---

## Configuration

Access settings to customize your experience:
- **Extensions**: Click the FlixMonkey icon in your browser toolbar and select **Options**.
- **Userscript**: Right-click the userscript manager icon on Netflix and select **FlixMonkey Settings**.

### Key Settings
| Option | Default | Description |
|---|---|---|
| **Overlay Position** | `top-left` | Corner where the rating badge appears. |
| **API Fallback Order** | `imdbapi,xmdb,omdb` | Order in which APIs are queried. |
| **OMDB API Key** | `Optional` | Provides RT/Metacritic scores. [Get a free key here](https://www.omdbapi.com/apikey.aspx). |
| **XMDB API Key** | `Optional` | Additional movie/TV database. [Get a free key here](https://xmdbapi.com/api-key). |

### Cache Management
Use the **Clear Cache** button in the settings menu to remove all cached ratings and force fresh API lookups.

---

## Troubleshooting

- **No badges appearing?** Refresh the Netflix page or check if the extension/script is enabled in your manager.
- **Stale ratings?** Use the **Clear Cache** button in settings.
- **Slow performance?** Check if an API was auto-disabled. You can manually reset this via **Reset Misbehaving Clients** in settings.
- **Still having issues?** Open a [GitHub issue](https://github.com/fran/FlixMonkey/issues) with your browser version and any console errors.

---

## Development & Technical Info

FlixMonkey is built using a modern modular architecture with a shared core for all platforms.

### Architecture
The codebase is split into three layers:
1. **Core (`src/core/`)**: Platform-agnostic business logic (APIs, Caching, Rendering).
2. **Platform (`src/platform/`)**: Implementation of the `PlatformAdapter` interface for each environment.
3. **Targets (`src/targets/`)**: Entry points and platform-specific manifests.

Detailed architectural documentation can be found in [AGENTS.md](./AGENTS.md).

### Build Process
Requires [Node.js](https://nodejs.org/).

```bash
# Install dependencies
npm install

# Build all targets (outputs to dist/)
npm run build

# Build specific targets
npm run build:chrome
npm run build:firefox
npm run build:userscript

# Lint and format
npm run lint
npm run format
```

### Development Workflow
1. Edit source files in `src/`.
2. Run `npm run build` to generate distribution artifacts in `dist/`.
3. Load the `dist/` folder into your browser (Extensions) or point your manager to `dist/FlixMonkey.user.js` (Userscript).

---

## License
GPLv3
