# Changelog

## [1.1.1](https://github.com/fran2889/flix-monkey/compare/v1.1.0...v1.1.1) (2026-06-22)


### Miscellaneous Chores

* release 1.1.1 ([#31](https://github.com/fran2889/flix-monkey/issues/31)) ([37ad552](https://github.com/fran2889/flix-monkey/commit/37ad552465d97ccbce93d3c27f899336a313b388))

## [1.1.0](https://github.com/fran2889/flix-monkey/compare/v1.0.1...v1.1.0) (2026-06-22)


### Features

* redesign options UI for compact layout ([#22](https://github.com/fran2889/flix-monkey/issues/22)) ([d476bb8](https://github.com/fran2889/flix-monkey/commit/d476bb8eb841cc3a95bdd1fe1fb6f34cb33c6d3b))


### Bug Fixes

* **deps:** bump undici from 7.27.0 to 7.28.0 ([#15](https://github.com/fran2889/flix-monkey/issues/15)) ([9d7ee80](https://github.com/fran2889/flix-monkey/commit/9d7ee8043d8f06910eedb6e9b0024dfafeec92d9))
* expand integration tests, fix IMDBAPI rate limit, add Title.type field ([#13](https://github.com/fran2889/flix-monkey/issues/13)) ([eec6f72](https://github.com/fran2889/flix-monkey/commit/eec6f72349a4f4c47c5c0cecb7eb639a6f2fb6ed))
* **firefox:** add required data_collection_permissions, bump min version to 140 ([3954fe7](https://github.com/fran2889/flix-monkey/commit/3954fe78b951f8da7cf23b987e6c6fb4f636d38a))
* stop caching not-found results from disabled clients and API errors ([99beded](https://github.com/fran2889/flix-monkey/commit/99bededd3c088e6ac0bb4035fbd7bc4f3ba02a19))
* **ui:** drop broken confirm dialogs and redundant menu items ([#28](https://github.com/fran2889/flix-monkey/issues/28)) ([09c8364](https://github.com/fran2889/flix-monkey/commit/09c8364b4212d5b874aaf0cc1c07eddd1aaadcf4))

## [1.0.1](https://github.com/fran2889/flix-monkey/compare/FlixMonkey-v1.0.0...FlixMonkey-v1.0.1) (2026-06-14)

### Bug Fixes

* **firefox:** add required data_collection_permissions to gecko manifest ([ca22789](../../commit/ca22789))

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
