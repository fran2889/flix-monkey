# FlixMonkey

![FlixMonkey screenshot showing rating badges on Netflix thumbnails](screenshots/hero.png)

[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Version 1.3.0](https://img.shields.io/badge/version-1.3.0-green.svg)](https://github.com/fran2889/flix-monkey/releases)

See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix.

---

## How it looks

![Rating badges on Netflix thumbnails](screenshots/thumbnails.png)
![Hover card with ratings](screenshots/hover.png)
![Preview modal with ratings](screenshots/modal.png)

---

## Installation

### Chrome Extension

[![Install for Chrome](https://img.shields.io/badge/Chrome-Install-black?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/flixmonkey/ipbiebdbicmlajmbcghkcdkobmcaoadl)

### Firefox Add-on

[![Install for Firefox](https://img.shields.io/badge/Firefox-Install-orange?logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/flixmonkey/)

### Userscript

[![Install Userscript](https://img.shields.io/badge/Userscript-Install-green?logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/fran2889/flix-monkey/main/FlixMonkey.user.js)
_Requires [Tampermonkey for Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo), [Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/), or [Violentmonkey](https://violentmonkey.github.io/)_

---

## Features

✅ **Rating Badges** - IMDb, Metacritic, Rotten Tomatoes scores on thumbnails, hover cards, and modals
✅ **Smart Caching** - Fast lookups for titles you've seen before
✅ **Auto-Disable** - Failing APIs are temporarily disabled to prevent lag
✅ **Click to Open** - Click badges to open the IMDb page
✅ **Customizable** - Change badge position, choose API provider, and more

---

## Settings

Access settings via:

- **Extensions**: Click the FlixMonkey icon in your browser toolbar → **Options**
- **Userscript**: Right-click the userscript manager icon on Netflix → **FlixMonkey Settings**

### Display Options

| Option                    | Default  | Description                                   |
| ------------------------- | -------- | --------------------------------------------- |
| **Overlay Position**      | Top Left | Corner where rating badges appear             |
| **Show Rotten Tomatoes**  | No       | Display RT score (requires OMDB key)          |
| **Show Metacritic**       | No       | Display Metacritic score                      |
| **Fade Thumbnails**       | No       | Fade thumbnails below rating threshold        |
| **Fade Rating Threshold** | 6.0      | IMDb rating below which to fade               |
| **Show Fade Toggle**      | No       | Show button to override fade in hover preview |

### API & Data

| Option                     | Default  | Description                                                            |
| -------------------------- | -------- | ---------------------------------------------------------------------- |
| **API Client**             | Agregarr | Primary rating provider (Agregarr, IMDb API, OMDB, XMDB)               |
| **OMDB API Key**           | _empty_  | [Get a free key](https://www.omdbapi.com/apikey.aspx) for RT/MC scores |
| **XMDB API Key**           | _empty_  | [Get a free key](https://xmdbapi.com/api-key) for additional data      |
| **Cache TTL (Old Titles)** | Forever  | Cache duration for rated titles > 1 year old                           |
| **Cache TTL (New Titles)** | 30 days  | Cache duration for rated titles < 1 year old                           |
| **Cache TTL (No Rating)**  | 1 day    | Cache duration for unrated/not-found titles                            |

### Advanced

| Option         | Default | Description                    |
| -------------- | ------- | ------------------------------ |
| **Debug Mode** | Yes     | Enable verbose console logging |

---

## Troubleshooting

**No badges appearing?** Refresh Netflix or check if the extension is enabled.
**Need fresh ratings?** Clear cache in settings.
**Slow performance?** Reset disabled APIs in settings.
**Still having issues?** Open a [GitHub issue](https://github.com/fran2889/flix-monkey/issues).

---

## Development

FlixMonkey is built with Node.js (>= 24).

```bash
npm install
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup.

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

[GPLv3](LICENSE)
