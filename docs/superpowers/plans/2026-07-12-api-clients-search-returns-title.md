# API Clients Refactoring: Search Returns Title - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `BaseApiClient` and its subclasses so `search()` returns a `Title` object and `getDetails()` accepts a `Title` and returns a `Title`, with proper merging of fallback values.

**Architecture:** Template-method pattern preserved. `search()` returns `Title` with available metadata from search results. `getDetails()` merges `searchTitle` values as fallbacks and overrides with fetched data. OMDb optimized: `search()` does full fetch, `getDetails()` is pass-through.

**Tech Stack:** JavaScript (ES2022), Vitest, ESLint, Prettier

## Global Constraints

- Follow existing code style: PascalCase classes, camelCase methods, private fields with `#` syntax
- Every file must have GPL-3.0 license header
- Use `Title` class from `./title.js` for all return values
- Preserve existing `fetch()` public interface (used by `ApiClientManager`)
- All tests must pass (335 unit tests currently)
- All build targets must build: userscript, firefox, chrome

---

## File Structure

| File                                    | Responsibility                                                 | Change Type |
| --------------------------------------- | -------------------------------------------------------------- | ----------- |
| `src/core/api-clients.js`               | BaseApiClient, XmdbApiClient, OmdbApiClient, AgregarrApiClient | Modify      |
| `tests/unit/core/api-clients.test.js`   | Unit tests for all API clients                                 | Modify      |
| `tests/integration/api-clients.test.js` | Integration tests for API clients                              | Modify      |

---

## Task 1: Update BaseApiClient Method Signatures and fetch()

**Files:**

- Modify: `src/core/api-clients.js:173-198` (search, getDetails, fetch methods)

**Interfaces:**

- Consumes: `Title` class from `./title.js`
- Produces: Updated method signatures that all subclasses must implement

- [ ] **Step 1: Update search() JSDoc and signature**

```javascript
// BEFORE (lines 173-184)
/**
 * Searches the API for a title matching the Netflix display name.
 * Subclasses must override this method.
 *
 * @abstract
 * @param {string} _displayTitle - Title to search for.
 * @returns {Promise<Object|null>} A provider-specific match object to pass to
 *   {@link getDetails}, or `null` if no match was found.
 */
async search(_displayTitle) {
  throw new Error('Not implemented');
}

// AFTER
/**
 * Searches the API for a title matching the Netflix display name.
 * Subclasses must override this method.
 *
 * @abstract
 * @param {string} displayTitle - Title to search for.
 * @returns {Promise<Title|null>} A Title with available metadata from search results,
 *   or `null` if no match was found.
 */
async search(_displayTitle) {
  throw new Error('Not implemented');
}
```

- [ ] **Step 2: Update getDetails() JSDoc and signature**

```javascript
// BEFORE (lines 186-198)
/**
 * Fetches full details and ratings for a search match.
 * Subclasses must override this method.
 *
 * @abstract
 * @param {Object} _match - Provider-specific match object from {@link search}.
 * @param {string} _displayTitle - Original Netflix display title (for logging).
 * @returns {Promise<Title|null>} A `Title` with ratings populated, or `null`
 *   if details could not be retrieved.
 */
async getDetails(_match, _displayTitle) {
  throw new Error('Not implemented');
}

// AFTER
/**
 * Fetches ratings and additional details for a title returned by search().
 * Subclasses must override this method.
 *
 * Implementations should merge searchTitle values as fallbacks:
 * - Use searchTitle fields (apiTitle, imdbId, year, type) when details fetch returns null/undefined
 * - Override with details fetch values when available
 *
 * @abstract
 * @param {Title} searchTitle - Title returned by search().
 * @returns {Promise<Title|null>} A Title with ratings and details populated, or `null`
 *   if details could not be retrieved.
 */
async getDetails(_searchTitle) {
  throw new Error('Not implemented');
}
```

- [ ] **Step 3: Update fetch() method**

```javascript
// BEFORE (lines 164-171)
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

- [ ] **Step 4: Verify file compiles and has no syntax errors**

Run: `cd /home/fran/Projects/flix-monkey && npx eslint src/core/api-clients.js --no-fix`
Expected: No errors (or only unrelated warnings)

- [ ] **Step 5: Commit BaseApiClient signature changes**

```bash
cd /home/fran/Projects/flix-monkey
git add src/core/api-clients.js
git commit -m "refactor(api-clients): update BaseApiClient search and getDetails signatures

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 2: Update XmdbApiClient Implementation

