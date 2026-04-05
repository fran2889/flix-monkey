# FlixMonkey

A Tampermonkey/Violentmonkey/Greasemonkey userscript that overlays IMDb, Rotten Tomatoes, and Metacritic ratings on Netflix thumbnails, hover zoom cards, preview modals, and the hero billboard.

## Overview

FlixMonkey enriches your Netflix browsing experience by displaying aggregated ratings from multiple sources. It fetches data from three independent APIs (IMDb API, XMDB, and OMDB) with automatic fallback, caches results locally for fast subsequent lookups, and intelligently deduplicates concurrent requests for the same title.

**The script is fully functional with zero API keys.** All three data sources are optional. By default, it tries the free IMDb API first, then falls back to other services if available.

## Features

### Rating Badges

FlixMonkey displays a compact rating badge on Netflix cards showing up to three scoring systems:

- **IMDb** rating (0.0–10.0 scale)
- **Rotten Tomatoes** score (0–100, when available)
- **Metacritic** score (0–100, when available)

The badge appears in your chosen corner (top-left, top-right, bottom-left, or bottom-right) on:

- Browse grid thumbnails
- Hover zoom cards
- Preview modals
- Hero banner images

### Interactive Badges

| Badge State | Appearance | Action |
|---|---|---|
| **Found & Rated** | `IMDb 8.3` | Click to open the IMDb title page |
| **Found, No Rating** | `IMDb N/A` | Click to open the IMDb title page |
| **Not Found on IMDb** | `IMDb 🔍` | Click to search for the title on IMDb |

### Smart Caching

Ratings are cached locally to reduce API calls:

- **Titles with ratings, released >1 year ago**: Cached indefinitely (customizable)
- **Titles with ratings, released <1 year ago**: Cached for 30 days (customizable)
- **Titles without ratings**: Cached for 24 hours (customizable)

This means subsequent browses are instant, and new ratings are checked periodically for recent releases.

### Request Deduplication

When multiple Netflix cards show the same title, FlixMonkey makes only one API call and reuses the result across all cards. This saves API quota and bandwidth.

### Multi-Source API Fallback

Three independent APIs can provide ratings:

1. **IMDb API** (imdbapi.dev) — Free, no key needed, recommended
2. **XMDB** (xmdbapi.com) — Free tier available
3. **OMDB** (omdbapi.com) — Free tier available, includes RT/Metacritic data

You control the fallback order via the `API Fallback Order` setting. By default, the script tries sources in order and stops as soon as an IMDb rating is found.

### Misbehaving Client Auto-Disable

If an API source becomes slow or unresponsive, FlixMonkey automatically disables it for 1 hour to prevent blocking the UI. You can manually reset this via the settings menu.

## Requirements

