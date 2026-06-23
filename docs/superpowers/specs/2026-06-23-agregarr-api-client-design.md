# Agregarr API Client Design

## Context

The current default ratings provider (`ImdbApiDevClient`, backed by `api.imdbapi.dev`) has low rate limits and is unreliable. Agregarr provides a free, keyless public API at `api.agregarr.org` that returns IMDb ratings and supports batch lookups (up to 100 IDs per request).

This spec covers replacing IMDb API Dev as the **default** ratings provider with Agregarr. IMDb API Dev remains available as a non-default option. Batch support is deferred to a follow-up.

## API Surface

### Search: IMDb Suggestions (title-only)

Resolves a Netflix display title to an IMDb ID.

```
GET https://v3.sg.media-imdb.com/suggestion/titles/x/{query}.json
```

- No authentication required.
- The path segment `x` is a fixed routing prefix.
- Returns `{ d: [{ id, l, qid, y, yr, ... }] }`.
- Filter results to `qid` in `['movie', 'tvSeries', 'tvMiniSeries']` — ignore shorts, videos, franchises.
- Use the first matching result.

### Ratings: Agregarr Public API

Fetches IMDb rating for a known IMDb ID.

```
GET https://api.agregarr.org/api/ratings?id={imdbId}
```

- No authentication required. CORS enabled (`Access-Control-Allow-Origin: *`).
- Returns `[{ imdbId, rating, votes }]`. Rating is `null` for unknown titles.
- Supports batching: multiple `id` params (up to 100). Not used in this initial implementation.
- Returns HTTP 400 for malformed IDs (non `tt`-prefixed).

### Rating Coverage

Agregarr returns **IMDb ratings only** (no Rotten Tomatoes, no Metacritic). Users who need RT/MC data should select OMDB or XMDB as their provider.

## New Class: `AgregarrApiClient`

Extends `BaseApiClient`. Follows the existing search-then-details template method pattern.

### `search(displayTitle)`

1. Lowercase and URI-encode the display title.
2. Call `queuedFetch` on `https://v3.sg.media-imdb.com/suggestion/titles/x/{encodedTitle}.json`.
3. Filter `response.d` to entries where `qid` is `movie`, `tvSeries`, or `tvMiniSeries`.
4. Return the first match or `null`.

### `getDetails(match, displayTitle)`

1. Extract `id` (IMDb ID), `l` (title), `qid` (type), `y` (year) from the match.
2. Call `queuedFetch` on `https://api.agregarr.org/api/ratings?id={id}`.
3. Extract the first element from the response array.
4. Return a `Title` with:
    - `apiTitle`: `match.l`
    - `imdbId`: `match.id`
    - `year`: `match.y`
    - `rating`: `response[0].rating`
    - `rtRating`: `null`
    - `mcRating`: `null`
    - `type`: mapped via existing `mapTitleType(match.qid)`

### Constructor

- Rate limit: `RATE_LIMITS[ApiSource.AGREGARR]` (250ms between requests, conservative estimate).
- No global sync key needed (no cross-tab coordination required for a keyless API).
- No `getStatus()` override needed — no API key to validate.

## Files Changed

### `src/core/constants.js`

- Add `AGREGARR: 'agregarr'` to `ApiSource`.
- Add `[ApiSource.AGREGARR]: 250` to `RATE_LIMITS`.

### `src/core/api-clients.js`

- Add `AgregarrApiClient` class (~50 lines).
- Export it.
- The `TITLE_TYPE_MAP` already handles `tvSeries` (mapped to `TitleType.SERIES`).
- Add `tvMiniSeries` mapping to `TITLE_TYPE_MAP` → `TitleType.SERIES`.

### `src/core/config-fields.js`

- Add `['agregarr', 'Agregarr']` to the `apiClient` options list, as the first entry.
- Change `default` from `'imdbapi'` to `'agregarr'`.

### `src/core/app.js`

- Import `AgregarrApiClient`.
- Add `[ApiSource.AGREGARR]: AgregarrApiClient` to the `clientMap` in `createApiClient()`.
- Change the fallback from `ImdbApiDevClient` to `AgregarrApiClient`.

### `src/targets/extension/domains.js`

- Add `'v3.sg.media-imdb.com'` and `'api.agregarr.org'` to `ALLOWED_DOMAINS`.

### `src/targets/chrome/manifest.json`

- Add `"https://v3.sg.media-imdb.com/*"` and `"https://api.agregarr.org/*"` to `host_permissions`.

### `src/targets/firefox/manifest.json`

- Add the same two entries to `host_permissions`.

### `src/targets/userscript/metadata.js`

- Add `// @connect v3.sg.media-imdb.com` and `// @connect api.agregarr.org`.

### Tests

- Add unit tests for `AgregarrApiClient` following the existing patterns in `tests/unit/core/api-clients.test.js`.
- Add integration test in `tests/integration/api-clients.test.js`.
- Update `tests/unit/core/config-fields.test.js` for the new default.

## Future Work (Not in Scope)

- **Batch support**: Add a generic `fetchBatch()` method to `BaseApiClient` and an accumulation layer in `ApiClientManager`. `AgregarrApiClient` would override `fetchBatch()` to batch up to 100 IMDb IDs per Agregarr request. This is the natural next step after this design ships.

## Verification

1. Unit tests: `npx vitest run tests/unit/core/api-clients.test.js`
2. Config tests: `npx vitest run tests/unit/core/config-fields.test.js`
3. Integration tests: `npx vitest run tests/integration/api-clients.test.js`
4. Build all targets: `npm run build`
5. Manual: load the extension/userscript, change provider to Agregarr, verify ratings appear on Netflix browse pages.