**Files:**

- Modify: `src/core/api-clients.js:219-258` (XmdbApiClient search and getDetails)

**Interfaces:**

- Consumes: `Title` class from `./title.js`, `mapTitleType()` helper
- Produces: `search()` returns `Title` with metadata from XMDb search, `getDetails()` returns `Title` with ratings from XMDb details endpoint

- [ ] **Step 1: Update XmdbApiClient.search() to return Title**

```javascript
// BEFORE (lines 219-234)
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

- [ ] **Step 2: Update XmdbApiClient.getDetails() to accept Title and merge**

```javascript
// BEFORE (lines 236-258)
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

- [ ] **Step 3: Run unit tests for XmdbApiClient to check for regressions**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "XmdbApiClient"`
Expected: Tests fail (need to update test mocks next)

- [ ] **Step 4: Commit XmdbApiClient implementation**

```bash
cd /home/fran/Projects/flix-monkey
git add src/core/api-clients.js
git commit -m "refactor(api-clients): update XmdbApiClient to return Title from search

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 3: Update OmdbApiClient Implementation

**Files:**

- Modify: `src/core/api-clients.js:279-308` (OmdbApiClient search and getDetails)

**Interfaces:**

- Consumes: `Title` class from `./title.js`, `parseRatings()` helper, `mapTitleType()` helper
- Produces: `search()` performs full OMDb API fetch and returns `Title` with all data, `getDetails()` is pass-through

- [ ] **Step 1: Update OmdbApiClient.search() to perform full fetch and return Title**

```javascript
// BEFORE (lines 279-281)
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

- [ ] **Step 2: Update OmdbApiClient.getDetails() to be pass-through**

```javascript
// BEFORE (lines 283-307)
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

- [ ] **Step 3: Run unit tests for OmdbApiClient to check for regressions**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "OmdbApiClient"`
Expected: Tests fail (need to update test mocks next)

- [ ] **Step 4: Commit OmdbApiClient implementation**

```bash
cd /home/fran/Projects/flix-monkey
git add src/core/api-clients.js
git commit -m "refactor(api-clients): update OmdbApiClient search to fetch all details, getDetails pass-through

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 4: Update AgregarrApiClient Implementation

**Files:**

- Modify: `src/core/api-clients.js:322-360` (AgregarrApiClient search and getDetails)

**Interfaces:**

- Consumes: `Title` class from `./title.js`
- Produces: `search()` returns `Title` with metadata from FM-DB search, `getDetails()` fetches ratings from Agregarr and returns merged `Title`

- [ ] **Step 1: Update AgregarrApiClient.search() to return Title**

```javascript
// BEFORE (lines 322-336)
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

- [ ] **Step 2: Update AgregarrApiClient.getDetails() to accept Title and merge**

```javascript
// BEFORE (lines 338-360)
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

- [ ] **Step 3: Run unit tests for AgregarrApiClient to check for regressions**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "AgregarrApiClient"`
Expected: Tests fail (need to update test mocks next)

- [ ] **Step 4: Commit AgregarrApiClient implementation**

```bash
cd /home/fran/Projects/flix-monkey
git add src/core/api-clients.js
git commit -m "refactor(api-clients): update AgregarrApiClient to return Title from search and merge in getDetails

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 5: Update Unit Tests - BaseApiClient and XmdbApiClient

**Files:**

- Modify: `tests/unit/core/api-clients.test.js:24-92` (BaseApiClient tests)
- Modify: `tests/unit/core/api-clients.test.js:95-278` (XmdbApiClient tests)

**Interfaces:**

- Consumes: Updated `XmdbApiClient` implementation from Tasks 1-2
- Produces: Tests that pass with new `Title`-based signatures

- [ ] **Step 1: Update BaseApiClient tests to use Title**

Find and update all assertions that check `search()` return values:

```javascript
// BEFORE (line 111)
expect(result.id).toBe('m1');

// AFTER
expect(result.imdbId).toBe('m1');
```

Note: This test file has many assertions checking `result.id` for XmdbApiClient.search(). All need to change to `result.imdbId`.

