# FlixMonkey: Store & Package Descriptions

## GitHub repository description

> Browser extension and userscript that overlays IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix thumbnails.

---

## package.json `description`

```
"Show IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix thumbnails"
```

_(used as-is for Chrome and Firefox short descriptions)_

---

## Full description (Chrome and Firefox)

```
FlixMonkey adds a ratings overlay from IMDb, Metacritic, and Rotten Tomatoes directly onto Netflix thumbnails, so you can decide what is worth watching without leaving the page.

FEATURES
• IMDb rating shown on all titles
• Metacritic and Rotten Tomatoes scores shown if available
• Rating badge appears on browse pages, hover cards, info panels, and search results
• Click IMDb badge to open the title's IMDb page, or search IMDb by title if no match is found
• Fade out thumbnails below a custom IMDb rating threshold

RATING PROVIDERS
• IMDb API - Provides IMDb ratings only. Default because it does not require an API key but has very low rate limits.
• OMDB - Provides IMDb, Metacritic, and Rotten Tomatoes ratings. Free API key is required. This is the recommended provider.
• XMDB - Provides IMDb and Metacritic ratings. Free API key is required.

PERFORMANCE
• Ratings for titles older than 1 year are cached indefinitely.
• Ratings for new releases are refreshed monthly.
• Titles without ratings are retried after 1 day.
• Failing providers are disabled for 1 hour to prevent repeated failed requests.

LICENSE
Licensed under GPLv3. Source code is available on GitHub.
https://github.com/fran2889/flix-monkey
```
