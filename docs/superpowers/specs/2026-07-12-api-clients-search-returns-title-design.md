# Design Specification: API Clients Refactoring - Search Returns Title

## Summary

Refactor `BaseApiClient` and its subclasses (`XmdbApiClient`, `OmdbApiClient`, `AgregarrApiClient`) so that:

1. `search(displayTitle)` returns a `Title` object with available metadata from search results (owns the search model)
2. `getDetails(searchTitle)` accepts a `Title` and returns a new `Title` with ratings and any additional details fetched, **merging with search Title values as fallbacks** (owns the details model)
3. OMDb-specific optimization: `search()` performs the full API fetch (including ratings) and `getDetails()` is a pass-through

## Motivation

### Current Issues

- `search()` returns provider-specific opaque objects (`{ id, title }` for XMDb, `{ title: displayTitle }` for OMDb, `{ '#IMDB_ID': ..., '#TITLE': ..., '#YEAR': ... }` for Agregarr)
- `getDetails()` accepts these opaque objects, requiring provider-specific destructuring
- No type safety between `search()` and `getDetails()` - the contract is implicit and provider-specific
- Tests must mock provider-specific objects, leading to inconsistency

### Desired State

- Clear separation of concerns: search owns identity (what the title is), details owns ratings (what the scores are)
- Type-safe contract between search and details using the existing `Title` class
- Consistent interface across all API providers
- Improved maintainability and easier testing

## Architecture Changes

### Before

```
fetch(displayTitle)
  ├─ search(displayTitle) → provider-specific object
  └─ getDetails(match, displayTitle) → Title
```

### After

```
fetch(displayTitle)
  ├─ search(displayTitle) → Title (with available metadata from search, ratings may be null)
  └─ getDetails(searchTitle) → Title (merges searchTitle as fallbacks, overrides with fetched details)
```

**Merging principle:** `getDetails()` implementations use `searchTitle` field values as fallbacks and override them with data fetched from the details endpoint when available. For OMDb, where `search()` already fetches all data, `getDetails()` is a simple pass-through.

## Key Principles

### Merging Behavior

`getDetails()` implementations must follow this merging pattern:

1. Extract data from the `searchTitle` parameter as fallback values
2. Fetch additional data from the API (ratings, potentially other fields)
3. Return a new `Title` where:
    - Fields from the API response override `searchTitle` fields when present
    - `searchTitle` fields are used as fallbacks when API response is null/undefined
    - `displayTitle` is always preserved from `searchTitle`

This ensures that any metadata obtained during search is not lost if the details endpoint doesn't return that particular field.

## Detailed Changes

### BaseApiClient (`src/core/api-clients.js`)

#### Method Signatures

```javascript
// BEFORE
/**
 * @param {string} _displayTitle
 * @returns {Promise<Object|null>}
 */
async search(_displayTitle) { /* abstract */ }

/**
 * @param {Object} _match
 * @param {string} _displayTitle
 * @returns {Promise<Title|null>}
 */
async getDetails(_match, _displayTitle) { /* abstract */ }

// AFTER
/**
 * Searches the API for a title matching the Netflix display name.
 * Returns a Title with basic metadata; ratings may or may not be populated
 * depending on the provider implementation.
 *
 * @param {string} displayTitle - Title to search for.
 * @returns {Promise<Title|null>} Title with metadata, or null if no match found.
 */
async search(_displayTitle) { /* abstract */ }

/**
 * Fetches ratings and additional details for a title returned by search().
 * For providers where search already fetches ratings (e.g., OMDb), this is a pass-through.
 *
 * Implementations should merge searchTitle values as fallbacks:
 * - Use searchTitle fields (apiTitle, imdbId, year, type) when details fetch returns null/undefined
 * - Override with details fetch values when available
 *
 * @param {Title} searchTitle - Title returned by search().
 * @returns {Promise<Title|null>} Title with ratings and details populated, or null if fetch failed.
 */
async getDetails(_searchTitle) { /* abstract */ }
```

#### fetch() Method Update

