# FlixMonkey

[![GitHub release](https://img.shields.io/github/v/release/fran2889/flix-monkey)](https://github.com/fran2889/flix-monkey/releases)
[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/ipbiebdbicmlajmbcghkcdkobmcaoadl.svg?label=Chrome)](https://chromewebstore.google.com/detail/flixmonkey/ipbiebdbicmlajmbcghkcdkobmcaoadl)
[![Firefox Add-on Version](https://img.shields.io/amo/v/flixmonkey.svg?label=Firefox)](https://addons.mozilla.org/en-US/firefox/addon/flixmonkey/)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/fran2889/flix-monkey/ci.yml?branch=main&label=build)](https://github.com/fran2889/flix-monkey/actions/workflows/ci.yml)
[![Nightly](https://img.shields.io/github/actions/workflow/status/fran2889/flix-monkey/nightly.yml?label=nightly)](https://github.com/fran2889/flix-monkey/actions/workflows/nightly.yml)

See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix.

---

## Table of Contents

- [How It Looks](#how-it-looks)
- [Installation](#installation)
- [Features](#features)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Privacy Policy](#privacy-policy)
- [License](#license)

---

## How It Looks

<img src="screenshots/netflix-browse.png" alt="Rating badges on Netflix titles in browse view" style="max-width: 45%; height: auto; margin-right: 2%">
<img src="screenshots/netflix-info.png" alt="Rating badges on Netflix title detail pages" style="max-width: 45%; height: auto;">

---

## Installation

Use the links below to install the add-on for your browser.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Install-black?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/flixmonkey/ipbiebdbicmlajmbcghkcdkobmcaoadl)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Install-orange?logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/flixmonkey/)
[![Tampermonkey](https://img.shields.io/badge/Userscript-Install-green?logo=tampermonkey&logoColor=white)](https://github.com/fran2889/flix-monkey/releases/latest/download/FlixMonkey.user.js)

> The userscript version requires [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Opera, Safari), [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Edge, Firefox), or [Greasemonkey](https://www.greasespot.net/) (Firefox).

---

## Features

- **Rating Badges**: View IMDb ratings on titles, title previews, and detail pages; Metacritic and Rotten Tomatoes scores are available when using OMDb or XMDb providers
- **Click to Open**: Click rating badges to open the title's IMDb page or search IMDb when no match is found
- **Color-Coded Ratings**: Rating badges change color based on thresholds (red < 5.0, green >= 8.5)
- **Customizable**: Change badge position, choose rating provider, fade titles below a rating threshold, and more
- **Smart Caching**: Fast lookups for titles you've seen before; configurable expiration per title type (old, recent, without rating)
- **Multi-Tab Sync**: Requests and settings are synchronized across Netflix tabs to prevent redundant lookups
- **Auto-Disable**: Failing APIs are temporarily disabled for 1 hour to prevent lag

---

## Settings

> FlixMonkey supports multiple rating providers. The default (FM-DB + Agregarr) requires no API key but provides IMDb ratings only. OMDb and XMDb require free API keys, but they are more reliable and also provide Rotten Tomatoes and Metacritic scores.

Access settings via:

- **Chrome**: Click the FlixMonkey icon in your browser toolbar
- **Firefox**: Click the FlixMonkey icon in your browser toolbar, or go to `about:addons`, select FlixMonkey and go to the **Preferences** tab
- **Userscript**: Open your userscript manager (Tampermonkey/Violentmonkey/Greasemonkey) and click on the **FlixMonkey Settings** menu item

![Settings](screenshots/firefox-settings.png)

### Display Options

| Option                | Default  | Description                                                                       |
| --------------------- | -------- | --------------------------------------------------------------------------------- |
| Rating Badge Position | Top Left | Corner where rating badges appear                                                 |
| Rotten Tomatoes       | No       | Display RT score. Only available when OMDb is the rating provider                 |
| Metacritic            | No       | Display Metacritic score. Only available when OMDb or XMDb is the rating provider |

### Rating Providers

| Option          | Default          | Description                                                                                  |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| Rating Provider | FM-DB + Agregarr | Active rating provider. Default uses FM-DB for IMDb ID lookup and Agregarr for IMDb ratings. |
| OMDb API Key    | _empty_          | [Get a free API key](https://www.omdbapi.com/apikey.aspx). Required when OMDb is selected    |
| XMDb API Key    | _empty_          | [Get a free API key](https://xmdbapi.com/api-key). Required when XMDb is selected            |

### Fade Settings

| Option            | Default | Description                                         |
| ----------------- | ------- | --------------------------------------------------- |
| Fade Below Rating | No      | Fade titles rated below the threshold               |
| Fade threshold    | 6.0     | IMDb rating below which to fade (0.0-10.0)          |
| Allow Override    | No      | Show button to override fade state in title preview |

### Cache Settings

| Option                    | Default      | Description                                                                 |
| ------------------------- | ------------ | --------------------------------------------------------------------------- |
| Older Titles (Cache TTL)  | -1 (forever) | Cache duration (days) for rated titles > 1 year old. Set -1 to never expire |
| Recent Titles (Cache TTL) | 30           | Cache duration (days) for rated titles <= 1 year old                        |
| No Rating (Cache TTL)     | 1            | Cache duration (days) for unrated or not-found titles                       |

### Advanced

| Option               | Default | Description                                                |
| -------------------- | ------- | ---------------------------------------------------------- |
| Enable debug logging | Yes     | Enable verbose console logging to help troubleshoot issues |

---

## Troubleshooting

Before diving deeper, try these first:

1. Refresh the Netflix page (F5 or Ctrl+R)
2. Check that FlixMonkey is enabled in your extension/userscript manager
3. Verify you are on a supported Netflix page (browse, search, or title pages)

**No rating badges appearing?**

- Ensure the extension is enabled in your browser
- Verify you are on a supported Netflix page (browse, search, or title pages)
- Refresh the Netflix page (F5 or Ctrl+R)
- Check that your userscript manager is running (for userscript version)

**Need fresh ratings?**

- Clear the cache in FlixMonkey settings (found in the Options panel for extensions, or your userscript manager for userscripts)
- Switch to a different rating provider if your current one is down

**Slow performance?**

- Failing APIs are auto-disabled for 1 hour; wait for reactivation or switch rating provider in settings
- Reduce the number of open Netflix tabs

**Ratings not showing for a specific title?**

- The title may not be in the selected API's database
- Try a different rating provider
- Check browser console (F12) for errors and open a [GitHub issue](https://github.com/fran2889/flix-monkey/issues)

**Still having issues?**

- Open browser developer tools (F12) and check the Console tab for errors
- Ensure your API keys are correctly configured for your selected rating provider
- Check the Network tab for failed requests to rating APIs
- Open a [GitHub issue](https://github.com/fran2889/flix-monkey/issues) with details of what you tried

---

## Development

FlixMonkey requires Node.js >= 24.

```bash
npm install
npm run build             # Build all targets
npm run build:userscript  # Build userscript only
npm run build:firefox     # Build Firefox extension only
npm run build:chrome      # Build Chrome extension only
npm run dev               # Watch mode with auto-rebuild
npm test                  # Run unit and UI tests
npm run test:unit        # Run unit tests only
npm run test:ui          # Run UI tests only
npm run test:coverage    # Run tests with coverage report
npm run test:integration  # Run integration tests (requires API keys)
npm run lint              # Lint source files
npm run lint:fix          # Lint with auto-fix
npm run format            # Format source files
npm run format:check      # Check formatting without writing
npm run clean             # Remove dist/ and coverage/ directories
```

To test in development:

1. Run the appropriate build command for your target (e.g., `npm run build:chrome`)
2. In Chrome: go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/chrome` directory
3. In Firefox: go to `about:debugging`, click **This Firefox**, then **Load Temporary Add-on**, and select any file in `dist/firefox`

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup and architecture details.

---

## Privacy Policy

FlixMonkey does not collect, store, or transmit any personal data about you.

**What it does:**

- **Title lookups**: When you browse Netflix, the title names visible on the page are sent to third-party rating APIs (Agregarr, OMDb, and XMDb) solely to retrieve ratings. No account information, viewing history, or Netflix credentials are included in these requests.
- **Local storage only**: All cached ratings, settings, and API keys are stored exclusively in your browser's local extension storage (or userscript storage). This data never leaves your device except as part of the API requests described above.
- **No telemetry**: FlixMonkey does not include any analytics, crash reporting, or usage tracking of any kind.
- **No developer servers**: All network requests go directly from your browser to the third-party rating APIs. There is no intermediary server operated by this project.

**Third-party APIs:**

By default, title lookups use FM-DB (imdb.iamidiotareyoutoo.com) for IMDb ID lookup and [Agregarr](https://github.com/agregarr/agregarr) at [api.agregarr.org](https://api.agregarr.org/) for ratings. When OMDb or XMDb is selected, requests are made to [omdbapi.com](https://www.omdbapi.com/) and/or [xmdbapi.com](https://xmdbapi.com/). Your use of these services is subject to their respective privacy policies.

---

## License

[GPL-3.0-or-later](LICENSE)
