# GitHub repo description

Browser extension and userscript that overlays IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix

# short description

See IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix titles as you browse

# full description

FlixMonkey shows IMDb, Metacritic, and Rotten Tomatoes ratings directly on Netflix title cards, hover previews, detail panels, and search results, so you can see what is worth watching before you hit play. Set a threshold to fade out low-rated titles, and click the IMDb badge to jump straight to its IMDb page.

Available as a Chrome extension, Firefox add-on, and Greasemonkey userscript.

FEATURES
• IMDb rating on matched titles, with Metacritic and Rotten Tomatoes added when available
• Click the IMDb badge to open the title on IMDb, or search IMDb by name when there is no exact match
• Fade out titles that fall below an IMDb rating you choose

RATING PROVIDERS
OMDB is recommended: one free API key unlocks all three rating sources.
• OMDB: IMDb, Metacritic, and Rotten Tomatoes ratings. Requires a free API key.
• XMDB: IMDb and Metacritic ratings. Requires a free API key.
• IMDb API: IMDb and Metacritic ratings. The default, since it needs no API key, but its rate limits are very low.

CACHING
Ratings are stored locally, so previously loaded ratings appear instantly.
• Titles over a year old are cached indefinitely.
• Recent releases refresh monthly to pick up rating changes.
• Titles with no rating are retried after a day.
• A provider that starts failing is paused for an hour to avoid repeated failed requests.

LICENSE
Licensed under GPLv3. Source code is available on GitHub.
https://github.com/fran2889/flix-monkey
