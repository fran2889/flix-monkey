# Integration Tests Expansion + Title.type Field

## 1. Overview

Expand `tests/integration/api-clients.test.js` with additional test cases covering TV shows, invalid inputs, foreign titles, and non-ASCII characters. Simultaneously add a `type` property to `Title` (movie vs series) populated from each API's response, validated by these new integration tests. Fix empty-result handling in XMDB `getDetails()`.

## 2. Title.type Field

### 2.1 New Constant

Add `TitleType` to `src/core/constants.js`:

```js
export const TitleType = Object.freeze({
    MOVIE: 'movie',
    SERIES: 'series',
});
```

Only two values. Unrecognized API values map to `null`.

### 2.2 Title Constructor Change

Add a `type` parameter (default `null`) to the `Title` constructor in `src/core/title.js`:

```js
constructor({
    displayTitle = null,
    apiTitle = null,
    imdbId = null,
    year = null,
    rating = null,
    rtRating = null,
    mcRating = null,
    source = null,
    type = null,       // new
} = {}) {
    // ... existing fields ...
    this.type = type ?? null;
}
```

No normalization in Title — clients normalize before constructing. `Title.fromJSON` and cache serialization work automatically since `type` is a plain constructor parameter.

### 2.3 API Client Changes

Each client maps its API-specific type value to `TitleType.MOVIE` or `TitleType.SERIES` in `getDetails()`:

| Client             | API Field    | Mapping                                                    |
| ------------------ | ------------ | ---------------------------------------------------------- |
| `XmdbApiClient`    | `title_type` | `'Movie'` → `MOVIE`, `'TV Series'` → `SERIES`, else `null` |
| `OmdbApiClient`    | `Type`       | `'movie'` → `MOVIE`, `'series'` → `SERIES`, else `null`    |
| `ImdbApiDevClient` | `type`       | `'movie'` → `MOVIE`, `'tvSeries'` → `SERIES`, else `null`  |

Values observed from live API responses:

| API          | Movie value | TV Show value |
| ------------ | ----------- | ------------- |
| XMDB         | `"Movie"`   | `"TV Series"` |
| OMDB         | `"movie"`   | `"series"`    |
| IMDb API Dev | `"movie"`   | `"tvSeries"`  |

## 3. Error Handling Fixes

### 3.1 Integration test adapter — missing status check

The integration test adapter does not check HTTP status codes:

```js
httpFetch: async (url, options) => {
    const response = await fetch(url, options);
    return await response.json(); // no status check
};
```

Both production adapters (`UserscriptAdapter`, `WebExtensionAdapter`) throw for non-200 responses. The integration test adapter must match this behavior, otherwise non-200 error responses silently pass through to `getDetails()` as parsed JSON.

**Fix:** Throw for non-200, including the response body in the error message for logging:

```js
httpFetch: async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) {
        const body = await response.text();
        const err = new Error(`HTTP ${response.status}: ${body}`);
        err.status = response.status;
        throw err;
    }
    return await response.json();
};
```

### 3.2 XMDB empty 200 response

XMDB returns HTTP 200 with all-null fields for non-existent IDs (e.g. `tt0000000`). The current `getDetails` check `!detailsJson || detailsJson.error` does not catch this, causing a `Title` with all-null fields to be constructed and cached. The API echoes back the `id` even for empty results, but `title` is `null` — use that as the marker.

**Fix:** Add a `!detailsJson.title` check in `XmdbApiClient.getDetails()`:

```js
if (!detailsJson || detailsJson.error || !detailsJson.title) {
    return null;
}
```

Return `null` instead of throwing — this aligns with how `BaseApiClient.fetch()` already handles null from `getDetails()` (it returns null, which `ApiClientManager.getData()` then wraps as `Title.notFound()`).

IMDBAPI does not need a `getDetails` fix — with the corrected adapter, non-200 responses throw before reaching the response check.

## 4. Integration Test Cases

### 4.1 Credential Setup

Split the single `credentials` array into per-client groups:

```js
const xmdbCreds = ['XMDB_API_KEY'];
const omdbCreds = ['OMDB_API_KEY'];
// IMDBAPI: no credentials needed
```

### 4.2 Known IMDb IDs

Use exact IMDb IDs for assertions instead of regex matching:

| Title           | IMDb ID     |
| --------------- | ----------- |
| The Godfather   | `tt0068646` |
| Stranger Things | `tt4574334` |
| Amélie          | `tt0211915` |
| La Vita è Bella | `tt0118799` |

