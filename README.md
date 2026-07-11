# FlixMonkey

![FlixMonkey screenshot showing rating badges on Netflix thumbnails](screenshots/hero.png)

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)
[![Version 1.3.0](https://img.shields.io/badge/version-1.3.0-green.svg)](https://github.com/fran2889/flix-monkey/releases)

See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix.

---

## Table of Contents

- [How it looks](#how-it-looks)
- [Installation](#installation)
- [Features](#features)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Privacy Policy](#privacy-policy)
- [License](#license)

---

## How it looks

![Rating badges on Netflix thumbnails](screenshots/thumbnails.png)
![Hover card with ratings](screenshots/hover.png)
![Preview modal with ratings](screenshots/modal.png)

---

## Installation

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Install-black?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Install-orange?logo=firefox&logoColor=white)](https://addons.mozilla.org)
[![Tampermonkey](https://img.shields.io/badge/Userscript-Install-green?logo=tampermonkey&logoColor=white)](https://www.tampermonkey.net)

_Requires [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) or [Violentmonkey](https://violentmonkey.github.io/) for userscript installation_

---

## Features

- **Rating Badges** - IMDb, Metacritic, and Rotten Tomatoes scores on thumbnails, hover cards, and modals
- **Smart Caching** - Fast lookups for titles you've seen before
- **Auto-Disable** - Failing APIs are temporarily disabled for 1 hour to prevent lag
- **Click to Open** - Click badges to open the title's IMDb page
- **Customizable** - Change badge position, choose API provider, and more

---

## Settings

Access settings via:

- **Extensions**: Click the FlixMonkey icon in your browser toolbar → **Options**
- **Userscript**: Right-click the userscript manager icon on Netflix → **FlixMonkey Settings**

### Display Options

| Option                    | Default  | Description                                      |
| ------------------------- | -------- | ------------------------------------------------ |
| **Overlay Position**      | Top Left | Corner where rating badges appear                |
| **Show Rotten Tomatoes**  | No       | Display RT score (only when OMDb is selected)    |
| **Show Metacritic**       | No       | Display Metacritic score (OMDb or XMDb required) |
| **Fade Thumbnails**       | No       | Fade thumbnails below rating threshold           |
| **Fade Rating Threshold** | 6.0      | IMDb rating below which to fade                  |
| **Show Fade Toggle**      | No       | Show button to override fade in hover preview    |

### API & Data

| Option                     | Default          | Description                                                                                                                  |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Rating Provider**        | FM-DB + Agregarr | Primary data source (FM-DB + Agregarr, OMDb, XMDb). Note: RT scores only available with OMDb; MC available with OMDb or XMDb |
| **OMDb API Key**           | _empty_          | [Get a free key](https://www.omdbapi.com/apikey.aspx) (required when OMDb is selected)                                       |
| **XMDb API Key**           | _empty_          | [Get a free key](https://xmdbapi.com/api-key) (required when XMDb is selected)                                               |
| **Cache TTL (Old Titles)** | -1 (forever)     | Cache duration (days) for rated titles > 1 year old. Use -1 for never expire                                                 |
| **Cache TTL (New Titles)** | 30               | Cache duration (days) for rated titles < 1 year old                                                                          |
| **Cache TTL (No Rating)**  | 1                | Cache duration (days) for unrated/not-found titles                                                                           |

### Advanced

| Option         | Default | Description                    |
| -------------- | ------- | ------------------------------ |
| **Debug Mode** | Yes     | Enable verbose console logging |

---

## Troubleshooting

**No badges appearing?** Refresh Netflix or check if the extension is enabled. **Need fresh ratings?** Clear cache in settings. **Slow performance?** Reset disabled APIs in settings. **Still having issues?** Open a [GitHub issue](https://github.com/fran2889/flix-monkey/issues).

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

- **Title lookups**: When you browse Netflix, the title names visible on the page are sent to third-party rating APIs (Agregarr, OMDb, XMDb) solely to retrieve ratings. No account information, viewing history, or Netflix credentials are included in these requests.
- **Local storage only**: All cached ratings, settings, and API keys are stored exclusively in your browser's local extension storage (or userscript storage). This data never leaves your device except as part of the API requests described above.
- **No telemetry**: FlixMonkey does not include any analytics, crash reporting, or usage tracking of any kind.
- **No developer servers**: All network requests go directly from your browser to the third-party rating APIs. There is no intermediary server operated by this project.

**Third-party APIs:**

By default, title lookups use [FM-DB](https://imdb.iamidiotareyoutoo.com/) (IMDb suggestions) and ratings are fetched from [Agregarr](https://github.com/agregarr/agregarr) at [api.agregarr.org](https://api.agregarr.org/). When OMDb or XMDb is selected, requests are made to [omdbapi.com](https://www.omdbapi.com/) and/or [xmdbapi.com](https://xmdbapi.com/). Your use of these services is subject to their respective privacy policies.

---

## License

[GPL-3.0-or-later](LICENSE)