```javascript
// BEFORE
async fetch(displayTitle) {
  const match = await this.search(displayTitle);
  if (!match) return null;
  if (await this.isDisabled()) return null;
  const titleObj = await this.getDetails(match, displayTitle);
  if (!titleObj) return null;
  return Title.fromJSON({ ...titleObj, displayTitle, source: this.#source });
}

// AFTER
async fetch(displayTitle) {
  const searchTitle = await this.search(displayTitle);
  if (!searchTitle) return null;
  if (await this.isDisabled()) return null;
  const detailedTitle = await this.getDetails(searchTitle);
  if (!detailedTitle) return null;
  return new Title({ ...detailedTitle, source: this.#source });
}
```

### XmdbApiClient

#### search() Method

```javascript
// BEFORE
async search(displayTitle) {
  const apiKey = this.config.get('xmdbApiKey');
  const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: 5 });
  this.logger?.debug(`Searching XMDb for title: "${displayTitle}"`);
  const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
  if (!results?.length) {
    this.logger?.info(`No search results found in XMDb for "${displayTitle}"`);
    return null;
  }
  const titleResults = results.filter(r => r.type === 'title');
  if (!titleResults.length) {
    this.logger?.info(`No title-type results found in XMDb for "${displayTitle}"`);
    return null;
  }
  return titleResults[0];
}

// AFTER
async search(displayTitle) {
  const apiKey = this.config.get('xmdbApiKey');
  const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: 5 });
  this.logger?.debug(`Searching XMDb for title: "${displayTitle}"`);
  const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
  if (!results?.length) {
    this.logger?.info(`No search results found in XMDb for "${displayTitle}"`);
    return null;
  }
  const titleResults = results.filter(r => r.type === 'title');
  if (!titleResults.length) {
    this.logger?.info(`No title-type results found in XMDb for "${displayTitle}"`);
    return null;
  }
  const match = titleResults[0];
  return new Title({
    displayTitle,
    apiTitle: match.title ?? null,
    imdbId: match.id ?? null,
    year: match.release_year ?? match.year ?? null,
    rating: null,
    imdbVotes: null,
    rtRating: null,
    mcRating: null,
    type: null,
    source: null,
  });
}
```

#### getDetails() Method

```javascript
// BEFORE
async getDetails({ id, title: searchResultTitle }, displayTitle) {
  this.logger?.debug(`Fetching XMDb details for ID: ${id} ("${displayTitle}")`);
  const apiKey = this.config.get('xmdbApiKey');
  const detailsParams = new URLSearchParams({ apiKey });
  const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
  if (!detailsJson || detailsJson.error || !detailsJson.title) {
    this.logger?.warn(`XMDb details request failed for "${displayTitle}" (ID: ${id})`, {
      response: detailsJson ?? null,
    });
    return null;
  }
  const { rating, release_year, title, metascore, title_type, vote_count } = detailsJson;
  return new Title({
    apiTitle: title ?? searchResultTitle ?? null,
    imdbId: id,
    year: release_year,
    rating,
    imdbVotes: vote_count ?? null,
    rtRating: null,
    mcRating: metascore ?? null,
    type: mapTitleType(title_type),
  });
}

// AFTER
async getDetails(searchTitle) {
  const id = searchTitle.imdbId;
  this.logger?.debug(`Fetching XMDb details for ID: ${id} ("${searchTitle.displayTitle}")`);
  const apiKey = this.config.get('xmdbApiKey');
  const detailsParams = new URLSearchParams({ apiKey });
  const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
  if (!detailsJson || detailsJson.error || !detailsJson.title) {
    this.logger?.warn(`XMDb details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
      response: detailsJson ?? null,
    });
    return null;
  }
  const { rating, release_year, title, metascore, title_type, vote_count } = detailsJson;
  // Merge: use searchTitle values as fallbacks, override with details when available
  return new Title({
    displayTitle: searchTitle.displayTitle,
    apiTitle: title ?? searchTitle.apiTitle,
    imdbId: id ?? searchTitle.imdbId,
    year: release_year ?? searchTitle.year,
    rating,
    imdbVotes: vote_count ?? null,
    rtRating: null,
    mcRating: metascore ?? null,
    type: mapTitleType(title_type) ?? searchTitle.type,
    source: null,
  });
}
```

### OmdbApiClient

#### search() Method

OMDb fetches all details (including ratings) in a single API call, so `search()` performs the full fetch:

```javascript
// BEFORE
async search(displayTitle) {
  return { title: displayTitle };
}

