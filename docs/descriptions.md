# short description

Show IMDb, Rotten Tomatoes and Metacritic ratings on Netflix thumbnails and banners

# full description

FlixMonkey overlays IMDb, Rotten Tomatoes, and Metacritic ratings onto Netflix thumbnails, hover cards, info panels, and search results, so you can tell what is worth watching at a glance. Fade out anything below a rating threshold you set, and jump straight to a title's IMDb page with one click.

FEATURES
• IMDb rating shown on all titles
• Rotten Tomatoes and Metacritic scores shown if available
• Rating badge appears on browse pages, hover cards, info panels and search results
• Click IMDb badge to open the title's IMDb page, or search IMDb by title if no match is found
• Fade out thumbnails below a custom IMDb rating threshold

RATING PROVIDERS
• IMDb API - Provides IMDb and Metacritic ratings. Default because it does not require an API key but has very low rate limits.
• OMDB - Provides IMDb, Rotten Tomatoes and Metacritic ratings. Free API key is required. This is the recommended provider.
• XMDB - Provides IMDb and Metacritic ratings. Free API key is required.

CACHING
Ratings are stored locally, so badges load instantly and your API quota lasts longer.
• Established titles, over a year old, are cached indefinitely.
• Recent releases refresh monthly to pick up rating changes.
• Titles with no rating yet are retried after a day.
• A provider that starts failing is paused for an hour to avoid repeated failed requests.

LICENSE
Licensed under GPLv3. Source code is available on GitHub.
https://github.com/fran2889/flix-monkey