### 4.3 Test Matrix

7 test cases across 3 clients, grouped by feature. Tests call the API client methods directly (not through `ApiClientManager`).

#### Test 1 — Movie with all available ratings ("The Godfather")

Existing test, enhanced with `type` and exact ID assertions. Uses `fetch()`.

| Client  | IMDb    | RT      | MC      | type      |
| ------- | ------- | ------- | ------- | --------- |
| XMDB    | present | `null`  | present | `'movie'` |
| OMDB    | present | present | present | `'movie'` |
| IMDBAPI | present | `null`  | present | `'movie'` |

Assertions per client:

- `result instanceof Title`
- `displayTitle === 'The Godfather'`
- `apiTitle` contains `'Godfather'`
- `imdbId === 'tt0068646'`
- `year === 1972`
- `source` matches the client's `ApiSource`
- `type === 'movie'`
- `rating` is a number in range (0, 10]
- RT/MC: percentage rating assertions where present, `null` where not

#### Test 2 — TV show ("Stranger Things")

Uses `fetch()`. Tests that TV shows resolve correctly and `type` is `'series'`.

Assertions:

- `displayTitle === 'Stranger Things'`
- `apiTitle` contains `'Stranger'`
- `imdbId === 'tt4574334'`
- `year === 2016`
- `type === 'series'`
- `rating` is a number in range (0, 10]

#### Test 3 — Search with invalid title

Calls `search('xyznonexistenttitle12345')` directly.

All three clients: assert returns `null`.

#### Test 4 — Get details for invalid ID

Calls `getDetails()` directly with a non-existent but validly-formatted IMDb ID.

| Client  | Behavior                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| XMDB    | `getDetails({ id: 'tt0000000' })` — API returns 200 with all-null fields. With the new `!title` check, returns `null`. Assert `null`. |
| OMDB    | Skip — OMDB's `getDetails` takes `{ title }` not `{ id }`, always searches by title string.                                           |
| IMDBAPI | `getDetails({ id: 'tt0000000' })` — API returns an error (400/500). Current code throws. Assert rejects.                              |

#### Test 5 — Search with invalid API key

Tests that a bad API key produces an error.

| Client  | Method                                   | Behavior                                                                                                                  |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| XMDB    | `search('The Godfather')`                | API returns 401 → `queuedFetch` rejects. Assert rejects.                                                                  |
| OMDB    | `getDetails({ title: 'The Godfather' })` | `search()` is a passthrough that never hits the API, so test via `getDetails`. API returns 401 → rejects. Assert rejects. |
| IMDBAPI | Skip — no API key required.              |                                                                                                                           |

Invalid-key clients are constructed with a dedicated config that returns `'badkey123'` for key fields.

#### Test 6 — Non-ASCII title ("Amélie")

Uses `fetch()`. Tests URL encoding of non-ASCII characters (`é`).

All three clients: assert returns a valid `Title` with `imdbId === 'tt0211915'`, `rating` present as number in range (0, 10], `type === 'movie'`.

Do not assert exact `year` — OMDB reports 2002 (US release), XMDB/IMDBAPI report 2001 (French release).

#### Test 7 — Foreign original title ("La Vita è Bella")

Uses `fetch()`. Tests resolution of a non-English original title.

Assertions (XMDB + IMDBAPI):

- `result instanceof Title`
- `imdbId === 'tt0118799'`
- `year === 1997`
- `rating` is a number in range (0, 10]
- `type === 'movie'`

Assertions (OMDB): **OMDB does not reliably resolve original foreign-language titles** (it matched the wrong film in testing: a 1943 Italian film `tt0036502` instead of the 1997 Benigni film `tt0118799`). Assert that the result does NOT have `imdbId === 'tt0118799'`, so the test fails and alerts us if OMDB ever starts resolving this correctly.

### 4.4 Test Helpers

Update `expectCommonTitleFields` to accept a config object for flexible assertions:

```js
function expectCommonTitleFields(result, source, { displayTitle, apiTitleContains, imdbId, year, type }) {
    expect(result).toBeInstanceOf(Title);
    expect(result.displayTitle).toBe(displayTitle);
    if (apiTitleContains) expect(result.apiTitle).toContain(apiTitleContains);
    expect(result.imdbId).toBe(imdbId);
    if (year !== undefined) expect(result.year).toBe(year);
    expect(result.source).toBe(source);
    if (type !== undefined) expect(result.type).toBe(type);
    expectImdbRating(result.rating);
}
```