// AFTER
async search(displayTitle) {
  const apiKey = this.config.get('omdbApiKey');
  const params = new URLSearchParams({ apikey: apiKey, t: displayTitle });
  this.logger?.debug(`Searching OMDb for title: "${displayTitle}"`);
  const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
  if (json.Response === 'False') {
    this.logger?.info(`No OMDb results found for "${displayTitle}"`);
    return null;
  }
  const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
  const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
  const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replace(/,/g, ''), 10) : null;
  return new Title({
    displayTitle,
    apiTitle: apiTitle ?? null,
    imdbId: imdbID ?? null,
    year: releaseYear,
    rating: imdbRating,
    imdbVotes: votes,
    rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
    mcRating: parseRatings(Ratings, /Metacritic/i),
    type: mapTitleType(apiType),
    source: null,
  });
}
```

#### getDetails() Method

Since `search()` already fetched all details, `getDetails()` is a pass-through:

```javascript
// BEFORE
async getDetails({ title: t }, displayTitle) {
  const apiKey = this.config.get('omdbApiKey');
  const params = new URLSearchParams({ apikey: apiKey, t });
  this.logger?.debug(`Fetching OMDb details for title: "${t}"`);
  const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
  if (json.Response === 'False') {
    this.logger?.warn(`OMDb details request failed for "${displayTitle}"`, {
      response: json,
    });
    return null;
  }
  const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType, imdbVotes: rawImdbVotes } = json;
  const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
  const votes = rawImdbVotes ? Number.parseInt(String(rawImdbVotes).replace(/,/g, ''), 10) : null;
  return new Title({
    apiTitle: apiTitle ?? null,
    imdbId: imdbID,
    year: releaseYear,
    rating: imdbRating,
    imdbVotes: votes,
    rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
    mcRating: parseRatings(Ratings, /Metacritic/i),
    type: mapTitleType(apiType),
  });
}

// AFTER
async getDetails(searchTitle) {
  // Pass-through: OMDb already fetched all details (including ratings) in search()
  return searchTitle;
}
```

### AgregarrApiClient

#### search() Method

```javascript
// BEFORE
async search(displayTitle) {
  const encoded = encodeURIComponent(displayTitle);
  this.logger?.debug(`Searching FM-DB for title: "${displayTitle}"`);
  const data = await this.queuedFetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encoded}`, 0);
  if (!data?.ok) {
    this.logger?.info(`FM-DB search request failed for "${displayTitle}"`);
    return null;
  }
  const results = data?.description;
  if (!results?.length) {
    this.logger?.info(`No search results found in FM-DB for "${displayTitle}"`);
    return null;
  }
  return results[0];
}

// AFTER
async search(displayTitle) {
  const encoded = encodeURIComponent(displayTitle);
  this.logger?.debug(`Searching FM-DB for title: "${displayTitle}"`);
  const data = await this.queuedFetch(`https://imdb.iamidiotareyoutoo.com/search?q=${encoded}`, 0);
  if (!data?.ok) {
    this.logger?.info(`FM-DB search request failed for "${displayTitle}"`);
    return null;
  }
  const results = data?.description;
  if (!results?.length) {
    this.logger?.info(`No search results found in FM-DB for "${displayTitle}"`);
    return null;
  }
  const match = results[0];
  return new Title({
    displayTitle,
    apiTitle: match['#TITLE'] ?? null,
    imdbId: match['#IMDB_ID'] ?? null,
    year: match['#YEAR'] ?? null,
    rating: null,
    imdbVotes: null,
    rtRating: null,
    mcRating: null,
    type: null,
    source: null,
  });
}
```

#### getDetails() Method

```javascript
// BEFORE
async getDetails(match, displayTitle) {
  const id = match['#IMDB_ID'];
  const title = match['#TITLE'];
  const year = match['#YEAR'];
  this.logger?.debug(`Fetching Agregarr details for ID: ${id} ("${displayTitle}")`);
  const ratings = await this.queuedFetch(`https://api.agregarr.org/api/ratings?id=${encodeURIComponent(id)}`, 1);
  const entry = ratings?.[0];
  if (!entry) {
    this.logger?.warn(`Agregarr details request failed for "${displayTitle}" (ID: ${id})`, {
      response: ratings ?? null,
    });
  }
  return new Title({
    apiTitle: title ?? null,
    imdbId: id,
    year: year ?? null,
    rating: entry?.rating ?? null,
    imdbVotes: entry?.votes ?? null,
    rtRating: null,
    mcRating: null,
    type: null,
  });
}