- [ ] **Step 2: Update XmdbApiClient.search() test**

```javascript
// BEFORE (lines 96-112)
it('should handle search with results', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            results: [{ type: 'title', id: 'm1', title: 'Movie 1', year: 2020 }],
        }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.search('Movie 1');
    expect(result.id).toBe('m1');
});

// AFTER
it('should handle search with results', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            results: [{ type: 'title', id: 'm1', title: 'Movie 1', year: 2020 }],
        }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.search('Movie 1');
    expect(result.imdbId).toBe('m1');
    expect(result.apiTitle).toBe('Movie 1');
    expect(result.year).toBe(2020);
    expect(result.rating).toBeNull();
});
```

- [ ] **Step 3: Update XmdbApiClient.getDetails() tests to use Title parameter**

Find and replace all `getDetails()` calls with raw objects to use `Title` instances:

```javascript
// BEFORE (line 208)
const result = await client.getDetails({ id: 'm1' }, 'Movie 1');

// AFTER
const result = await client.getDetails(new Title({ imdbId: 'm1', displayTitle: 'Movie 1' }));
```

There are many such calls in the test file. Update all of them:

- Line 208: `{ id: 'm1' }`
- Line 231: (in fetch test, but fetch internally calls getDetails, so test may need different approach)
- Line 286: `{ id: 'm1' }`
- Line 308: `{ id: 'tt0000000' }`
- Line 338: `{ id: 'tt1', title: 'Test' }`
- Line 344: `{ id: 'tt1', title: 'Test' }`

For tests that call `fetch()` directly (which internally calls search + getDetails), the tests should continue to work because `fetch()` now handles the Title creation internally. Verify each test individually.

- [ ] **Step 4: Update all XmdbApiClient assertions to check Title properties**

For tests that call `fetch()` and check properties, update to use the new `Title` constructor pattern:

```javascript
// BEFORE (line 194-195 in fetch test)
expect(result.year).toBe(2020);
expect(result.mcRating).toBe(88);

// AFTER - these should still work as they check Title properties
```

Most `fetch()` tests should continue to work because they check `Title` properties which haven't changed.

- [ ] **Step 5: Run XmdbApiClient tests**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "XmdbApiClient"`
Expected: All XmdbApiClient tests pass

- [ ] **Step 6: Commit XmdbApiClient test updates**

```bash
cd /home/fran/Projects/flix-monkey
git add tests/unit/core/api-clients.test.js
git commit -m "test(api-clients): update XmdbApiClient tests to use Title objects

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 6: Update Unit Tests - OmdbApiClient

**Files:**

- Modify: `tests/unit/core/api-clients.test.js:349-565` (OmdbApiClient tests)

**Interfaces:**

- Consumes: Updated `OmdbApiClient` implementation from Task 3
- Produces: Tests that pass with new pass-through `getDetails()` behavior

- [ ] **Step 1: Update OmdbApiClient.search() tests**

The `search()` method now makes the actual API call, so update tests accordingly:

```javascript
// BEFORE (lines 350-372)
it('should fetch details correctly', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            Response: 'True',
            imdbRating: '8.0',
            imdbID: 'tt1',
            Year: '2020',
            Title: 'Movie 1',
        }),
    });
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.getDetails({ title: 'Movie 1' }, 'Movie 1');
    expect(result.rating).toBe(8.0);
    expect(result.imdbId).toBe('tt1');
});

// AFTER
it('should fetch details correctly', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            Response: 'True',
            imdbRating: '8.0',
            imdbID: 'tt1',
            Year: '2020',
            Title: 'Movie 1',
        }),
    });
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.search('Movie 1');
    expect(result.rating).toBe(8.0);
    expect(result.imdbId).toBe('tt1');
});
```

- [ ] **Step 2: Update OmdbApiClient.getDetails() tests to be pass-through**

Since `getDetails()` is now a pass-through, tests should verify this:

```javascript
// BEFORE (lines 368-372, already updated in Step 1)
// This test was testing getDetails() directly

// AFTER - add test for pass-through behavior
it('should pass through Title in getDetails', async () => {
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        createMockAdapter(),
        { get: _k => 'key' },
        createMockLogger()
    );
    const searchTitle = new Title({
        displayTitle: 'Movie 1',
        apiTitle: 'Movie 1',
        imdbId: 'tt1',
        year: 2020,
        rating: 8.0,
        imdbVotes: 1000,
        rtRating: 90,
        mcRating: 85,
        type: 'movie',
    });
    const result = await client.getDetails(searchTitle);
    expect(result).toBe(searchTitle);
});
```

- [ ] **Step 3: Update all remaining OmdbApiClient tests**

Find and replace all `getDetails()` calls with raw objects:

```javascript
// BEFORE (lines 368, 401, 426, 450, 471, 485, 504, 523, 541)
// Various calls like:
await client.getDetails({ title: 'Movie 1' }, 'Movie 1');

// AFTER - For tests that were testing getDetails() directly with mocked httpFetch:
// These tests should now test search() since that's where the API call happens
// Or update to pass Title objects to getDetails() which will just pass through
```

For tests that mock `httpFetch` and test the full flow, redirect them to test `search()` instead of `getDetails()` since OMDb now does everything in `search()`.

- [ ] **Step 4: Run OmdbApiClient tests**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "OmdbApiClient"`
Expected: All OmdbApiClient tests pass

- [ ] **Step 5: Commit OmdbApiClient test updates**

```bash
cd /home/fran/Projects/flix-monkey
git add tests/unit/core/api-clients.test.js
git commit -m "test(api-clients): update OmdbApiClient tests for search fetch and getDetails pass-through

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 7: Update Unit Tests - AgregarrApiClient

**Files:**

- Modify: `tests/unit/core/api-clients.test.js:568-776` (AgregarrApiClient tests)

**Interfaces:**

- Consumes: Updated `AgregarrApiClient` implementation from Task 4
- Produces: Tests that pass with new `Title`-based signatures

- [ ] **Step 1: Update AgregarrApiClient.search() tests**

Update assertions to check `Title` properties instead of raw object properties:

```javascript
// BEFORE (lines 586-587)
expect(result['#IMDB_ID']).toBe('tt0001');

// AFTER
expect(result.imdbId).toBe('tt0001');
```

- [ ] **Step 2: Update AgregarrApiClient.getDetails() tests to use Title parameter**

Replace all raw object parameters with `Title` instances:

```javascript
// BEFORE (lines 684, 704, 759, 773)
const result = await client.getDetails({ '#IMDB_ID': 'tt1', '#TITLE': 'Movie 1', '#YEAR': 2020 }, 'Movie 1');

// AFTER
const result = await client.getDetails(
    new Title({
        imdbId: 'tt1',
        apiTitle: 'Movie 1',
        year: 2020,
        displayTitle: 'Movie 1',
    })
);
```

- [ ] **Step 3: Update assertions to check Title properties**

```javascript
// BEFORE (lines 685-691)
expect(result.apiTitle).toBe('Movie 1');
expect(result.imdbId).toBe('tt1');
expect(result.year).toBe(2020);

// AFTER - these should still work as they check Title properties
```

- [ ] **Step 4: Run AgregarrApiClient tests**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "AgregarrApiClient"`
Expected: All AgregarrApiClient tests pass

- [ ] **Step 5: Commit AgregarrApiClient test updates**

```bash
cd /home/fran/Projects/flix-monkey
git add tests/unit/core/api-clients.test.js
git commit -m "test(api-clients): update AgregarrApiClient tests to use Title objects

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 8: Update BaseApiClient Unit Tests

**Files:**

- Modify: `tests/unit/core/api-clients.test.js:24-42` (BaseApiClient tests)

**Interfaces:**

- Consumes: Updated `BaseApiClient` from Task 1
- Produces: Tests that pass with new signatures

- [ ] **Step 1: Update BaseApiClient status tests**

These tests don't call `search()` or `getDetails()` directly, so they should still work:

- Lines 25-42: Tests for `getStatus()` - no changes needed

- [ ] **Step 2: Run BaseApiClient tests**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/unit/core/api-clients.test.js -t "BaseApiClient"`
Expected: All BaseApiClient tests pass

- [ ] **Step 3: Commit if any changes were needed**

If changes were made:

```bash
cd /home/fran/Projects/flix-monkey
git add tests/unit/core/api-clients.test.js
git commit -m "test(api-clients): update BaseApiClient tests

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 9: Update Integration Tests