Existing `expectImdbRating` and `expectPercentageRating` helpers remain unchanged.

### 4.5 Test Structure

Tests are grouped by feature, not by client. Each `describe` block covers one test scenario with a sub-test per client.

```js
describe('api-clients integration', () => {
    // ... setup (configManager, adapter, disabledManager) ...

    describe('movie with all ratings', () => {
        it('XMDB');
        it('OMDB');
        it('IMDBAPI');
    });

    describe('TV show', () => {
        it('XMDB');
        it('OMDB');
        it('IMDBAPI');
    });

    describe('invalid title search', () => {
        it('XMDB');
        it('OMDB');
        it('IMDBAPI');
    });

    describe('invalid ID details', () => {
        it('XMDB');
        // OMDB skipped — uses title-based lookup, not ID
        it('IMDBAPI');
    });

    describe('invalid API key', () => {
        it('XMDB');
        it('OMDB');
        // IMDBAPI skipped — no API key required
    });

    describe('non-ASCII title', () => {
        it('XMDB');
        it('OMDB');
        it('IMDBAPI');
    });

    describe('foreign original title', () => {
        it('XMDB');
        it('OMDB — does not resolve to expected ID');
        it('IMDBAPI');
    });
});
```

Total: 19 test cases.

## 5. Unit Test Updates

Existing unit tests in `tests/unit/core/api-clients.test.js` will be updated to:

- Include `type` field in mock responses and assertions
- Update XMDB `getDetails` tests for the new `!title` null-return behavior

Existing unit tests in `tests/unit/core/title.test.js` will add cases for the new `type` constructor parameter.

## 6. Files Changed

| File                                    | Change                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `src/core/constants.js`                 | Add `TitleType` enum                                                             |
| `src/core/title.js`                     | Add `type` constructor parameter and property                                    |
| `src/core/api-clients.js`               | Extract and map type in `getDetails()`; add `!title` empty-result check in XMDB  |
| `tests/integration/api-clients.test.js` | Expand from 3 to 19 test cases, restructure into feature-grouped describe blocks |
| `tests/integration/api-clients.test.js` | Fix adapter `httpFetch` to throw on non-200 (match production behavior)          |
| `tests/unit/core/api-clients.test.js`   | Add `type` to mock responses/assertions; update for `!title` return behavior     |
| `tests/unit/core/title.test.js`         | Add `type` field tests                                                           |

## 7. API Investigation Notes

Data gathered from live API calls on 2026-06-18.

### Type field values

- **XMDB** details (`/api/v1/movies/{id}`): `title_type` field. Observed: `"Movie"`, `"TV Series"`.
- **OMDB** (`/?apikey=...&t=...`): `Type` field. Observed: `"movie"`, `"series"`. Also supports `"episode"`, `"game"`.
- **IMDb API Dev** (`/titles/{id}`): `type` field. Observed: `"movie"`, `"tvSeries"`, `"short"`, `"tvMovie"`, `"tvMiniSeries"`.

### OMDB search by ID

OMDB supports `i=<imdbId>` in addition to `t=<title>`. Live testing confirmed that both return identical responses — no additional fields. The passthrough-only search approach in `OmdbApiClient` remains correct.

### OMDB foreign title limitation

OMDB does not reliably resolve original foreign-language titles. Observed misresolutions:

- `"La Vita è Bella"` → matched a 1943 Italian film (`tt0036502`) instead of the 1997 Benigni film (`tt0118799`)
- `"El Laberinto del Fauno"` → matched a behind-the-scenes documentary (`tt7659908`) instead of the 2006 film (`tt0457430`)
- `"La Casa de Papel"` → matched a 2019 Brazilian movie (`tt26340796`) instead of the series (`tt6468322`)
- `"Das Leben der Anderen"` → not found at all

XMDB and IMDb API Dev resolve all of these correctly.

### Stranger Things ratings

Stranger Things has no Metacritic or Rotten Tomatoes ratings on any of the three APIs. Only IMDb rating (8.6) is available.

### Invalid ID behavior

- **XMDB** (`tt0000000`): Returns HTTP 200 with all-null fields (no `error` property). Current `getDetails` code does not detect this as an error.
- **IMDBAPI** (`tt9999999999`): Returns HTTP 400 with validation error. Valid-format IDs that don't exist may return 500.
- **OMDB** (`tt0000000`): Returns `{ Response: "False", Error: "Error getting data." }` — already handled by the existing `Response === 'False'` check.
