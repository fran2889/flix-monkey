# FlixMonkey

A Tampermonkey/Greasemonkey userscript that overlays IMDb ratings on Netflix thumbnails and banners.

## Features

- Rating badge on browse cards, hover zoom, preview modals, and the hero billboard
- Clicking the badge opens the IMDb title page
- Three badge states:

| Badge | Meaning |
|---|---|
| `IMDb 8.3` | Rating found |
| `IMDb N/A` | Title found on IMDb but no rating available |
| `IMDb 🔍` | Title not found on IMDb — clicking searches instead |

- Ratings are cached locally (7 days for rated titles, 24 h for unrated)
- Deduplicates concurrent requests — multiple cards for the same title share one API call

## Requirements

- [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge), [Violentmonkey](https://violentmonkey.github.io/) (Chrome/Edge/Firefox), or [Greasemonkey](https://www.greasespot.net/) (Firefox)
- A free [OMDB API key](https://www.omdbapi.com/apikey.aspx) (Optional – FlixMonkey now falls back to scraping IMDb directly if the key is not set or if OMDB fails to return a rating)

## Installation

1. Install Tampermonkey, Violentmonkey, or Greasemonkey.
2. Open `FlixMonkey.user.js` and click **Raw**, or navigate directly to the raw file URL — the extension will detect it and prompt you to install.
3. (Optional) Open the script in the extension dashboard and set your OMDB API key to get more accurate ratings and additional data like Rotten Tomatoes and Metacritic scores:

```js
omdbApiKey: 'YOUR_OMDB_API_KEY',
```

## Configuration

All options live in the `CONFIG` object at the top of the script:

| Option | Default | Description |
|---|---|---|
| `omdbApiKey` | `'YOUR_OMDB_API_KEY'` | Your OMDB API key (Optional) |
| `overlayCorner` | `'top-left'` | Badge position — `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| `cacheTtlRated` | 7 days | Cache duration for titles with a rating |
| `cacheTtlNoRating` | 24 h | Cache duration for titles found but without a rating |

## Development

### Setup

```bash
npm install
```

### Scripts

| Command | Description |
|---|---|
| `npm run format` | Format `FlixMonkey.user.js` with Prettier (120-char width) |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Lint and auto-fix |

### Editor integration

JetBrains IDEs can run Prettier and ESLint automatically on save:

- **Prettier**: *Settings → Languages & Frameworks → JavaScript → Prettier* — point at `node_modules/.bin/prettier`, enable *On save*
- **ESLint**: *Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint* — select *Automatic ESLint configuration*

### Reloading the script on Netflix

- **Tampermonkey**: Enable *Settings → Allow access to file URLs* and configure the script to load from disk, or paste the updated source into the dashboard editor and save.
- **Violentmonkey**: Use *Track local file* in the script editor to load directly from disk.
- **Greasemonkey**: Re-install from the local file, or edit via the dashboard.

Refresh the Netflix page after any update.

## License

MIT
