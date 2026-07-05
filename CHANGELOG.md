# Changelog

## [1.3.0](https://github.com/fran2889/flix-monkey/compare/v1.2.0...v1.3.0) (2026-07-05)


### Features

* **api-clients:** replace IMDb suggestions API with FM-DB for Agregarr client ([#90](https://github.com/fran2889/flix-monkey/issues/90)) ([e0afb4d](https://github.com/fran2889/flix-monkey/commit/e0afb4de65da1bc6beb747e87f9f17dacca84c2f))
* **overlay:** add IMDb vote count to tooltip ([#93](https://github.com/fran2889/flix-monkey/issues/93)) ([7663342](https://github.com/fran2889/flix-monkey/commit/7663342b9b48d53d11079abdfd089012a20d4e5c))
* **surfaces:** move browse title detection from .fallback-text to aria-label, refactor surfaces ([#89](https://github.com/fran2889/flix-monkey/issues/89)) ([0174313](https://github.com/fran2889/flix-monkey/commit/01743137b8d0ee1807c3f19f1d9d37473aee272a))


### Bug Fixes

* **build,options:** eliminate dead code and fix webextension options close ([#88](https://github.com/fran2889/flix-monkey/issues/88)) ([174a953](https://github.com/fran2889/flix-monkey/commit/174a953830668b32c957a1b4176bf152cc5bfd33))

## [1.2.0](https://github.com/fran2889/flix-monkey/compare/v1.1.1...v1.2.0) (2026-07-01)


### Features

* add Agregarr as default ratings provider ([#35](https://github.com/fran2889/flix-monkey/issues/35)) ([d1f9b68](https://github.com/fran2889/flix-monkey/commit/d1f9b688196f75a3354540fbfc380b5da9d8d340))
* clean up error flow and add structured error logging ([#42](https://github.com/fran2889/flix-monkey/issues/42)) ([23683e8](https://github.com/fran2889/flix-monkey/commit/23683e8c97e713b3bb3cbb20d7d546ae03135820))
* **config:** enable debug logging by default ([#37](https://github.com/fran2889/flix-monkey/issues/37)) ([bd81fce](https://github.com/fran2889/flix-monkey/commit/bd81fce212b6a1f1408c98e235e03562ff91afdd))
* **config:** reduce default overlay clutter ([#85](https://github.com/fran2889/flix-monkey/issues/85)) ([9c4c0eb](https://github.com/fran2889/flix-monkey/commit/9c4c0eb3d6aa4cd38ef297d8b42d1b9638333e57))
* **overlay:** add per-title fade toggle to mini preview ([#73](https://github.com/fran2889/flix-monkey/issues/73)) ([e6ba2ce](https://github.com/fran2889/flix-monkey/commit/e6ba2ce09b84bed459b92767dd9f1f3fa6d6a538))


### Bug Fixes

* **api-clients:** guard against disable() between search and getDetails ([#55](https://github.com/fran2889/flix-monkey/issues/55)) ([455f492](https://github.com/fran2889/flix-monkey/commit/455f492eb4d95e078b8050e2c78b007832965e6a))
* **api-clients:** guard null element in parseRatings ([#47](https://github.com/fran2889/flix-monkey/issues/47)) ([a206ae8](https://github.com/fran2889/flix-monkey/commit/a206ae8658dadd824413d34f3070df3339c420c9))
* **api-clients:** remove redundant isDisabled check from fetch ([#54](https://github.com/fran2889/flix-monkey/issues/54)) ([0d44bcb](https://github.com/fran2889/flix-monkey/commit/0d44bcb2663d0567b51f5e4553225d5ee69f1497))
* **app:** guard document.contains before overlay injection ([#48](https://github.com/fran2889/flix-monkey/issues/48)) ([16f041d](https://github.com/fran2889/flix-monkey/commit/16f041dd1ca10614db22e9398cfbd8320d0b8bb8))
* **cache:** extract slugify helper and align deduplication key with cache key ([#44](https://github.com/fran2889/flix-monkey/issues/44)) ([ae05da7](https://github.com/fran2889/flix-monkey/commit/ae05da7ae724a635c87848795cfa6646ecfb22ea))
* **config:** enforce config defaults, normalize boolean reads, guard unknown keys ([#52](https://github.com/fran2889/flix-monkey/issues/52)) ([688d9bb](https://github.com/fran2889/flix-monkey/commit/688d9bba4b7e6cc9658026f53f5c45e15ae30910))
* **config:** guarantee numeric return from getInt and getFloat ([#45](https://github.com/fran2889/flix-monkey/issues/45)) ([b60bd8f](https://github.com/fran2889/flix-monkey/commit/b60bd8f69c1544f59d7702fb51106de69d3d3440))
* **css:** fix CSS issues across overlay and settings UI ([#83](https://github.com/fran2889/flix-monkey/issues/83)) ([c2e0157](https://github.com/fran2889/flix-monkey/commit/c2e0157950aff78d4b0fff51b13e0d6e01e01606))
* **logger:** normalize debug flag to handle string "true" from userscript host ([#49](https://github.com/fran2889/flix-monkey/issues/49)) ([1efba98](https://github.com/fran2889/flix-monkey/commit/1efba988afcf06e5f2ea1e691455821e6433f1c9))
* **modal:** defer DOM attachment from constructor to open() ([#64](https://github.com/fran2889/flix-monkey/issues/64)) ([b2f9228](https://github.com/fran2889/flix-monkey/commit/b2f9228c026348ba7931c9e16c5fe596cd399eea))
* **overlay:** unified visual-settings redecoration ([#53](https://github.com/fran2889/flix-monkey/issues/53)) ([a25a80a](https://github.com/fran2889/flix-monkey/commit/a25a80ac3495037f9afc488062b59133dfd30cca))
* **overlay:** use != null checks to preserve zero ratings ([#46](https://github.com/fran2889/flix-monkey/issues/46)) ([1ff2243](https://github.com/fran2889/flix-monkey/commit/1ff2243e469d05b0ced64321a86d8db72933cea3))
* **platform:** align storageGet contract to return null for missing keys ([#56](https://github.com/fran2889/flix-monkey/issues/56)) ([7734951](https://github.com/fran2889/flix-monkey/commit/7734951740484ad1a6946c378f8158f66d7c51ab))
* **request-queue:** re-read storage before claiming timeslot on no-wait path ([#43](https://github.com/fran2889/flix-monkey/issues/43)) ([d8f7359](https://github.com/fran2889/flix-monkey/commit/d8f735920dad6842ca51b55040334f06da82e003))
* **settings-ui:** show error feedback when clearCache or resetClients fails ([#63](https://github.com/fran2889/flix-monkey/issues/63)) ([67a7a4c](https://github.com/fran2889/flix-monkey/commit/67a7a4cda4428e9231dff97502df0828bf4e3eea))
* **utils:** guard window existence in runIdle ([#60](https://github.com/fran2889/flix-monkey/issues/60)) ([88bfb74](https://github.com/fran2889/flix-monkey/commit/88bfb74c4272b68da3629c3b84fb8f76c6588acb))
* **webextension:** clear httpFetch timeout after race settles ([#61](https://github.com/fran2889/flix-monkey/issues/61)) ([6e17224](https://github.com/fran2889/flix-monkey/commit/6e172244b65918e8efc3fae4ceecd47056450a73))

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