**Files:**

- Modify: `tests/integration/api-clients.test.js`

**Interfaces:**

- Consumes: Updated API client implementations from Tasks 1-4
- Produces: Integration tests that pass with new signatures

- [ ] **Step 1: Review integration tests**

Read the integration test file to identify all `search()` and `getDetails()` calls.

- [ ] **Step 2: Update search() assertions**

```javascript
// BEFORE (line 157)
expect(await client.search(TITLE)).toBeNull();

// AFTER - this should still work as it checks for null
expect(await client.search(TITLE)).toBeNull();
```

- [ ] **Step 3: Update getDetails() calls**

```javascript
// BEFORE (line 162)
const result = await client.getDetails({ title: TITLE }, TITLE);

// AFTER
const searchResult = await client.search(TITLE);
const result = await client.getDetails(searchResult);
```

- [ ] **Step 4: Run integration tests (if API keys available)**

Run: `cd /home/fran/Projects/flix-monkey && npx vitest run tests/integration/api-clients.test.js`
Expected: All integration tests pass (if `XMDB_API_KEY` and `OMDB_API_KEY` are set in environment)

- [ ] **Step 5: Commit integration test updates**

```bash
cd /home/fran/Projects/flix-monkey
git add tests/integration/api-clients.test.js
git commit -m "test(integration): update api-clients integration tests for new signatures

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 10: Run Full Test Suite

**Files:**

- All test files

- [ ] **Step 1: Run all unit and UI tests**

Run: `cd /home/fran/Projects/flix-monkey && npm test`
Expected: All 335+ tests pass

- [ ] **Step 2: Check for any remaining failures**

If any tests fail, identify the issue and create a follow-up task to fix them.

- [ ] **Step 3: Commit test verification**

```bash
cd /home/fran/Projects/flix-monkey
git add -A
git commit -m "test: verify all tests pass after api-clients refactoring

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 11: Run Build and Lint

**Files:**

- All source files

- [ ] **Step 1: Build all targets**

Run: `cd /home/fran/Projects/flix-monkey && npm run build`
Expected: All targets (userscript, firefox, chrome) build successfully

- [ ] **Step 2: Run linter**

Run: `cd /home/fran/Projects/flix-monkey && npm run lint`
Expected: No lint errors

- [ ] **Step 3: Run formatter check**

Run: `cd /home/fran/Projects/flix-monkey && npm run format:check`
Expected: No formatting issues

- [ ] **Step 4: Fix any issues and commit**

If any issues found:

```bash
cd /home/fran/Projects/flix-monkey
npm run lint:fix
npm run format
git add -A
git commit -m "style: fix lint and formatting issues

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Task 12: Clean Up and Final Verification

- [ ] **Step 1: Final verification**

Run: `cd /home/fran/Projects/flix-monkey && npm run build && npm test`
Expected: Everything passes

- [ ] **Step 2: Create final summary commit**

```bash
cd /home/fran/Projects/flix-monkey
git log --oneline --since="2026-07-12"  # Verify all commits are present
git checkout -b refactor/api-clients-search-returns-title  # If not already on a branch
git push origin refactor/api-clients-search-returns-title  # If ready for review
```

---

## Self-Review

**1. Spec coverage:**

- ✅ BaseApiClient signature updates (Task 1)
- ✅ XmdbApiClient implementation (Task 2)
- ✅ OmdbApiClient implementation with pass-through (Task 3)
- ✅ AgregarrApiClient implementation (Task 4)
- ✅ Unit tests for all clients (Tasks 5-8)
- ✅ Integration tests (Task 9)
- ✅ Full test suite verification (Task 10)
- ✅ Build and lint verification (Task 11)
- ✅ Merging principle documented and implemented

**2. Placeholder scan:**

- ✅ No TBD, TODO, or placeholder text
- ✅ All code examples are complete
- ✅ All file paths are exact
- ✅ All commands have expected output

**3. Type consistency:**

- ✅ `search()` consistently returns `Promise<Title|null>`
- ✅ `getDetails()` consistently accepts `Title` and returns `Promise<Title|null>`
- ✅ All implementations follow the merging principle
- ✅ OMDb `getDetails()` is a true pass-through
