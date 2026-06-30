# FlixMonkey

A multi-platform browser extension and userscript that overlays IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix thumbnails, hover cards, and preview modals.

## Overview

FlixMonkey enriches your Netflix browsing experience by displaying aggregated ratings from multiple sources. It fetches data from independent APIs (Agregarr, IMDb API, XMDB, and OMDB), caches results locally for fast subsequent lookups, and intelligently deduplicates concurrent requests for the same title.

The project is available as a **Chrome Extension**, **Firefox Add-on**, and a **Tampermonkey/Violentmonkey Userscript**. All versions share a common core and provide a feature-equivalent experience.

By default, it uses [Agregarr](https://github.com/agregarr/agregarr) for IMDb ratings (no API key needed). Optional keys for OMDB and XMDB unlock Metacritic and Rotten Tomatoes scores.

---

## Installation

### Userscript (Tampermonkey / Violentmonkey)

Compatible with all major userscript managers. This is the easiest way to get started.

1. Install [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [Greasemonkey](https://www.greasespot.net/).
2. Visit the [raw script file](https://raw.githubusercontent.com/fran2889/flix-monkey/main/FlixMonkey.user.js) to trigger installation.
3. Confirm the installation and refresh Netflix. Rating badges should appear immediately.

### Browser Extension (Chrome & Firefox)

The browser extensions provide a more seamless integration and better performance by using background processes for network requests.

1. **Chrome / Edge**:
    1. Download the latest `chrome.zip` from the [Releases page](https://github.com/fran2889/flix-monkey/releases) and extract it (or build from source).
    2. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/` for Edge).
    3. Toggle the **Developer mode** switch in the top right corner.
    4. Click the **Load unpacked** button that appears.
    5. Select the extracted `chrome` folder (or `dist/chrome` if built from source).
    6. Ensure the extension is toggled **On**.
2. **Firefox**:
    1. Download the latest `.xpi` from the [Releases page](https://github.com/fran2889/flix-monkey/releases) (or build from source).
    2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
    3. Click the **Load Temporary Add-on...** button.
    4. Select the `manifest.json` file inside the extracted `firefox` folder (or `dist/firefox/manifest.json` if built from source).

---

## Features

### Rating Badges

Displays a compact badge in your chosen corner on:

- Browse grid thumbnails
- Hover zoom cards
- Preview modals

### Supported Scores

- **IMDb** rating (0.0–10.0)
- **Metacritic** score (0–100)
- **Rotten Tomatoes** score (0–100, requires OMDB key)

### Interactive Badges

| Badge State           | Appearance | Action                                |
| --------------------- | ---------- | ------------------------------------- |
| **Found & Rated**     | `IMDb 8.3` | Click to open the IMDb title page     |
| **Found, No Rating**  | `IMDb N/A` | Click to open the IMDb title page     |
| **Not Found on IMDb** | `IMDb 🔍`  | Click to search for the title on IMDb |

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

| Option               | Default    | Description                                                                                |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| **Overlay Position** | `top-left` | Corner where the rating badge appears.                                                     |
| **API Client**       | `agregarr` | The primary API service to query for ratings.                                              |
| **OMDB API Key**     | `Optional` | Provides Metacritic/RT scores. [Get a free key here](https://www.omdbapi.com/apikey.aspx). |
| **XMDB API Key**     | `Optional` | Additional movie/TV database. [Get a free key here](https://xmdbapi.com/api-key).          |

### Cache Management

Use the **Clear Cache** button in the settings menu to remove all cached ratings and force fresh API lookups.

---

## Troubleshooting

- **No badges appearing?** Refresh the Netflix page or check if the extension/script is enabled in your manager.
- **Stale ratings?** Use the **Clear Cache** button in settings.
- **Slow performance?** Check if an API was auto-disabled. You can manually reset this via **Reset Misbehaving Clients** in settings.
- **Still having issues?** Open a [GitHub issue](https://github.com/fran2889/flix-monkey/issues) with your browser version and any console errors.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full history of releases and changes.

## Development & Technical Info

FlixMonkey is built using a modern modular architecture with a shared core for all platforms.

### Architecture

The codebase is split into three layers:

1. **Core (`src/core/`)**: Platform-agnostic business logic (APIs, Caching, Rendering).
2. **Platform (`src/platform/`)**: Implementation of the `PlatformAdapter` interface for each environment.
3. **Targets (`src/targets/`)**: Entry points and platform-specific manifests.

Detailed architectural documentation can be found in [AGENTS.md](./AGENTS.md).

### Build Process

Requires [Node.js](https://nodejs.org/) (>= 24).

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

### Chrome Integration Tests

`npm run test:integration-chrome` runs a local-only Playwright suite against the built Chrome extension and a live Netflix browser session. It is not part of `npm test` or regular CI.

Before running it:

1. Create a dedicated Chrome or Chromium profile for FlixMonkey integration testing.
2. Log into Netflix in that profile.
3. Populate `.env` with:

    ```dotenv
    CHROME_EXECUTABLE_PATH=/path/to/chrome-or-chromium
    CHROME_USER_DATA_DIR=/path/to/flixmonkey-chrome-profile
    CHROME_PROFILE_DIRECTORY=
    NETFLIX_PROFILE_NAME=Your Netflix Profile
    CHROME_INTEGRATION_HEADLESS=false
    CHROME_INTEGRATION_KEEP_OPEN=false
    CHROME_INTEGRATION_TIMEOUT_MS=30000
    ```

Run:

```bash
npm run test:integration-chrome
```

The suite builds `dist/chrome`, loads it as an unpacked extension, opens Netflix, selects `NETFLIX_PROFILE_NAME` if the Netflix profile chooser appears, seeds deterministic cache entries for visible titles, and verifies overlays and settings behavior. It preserves `omdbApiKey` and `xmdbApiKey`, and resets other options, `fmc:*` cache entries, and `fm-fade:*` overrides at the start and end of the run.

---

## Privacy Policy

FlixMonkey does not collect, store, or transmit any personal data about you.

**What it does:**

- **Title lookups**: When you browse Netflix, the title names visible on the page are sent to third-party rating APIs (Agregarr, IMDb API, OMDB, XMDB) solely to retrieve ratings. No account information, viewing history, or Netflix credentials are included in these requests.
- **Local storage only**: All cached ratings, settings, and API keys are stored exclusively in your browser's local extension storage (or userscript storage). This data never leaves your device except as part of the API requests described above.
- **No telemetry**: FlixMonkey does not include any analytics, crash reporting, or usage tracking of any kind.
- **No developer servers**: All network requests go directly from your browser to the third-party rating APIs. There is no intermediary server operated by this project.

**Third-party APIs:**

By default, title lookups are resolved via [IMDb](https://www.imdb.com/) suggestions and ratings are fetched from [Agregarr](https://github.com/agregarr/agregarr). When OMDB or XMDB is selected, requests are made to [omdbapi.com](https://www.omdbapi.com/) and/or [xmdbapi.com](https://xmdbapi.com/). The [IMDb API](https://api.imdbapi.dev/) is also available as an alternative provider. Your use of these services is subject to their respective privacy policies.

---

## License

GPLv3