- **Browser extension**: [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge), [Violentmonkey](https://violentmonkey.github.io/) (Chrome/Edge/Firefox), or [Greasemonkey](https://www.greasespot.net/) (Firefox)
- **API keys** (all optional):
  - No keys needed to get started — the free IMDb API works out of the box
  - OMDB and XMDB keys are optional and give you additional data sources and fallback redundancy

## Installation

### Quick Start (No API Keys)

1. Install [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/), or [Greasemonkey](https://www.greasespot.net/).
2. Visit the [raw script file](https://raw.githubusercontent.com/fran/FlixMonkey/main/FlixMonkey.user.js) — your extension will detect it and prompt you to install.
3. Confirm the installation and refresh Netflix. Rating badges should appear immediately.

### With API Keys (Optional)

To unlock additional data sources and improve rating coverage:

1. After installing the script, right-click on the userscript manager extension icon and select **FlixMonkey Settings**.
2. Enter your API key(s):
   - **OMDB**: Get a free tier key at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
   - **XMDB**: Get a free key at [xmdbapi.com/api-key](https://xmdbapi.com/api-key)
3. Click **Save** — the page will reload and use your new keys.

**Note on API key security**: Store keys in the extension settings, not in the script source. Never commit real API keys to version control.

## Configuration

Access settings by right-clicking the userscript manager extension icon and selecting **FlixMonkey Settings**. All changes take effect immediately after saving.

### General Settings

| Option | Default | Description |
|---|---|---|
| **Overlay Position** | `top-left` | Corner where the rating badge appears: `top-left`, `top-right`, `bottom-left`, or `bottom-right` |
| **Show Rotten Tomatoes** | `Enabled` | Display RT scores when available (if your API provides them) |
| **Show Metacritic** | `Enabled` | Display Metacritic scores when available (if your API provides them) |

### API Settings

| Option | Default | Description |
|---|---|---|
| **OMDB API Key** | `YOUR_OMDB_API_KEY` | Optional. Get at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx). Provides RT and Metacritic scores in addition to IMDb ratings. |
| **XMDB API Key** | `YOUR_XMDB_API_KEY` | Optional. Get at [xmdbapi.com/api-key](https://xmdbapi.com/api-key). Free movie and TV database. |
| **API Fallback Order** | `imdbapi,xmdb,omdb` | Comma-separated list of API sources to try in order: `imdbapi`, `xmdb`, `omdb`. The script stops at the first source that returns an IMDb rating. Example: `omdb,xmdb,imdbapi` to prioritize OMDB. |

### Caching & Performance

| Option | Default | Description |
|---|---|---|
| **Cache Rated > 1 year (days)** | `-1` (forever) | How long to cache titles older than 1 year that have a rating. `-1` means cache indefinitely. |
| **Cache Rated < 1 year (days)** | `30` | How long to cache recent titles (≤1 year old) that have a rating. Higher values = fewer API calls; lower values = more frequent updates. |
| **Cache Unrated (days)** | `1` | How long to cache titles not found or without ratings. Lower values allow retries sooner if the title is later added to an API. |

### Cache Management

The **Clear Cache** option (available in settings) removes all cached ratings and forces fresh API lookups on the next browse. Use this if ratings feel stale or outdated.

## Troubleshooting

### Badges Not Appearing

**Problem**: You see no rating badges on Netflix cards.

**Causes & Solutions**:

- **Extension not installed correctly**: Refresh the Netflix page. Check your extension manager (Tampermonkey/Violentmonkey/Greasemonkey) to confirm FlixMonkey is enabled.
- **Netflix DOM changed**: Netflix updates its UI regularly. FlixMonkey may not recognize all new card layouts. Check the browser console (*F12 → Console*) for errors; open an issue on GitHub if you see errors.
- **All API sources are down or disabled**: Check **Settings → API Fallback Order**. If you see "misbehaving clients" disabled, click **Reset Misbehaving Clients** to re-enable them.

### Badges Appear on Some Cards but Not Others

**Possible causes**:

- **Title not in any API**: Not all Netflix titles are in IMDb or other databases. These will show `IMDb 🔍` instead of a rating.
- **Lazy-loaded elements**: Cards that load later may not yet have a badge. Scroll slowly and let the page settle.
- **Duplicate cards**: Some cards are rendered multiple times (e.g., in row headers and footers). Badges appear on the first occurrence.

### API Rate Limiting or Slow Responses

**Problem**: Badges load slowly or some requests timeout.

**Solution**: Adjust **API Fallback Order** to use only your fastest sources. For example, if OMDB is slow:

```
imdbapi,xmdb
```

This skips OMDB and relies on IMDb API and XMDB. If a source is consistently slow, FlixMonkey auto-disables it for 1 hour; check **Reset Misbehaving Clients** in settings if you see a disabled source.

### Getting API Keys

**OMDB** (includes Rotten Tomatoes & Metacritic):

1. Visit [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
2. Enter your email and select "FREE" (1,000 requests/day)
3. Confirm via email; your key will be shown
4. Paste into FlixMonkey settings: **OMDB API Key**

**XMDB** (free movie & TV database):

1. Visit [xmdbapi.com/api-key](https://xmdbapi.com/api-key)
2. Sign up and generate a key
3. Paste into FlixMonkey settings: **XMDB API Key**

### Clearing Settings or Cache

**Reset to defaults**: Click **Reset** in the bottom-right corner of the settings dialog.

**Clear cached ratings**: Click **Clear Cache** in settings to force fresh API lookups.

**Re-test after changes**: After modifying settings, refresh the Netflix page for changes to take effect.

## Support & Feedback

- **Bug reports or feature requests**: Open an issue on [GitHub](https://github.com/fran/FlixMonkey/issues)
- **Script not working on Netflix anymore**: Netflix updates frequently. If badges stop appearing, check the browser console for errors and open an issue.

## Development

### Setup

```bash
npm install
```

This installs ESLint, Prettier, and their dependencies.

### Scripts

| Command | Description |
|---|---|
| `npm run format` | Format `FlixMonkey.user.js` with Prettier (120-char width) |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Lint and auto-fix |

### Editor Integration

JetBrains IDEs can run Prettier and ESLint automatically on save:

- **Prettier**: *Settings → Languages & Frameworks → JavaScript → Prettier* — point at `node_modules/.bin/prettier`, enable *On save*
- **ESLint**: *Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint* — select *Automatic ESLint configuration*

### Reloading the Script on Netflix

After editing `FlixMonkey.user.js`, reload the script in your browser:

- **Tampermonkey**: Enable *Settings → Allow access to file URLs* and configure the script to load from disk, or paste the updated source into the dashboard editor and save.
- **Violentmonkey**: Use *Track local file* in the script editor to load directly from disk.
- **Greasemonkey**: Re-install from the local file, or edit via the dashboard.

Always refresh the Netflix page after updating the script.

### Code Style

- **ESLint**: Enforces `prefer-const`, `no-var`, `eqeqeq`, and other best practices.
- **Prettier**: Formats code to 120-character line width.
- Always run `npm run lint` and `npm run format` before committing.

### Architecture

The script is a single self-contained IIFE with clearly labeled sections:

- **CONFIG**: User-facing settings (API keys, badge position, cache TTLs)
- **Cache management**: Local storage helpers
- **OMDB/IMDb APIs**: Fetch functions and fallback logic
- **Overlay rendering**: CSS injection and badge creation
- **Surface discovery**: Netflix DOM pattern matching
- **Core decoration**: Title discovery → API call → badge overlay
- **SPA navigation**: Handles Netflix's single-page app routing

For detailed architecture info, see [AGENTS.md](./AGENTS.md).

### Development Workflow

1. Edit `FlixMonkey.user.js`
2. Run `npm run lint:fix && npm run format`
3. Reload the script in your browser extension
4. Refresh Netflix and test
5. Commit with a [Conventional Commit](https://www.conventionalcommits.org/) message

## License

MIT
