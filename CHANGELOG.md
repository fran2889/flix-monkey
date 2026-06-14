# Changelog

## [1.0.0](https://github.com/fran2889/flix-monkey/releases/tag/flixmonkey-v1.0.0) (2026-06-14)

### Features

* **core:** overlay IMDb, Rotten Tomatoes, and Metacritic rating badges directly on Netflix thumbnails and banners ([188e8ba](../../commit/188e8ba), [abe3107](../../commit/abe3107))
* **surfaces:** rating overlays on all major Netflix UI surfaces: browse rows, search results, hover cards, info modals, and Top 10 badges ([8901e14](../../commit/8901e14), [25dcaa9](../../commit/25dcaa9))
* **overlay:** loading badge displayed while ratings are being fetched ([e49d952](../../commit/e49d952))
* **overlay:** low-rated titles are visually dimmed on browse and search surfaces ([5801d47](../../commit/5801d47))
* **api-clients:** XMDB, OMDB, and IMDb API Dev clients ([d372fab](../../commit/d372fab), [55d58a0](../../commit/55d58a0), [de05390](../../commit/de05390))
* **api-manager:** persistent circuit breaker disables consistently failing API endpoints to avoid redundant requests ([cb30b95](../../commit/cb30b95))
* **request-queue:** rate-limited request queue with cross-tab synchronization via shared storage ([52c6317](../../commit/52c6317))
* **cache:** per-item cache with configurable TTL ([0fef9b8](../../commit/0fef9b8))
* **targets:** distributed as a Tampermonkey/Violentmonkey/Greasemonkey userscript, a Firefox MV3 extension, and a Chrome MV3 extension ([34fdca4](../../commit/34fdca4))
* **settings-ui:** unified settings panel with validation and save functionality, shared across all three targets ([84e8be9](../../commit/84e8be9), [50f7077](../../commit/50f7077))
* **options:** extension options page closes and reloads open Netflix tabs after saving ([eab404e](../../commit/eab404e))
* **modal:** settings modal with full keyboard accessibility and ARIA roles ([bfbc532](../../commit/bfbc532))
* **logger:** centralized logger with configurable debug level ([7e4ea73](../../commit/7e4ea73), [a1aad3c](../../commit/a1aad3c))

