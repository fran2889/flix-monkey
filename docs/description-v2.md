# GitHub repo description

Browser extension and userscript that overlays IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix titles.

# Short description

See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix.

# Full description

FlixMonkey adds IMDb, Metacritic, and Rotten Tomatoes ratings directly to Netflix, helping you decide what to watch before you press play. Ratings appear on title cards, hover previews, detail panels, and search results. You can also filter out low-rated titles and quickly jump to IMDb for more details.

Available as a Chrome extension, Firefox add-on, and Greasemonkey userscript.

Features

• View IMDb ratings directly on Netflix titles, with Metacritic and Rotten Tomatoes added when available
• Click the IMDb badge to open the title on IMDb, or search IMDb when no match is found
• Optionally fade out titles below a chosen IMDb rating threshold

Rating providers

FlixMonkey supports multiple rating sources depending:

• OMDb (recommended) — Provides IMDb, Metacritic, and Rotten Tomatoes ratings with a free API key
• XMDb — Provides IMDb and Metacritic ratings with a free API key
• IMDb API (default) — No API key required, but slow due to strict rate limits

Caching

Ratings are cached locally to keep browsing fast and reduce API usage:

• Older titles (1+ year) are cached indefinitely
• Recent titles refresh monthly to capture updated ratings
• Unrated titles are retried after 24 hours
• Failing providers are temporarily paused to prevent repeated errors

License

Licensed under GPLv3. Source code available on GitHub:
https://github.com/fran2889/flix-monkey