// AFTER
async getDetails(searchTitle) {
  const id = searchTitle.imdbId;
  this.logger?.debug(`Fetching Agregarr details for ID: ${id} ("${searchTitle.displayTitle}")`);
  const ratings = await this.queuedFetch(`https://api.agregarr.org/api/ratings?id=${encodeURIComponent(id)}`, 1);
  const entry = ratings?.[0];
  if (!entry) {
    this.logger?.warn(`Agregarr details request failed for "${searchTitle.displayTitle}" (ID: ${id})`, {
      response: ratings ?? null,
    });
    return null;
  }
  // Merge: use searchTitle values as fallbacks, override with details when available
  return new Title({
    displayTitle: searchTitle.displayTitle,
    apiTitle: searchTitle.apiTitle,
    imdbId: id ?? searchTitle.imdbId,
    year: searchTitle.year,
    rating: entry?.rating ?? null,
    imdbVotes: entry?.votes ?? null,
    rtRating: null,
    mcRating: null,
    type: searchTitle.type,
    source: null,
  });
}
```

## Test Changes

### Unit Tests (`tests/unit/core/api-clients.test.js`)

All test assertions and mocks that reference `search()` or `getDetails()` need updating:

1. **search() tests**: Change from asserting on provider-specific object properties to asserting on `Title` properties
    - Example: `expect(result.id).toBe('m1')` → `expect(result.imdbId).toBe('m1')`

2. **getDetails() tests**: Change from passing raw objects to passing `Title` instances
    - Example: `client.getDetails({ id: 'm1' }, 'Movie 1')` → `client.getDetails(new Title({ imdbId: 'm1', displayTitle: 'Movie 1', ... }))`

3. **OMDb-specific**: Tests for `getDetails()` should now expect pass-through behavior

### Integration Tests (`tests/integration/api-clients.test.js`)

Similar changes to unit tests - update mocks and assertions to use `Title` objects.

## Benefits

1. **Type safety**: `Title` is the well-defined contract between `search()` and `getDetails()` across all providers
2. **Separation of concerns**: Search owns the "what" (identity), details owns the "scores" (ratings)
3. **Consistency**: All providers use the same `Title` type for intermediate representation
4. **Maintainability**: Easier to add new providers or modify existing ones
5. **Testability**: Tests work with a consistent `Title` type instead of provider-specific objects
6. **OMDb optimization**: Eliminates redundant API call pattern for OMDb

## Risks and Mitigations

| Risk                                           | Mitigation                                     |
| ---------------------------------------------- | ---------------------------------------------- |
| Breaking existing tests                        | Update all test files in the same PR           |
| Performance impact from creating Title objects | Negligible - Title construction is lightweight |
| Missed edge cases in provider implementations  | Comprehensive test coverage for each provider  |

## Success Criteria

1. All unit tests pass (335 tests currently)
2. All integration tests pass (if API keys available)
3. All build targets (userscript, firefox, chrome) build successfully
4. No regressions in functionality - ratings still appear correctly on Netflix thumbnails

## Out of Scope

- Changes to the `Title` class itself
- Changes to `ApiClientManager` (consumes `fetch()`, which remains stable)
- Changes to any other modules that don't directly interact with `search()` or `getDetails()`

## Open Questions

None identified at this time.
