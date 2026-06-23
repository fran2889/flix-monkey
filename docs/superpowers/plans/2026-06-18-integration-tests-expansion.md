# Integration Tests Expansion + Title.type Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `type` field to `Title` (movie/series), fix error handling in the integration test adapter and XMDB `getDetails`, and expand integration tests from 3 to 19 cases covering TV shows, invalid inputs, foreign titles, and non-ASCII characters.

**Architecture:** `TitleType` enum in constants → `type` param in `Title` constructor → each API client maps its response's type field in `getDetails()`. Integration tests grouped by feature (not by client), each `describe` block has one `it` per API client.

**Tech Stack:** Vitest, Node.js `fetch`, dotenv for `.env` credentials.

## Global Constraints

- Every file in `src/` and `tests/` must begin with the GPL-3.0 license header matching `LICENSE_HEADER.template`.
- Conventional Commits enforced by commitlint. Format: `type(scope)?: description`.
- `npm test` runs all suites. `npm run test:unit` for unit only, `npm run test:integration` for integration only.
- Integration tests use real HTTP — no MSW mocking. Credentials from `.env` via `dotenv`. Tests skip gracefully via `hasCredentials()` when keys are absent.

---

### Task 1: Add `TitleType` constant and `type` field to `Title`

**Files:**

- Modify: `src/core/constants.js:36` (append before end)
- Modify: `src/core/title.js:18-46` (constructor)
- Modify: `tests/unit/core/title.test.js` (add type tests)

**Interfaces:**

- Produces: `TitleType.MOVIE` (`'movie'`), `TitleType.SERIES` (`'series'`) — used by Task 2
- Produces: `Title` constructor accepts `type` param, exposes `this.type` — used by Tasks 2, 3

- [x] **Step 1: Write failing unit tests for `Title.type`**

Add to `tests/unit/core/title.test.js`:

```javascript
describe('type field', () => {
    it('should default to null', () => {
        expect(new Title({}).type).toBeNull();
    });

    it('should accept a type value', () => {
        expect(new Title({ type: 'movie' }).type).toBe('movie');
    });

    it('should normalize undefined to null', () => {
        expect(new Title({ type: undefined }).type).toBeNull();
    });

    it('should round-trip through fromJSON', () => {
        const title = Title.fromJSON({ displayTitle: 'Test', type: 'series' });
        expect(title.type).toBe('series');
    });

    it('should be null on notFound titles', () => {
        expect(Title.notFound('Missing').type).toBeNull();
    });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run tests/unit/core/title.test.js`
Expected: FAIL — `type` property is undefined on Title instances.

- [x] **Step 3: Add `TitleType` to constants**

In `src/core/constants.js`, add after the `TOP_10_BADGE` line:

```javascript
export const TitleType = Object.freeze({
    MOVIE: 'movie',
    SERIES: 'series',
});
```

- [x] **Step 4: Add `type` to Title constructor**

In `src/core/title.js`, change the constructor destructuring to add `type = null` after `source = null`:

```javascript
constructor({
    displayTitle = null,
    apiTitle = null,
    imdbId = null,
    year = null,
    rating = null,
    rtRating = null,
    mcRating = null,
    source = null,
    type = null,
} = {}) {
```

Add after the `this.source = source ?? null;` line:

```javascript
this.type = type ?? null;
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --run tests/unit/core/title.test.js`
Expected: PASS

- [x] **Step 6: Run full unit suite to check for regressions**

Run: `npm run test:unit -- --run`
Expected: All tests PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/constants.js src/core/title.js tests/unit/core/title.test.js
git commit -m "feat: add TitleType constant and type field to Title"
```

---

### Task 2: Map type in API client `getDetails()` + XMDB empty-result fix

**Files:**

- Modify: `src/core/api-clients.js:1` (import), `147-164` (XMDB getDetails), `189-208` (OMDB getDetails), `234-253` (IMDBAPI getDetails)
- Modify: `tests/unit/core/api-clients.test.js` (update mocks and assertions)

**Interfaces:**

- Consumes: `TitleType` from `src/core/constants.js` (Task 1)
- Produces: Each client's `getDetails()` returns `Title` with `type` set — used by Task 3

- [x] **Step 1: Write failing unit tests for type mapping**

Add to `tests/unit/core/api-clients.test.js`. In the `XmdbApiClient` describe block, add:

```javascript
it('should map title_type to TitleType in getDetails', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi
            .fn()
            .mockResolvedValueOnce({ results: [{ type: 'title', id: 'tt1' }] })
            .mockResolvedValueOnce({
                id: 'tt1',
                title: 'Movie 1',
                title_type: 'Movie',
                release_year: 2020,
                rating: 8.0,
            }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.fetch('Movie 1');
    expect(result.type).toBe('movie');
});

it('should map TV Series title_type to series', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi
            .fn()
            .mockResolvedValueOnce({ results: [{ type: 'title', id: 'tt2' }] })
            .mockResolvedValueOnce({
                id: 'tt2',
                title: 'Show 1',
                title_type: 'TV Series',
                release_year: 2020,
                rating: 8.0,
            }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.fetch('Show 1');
    expect(result.type).toBe('series');
});

it('should return null for unknown title_type', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi
            .fn()
            .mockResolvedValueOnce({ results: [{ type: 'title', id: 'tt3' }] })
            .mockResolvedValueOnce({
                id: 'tt3',
                title: 'Short 1',
                title_type: 'Short Film',
                release_year: 2020,
            }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.fetch('Short 1');
    expect(result.type).toBeNull();
});

it('should return null when details response has no title', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValueOnce({
            id: 'tt0000000',
            title: null,
            title_type: null,
            release_year: null,
            rating: null,
        }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.getDetails({ id: 'tt0000000' }, 'nonexistent');
    expect(result).toBeNull();
});
```

In the `OmdbApiClient` describe block, add:

```javascript
it('should map Type to TitleType in getDetails', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            Response: 'True',
            imdbRating: '8.0',
            imdbID: 'tt123',
            Year: '2022',
            Title: 'OMDB Movie',
            Type: 'movie',
        }),
    });
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.getDetails({ title: 'OMDB Movie' }, 'OMDB Movie');
    expect(result.type).toBe('movie');
});

it('should map series Type to series', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            Response: 'True',
            imdbRating: '8.0',
            imdbID: 'tt456',
            Year: '2020',
            Title: 'OMDB Show',
            Type: 'series',
        }),
    });
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.getDetails({ title: 'OMDB Show' }, 'OMDB Show');
    expect(result.type).toBe('series');
});
```

In the `ImdbApiDevClient` describe block, add:

```javascript
it('should map type to TitleType in getDetails', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            id: 'tt1',
            primaryTitle: 'Movie',
            type: 'movie',
            startYear: 2026,
            rating: { aggregateRating: 8.5 },
        }),
    });
    const client = new ImdbApiDevClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.getDetails({ id: 'tt1' }, 'Movie');
    expect(result.type).toBe('movie');
});

it('should map tvSeries type to series', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            id: 'tt2',
            primaryTitle: 'Show',
            type: 'tvSeries',
            startYear: 2020,
            rating: { aggregateRating: 7.0 },
        }),
    });
    const client = new ImdbApiDevClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.getDetails({ id: 'tt2' }, 'Show');
    expect(result.type).toBe('series');
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run tests/unit/core/api-clients.test.js`
Expected: FAIL — `type` is `null` on all results, XMDB empty-title test returns a Title instead of null.

- [x] **Step 3: Add TitleType import and type mapping helper to api-clients.js**

In `src/core/api-clients.js`, update the constants import at line 3:

```javascript
import { ApiSource, RATE_LIMITS, CLIENT_DISABLE_DURATION, TitleType } from './constants.js';
```

Add after the `parseRatings` function (after line 26):

```javascript
const TITLE_TYPE_MAP = {
    Movie: TitleType.MOVIE,
    movie: TitleType.MOVIE,
    'TV Series': TitleType.SERIES,
    series: TitleType.SERIES,
    tvSeries: TitleType.SERIES,
};

function mapTitleType(apiValue) {
    return TITLE_TYPE_MAP[apiValue] ?? null;
}
```

- [x] **Step 4: Update XmdbApiClient.getDetails**

Replace the `getDetails` method in `XmdbApiClient` (lines 147-164):

```javascript
    async getDetails({ id, title: searchResultTitle }, displayTitle) {
        this.logger?.debug(`Fetching XMDB details for ID: ${id} ("${displayTitle}")`);
        const apiKey = this.config.get('xmdbApiKey');
        const detailsParams = new URLSearchParams({ apiKey });
        const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
        if (!detailsJson || detailsJson.error || !detailsJson.title) {
            return null;
        }
        const { rating, release_year, title, metascore, title_type } = detailsJson;
        return new Title({
            apiTitle: title ?? searchResultTitle ?? null,
            imdbId: id,
            year: release_year,
            rating,
            rtRating: null,
            mcRating: metascore ?? null,
            type: mapTitleType(title_type),
        });
    }
```

- [x] **Step 5: Update OmdbApiClient.getDetails**

Replace the `getDetails` method in `OmdbApiClient` (lines 189-208):

```javascript
    async getDetails({ title: t }, displayTitle) {
        const apiKey = this.config.get('omdbApiKey');
        const params = new URLSearchParams({ apikey: apiKey, t });
        this.logger?.debug(`Fetching OMDB details for title: "${t}"${displayTitle ? ` ("${displayTitle}")` : ''}`);
        const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
        if (json.Response === 'False') {
            this.logger?.debug(`No search results found in OMDB for: "${t}"`);
            return null;
        }
        const { imdbRating, Ratings, imdbID, Year, Title: apiTitle, Type: apiType } = json;
        const releaseYear = Year ? Year.match(/^\d{4}/)?.[0] : null;
        return new Title({
            apiTitle: apiTitle ?? null,
            imdbId: imdbID,
            year: releaseYear,
            rating: imdbRating,
            rtRating: parseRatings(Ratings, /Rotten Tomatoes/i),
            mcRating: parseRatings(Ratings, /Metacritic/i),
            type: mapTitleType(apiType),
        });
    }
```

- [x] **Step 6: Update ImdbApiDevClient.getDetails**

Replace the `getDetails` method in `ImdbApiDevClient` (lines 234-253):

```javascript
    async getDetails(match, displayTitle) {
        const { id } = match;
        this.logger?.debug(`Fetching IMDb API Dev details for ID: ${id} ("${displayTitle}")`);
        const detailsJson = await this.queuedFetch(`https://api.imdbapi.dev/titles/${id}`, 1);
        if (!detailsJson || detailsJson.error) {
            throw new Error(`IMDb API Dev details request failed for ID: ${id}`);
        }

        const { primaryTitle, startYear, rating, metacritic, type } = detailsJson;

        return new Title({
            apiTitle: primaryTitle ?? null,
            imdbId: id,
            year: startYear,
            rating: rating?.aggregateRating ?? null,
            rtRating: null,
            mcRating: metacritic?.score ?? null,
            type: mapTitleType(type),
        });
    }
```

- [x] **Step 7: Update existing unit test that checks XMDB error throw**

The existing test `'should throw if details fetch returns an error'` in the `XmdbApiClient` describe block mocks a response with `{ error: 'not found' }` and asserts it throws. With the new code it returns `null` instead. Update the assertion:

Find this test and change `await expect(client.getDetails({ id: 'm1' }, 'Movie 1')).rejects.toThrow()` to:

```javascript
it('should return null if details fetch returns an error', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValueOnce({ error: 'not found' }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        createMockLogger()
    );
    const result = await client.getDetails({ id: 'm1' }, 'Movie 1');
    expect(result).toBeNull();
});
```

- [x] **Step 8: Run tests to verify they pass**

Run: `npm run test:unit -- --run tests/unit/core/api-clients.test.js`
Expected: All PASS.

- [x] **Step 9: Run full unit suite**

Run: `npm run test:unit -- --run`
Expected: All PASS.

- [x] **Step 10: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "feat: map title type in API clients, fix XMDB empty-result handling"
```

---

### Task 3: Expand integration tests

**Files:**

- Modify: `tests/integration/api-clients.test.js` (rewrite)

**Interfaces:**

- Consumes: `TitleType` from `src/core/constants.js` (Task 1)
- Consumes: API clients return `Title` with `type` set (Task 2)

- [x] **Step 1: Rewrite the integration test file**

Replace the full contents of `tests/integration/api-clients.test.js`:

```javascript
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { hasCredentials } from './setup';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from '../../src/core/api-clients';
import { DisabledClientsManager } from '../../src/core/disabled-clients';
import { ConfigManager } from '../../src/core/config-manager';
import { Title } from '../../src/core/title';
import { createMockAdapter } from '../mocks/adapter.js';
import { ApiSource, TitleType } from '../../src/core/constants';

const xmdbCreds = ['XMDB_API_KEY'];
const omdbCreds = ['OMDB_API_KEY'];

const adapter = {
    httpFetch: async (url, options) => {
        const response = await fetch(url, options);
        if (!response.ok) {
            const body = await response.text();
            const err = new Error(`HTTP ${response.status}: ${body}`);
            err.status = response.status;
            throw err;
        }
        return await response.json();
    },
    storageGet: async () => '0',
    storageSet: async () => {},
};
const disabledManager = new DisabledClientsManager(adapter);

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

function expectImdbRating(rating, label = 'IMDb rating') {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThan(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(10);
}

function expectPercentageRating(rating, label) {
    expect(rating, `${label} missing`).toBeTypeOf('number');
    expect(rating, `${label} out of range`).toBeGreaterThanOrEqual(0);
    expect(rating, `${label} out of range`).toBeLessThanOrEqual(100);
}

describe('api-clients integration', () => {
    let configManager;
    let badKeyConfigManager;

    beforeAll(() => {
        const getter = key => {
            const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            return process.env[envKey] ?? null;
        };
        configManager = new ConfigManager(createMockAdapter({ configGet: getter }));
        badKeyConfigManager = new ConfigManager(createMockAdapter({ configGet: () => 'badkey123' }));
    });

    describe('movie with all ratings', () => {
        const TITLE = 'The Godfather';
        const common = {
            displayTitle: TITLE,
            apiTitleContains: 'Godfather',
            imdbId: 'tt0068646',
            year: 1972,
            type: TitleType.MOVIE,
        };

        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
            expectPercentageRating(result.mcRating, 'XMDB Metacritic');
            expect(result.rtRating).toBeNull();
        });

        it.skipIf(!hasCredentials(omdbCreds))('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
            expectPercentageRating(result.rtRating, 'OMDB Rotten Tomatoes');
            expectPercentageRating(result.mcRating, 'OMDB Metacritic');
        });

        it('IMDBAPI', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.IMDBAPI, common);
            expectPercentageRating(result.mcRating, 'IMDBAPI Metacritic');
            expect(result.rtRating).toBeNull();
        });
    });

    describe('TV show', () => {
        const TITLE = 'Stranger Things';
        const common = {
            displayTitle: TITLE,
            apiTitleContains: 'Stranger',
            imdbId: 'tt4574334',
            year: 2016,
            type: TitleType.SERIES,
        };

        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        it.skipIf(!hasCredentials(omdbCreds))('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
        });

        it('IMDBAPI', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.IMDBAPI, common);
        });
    });

    describe('invalid title search', () => {
        const TITLE = 'xyznonexistenttitle12345';

        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            expect(await client.search(TITLE)).toBeNull();
        });

        it.skipIf(!hasCredentials(omdbCreds))('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.getDetails({ title: TITLE }, TITLE);
            expect(result).toBeNull();
        });

        it('IMDBAPI', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            expect(await client.search(TITLE)).toBeNull();
        });
    });

    describe('invalid ID details', () => {
        const INVALID_ID = 'tt0000000';

        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.getDetails({ id: INVALID_ID }, 'nonexistent');
            expect(result).toBeNull();
        });

        it('IMDBAPI', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            await expect(client.getDetails({ id: INVALID_ID }, 'nonexistent')).rejects.toThrow();
        });
    });

    describe('invalid API key', () => {
        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, badKeyConfigManager);
            await expect(client.search('The Godfather')).rejects.toThrow();
        });

        it.skipIf(!hasCredentials(omdbCreds))('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, badKeyConfigManager);
            await expect(client.getDetails({ title: 'The Godfather' }, 'The Godfather')).rejects.toThrow();
        });
    });

    describe('non-ASCII title', () => {
        const TITLE = 'Amélie';
        const common = {
            displayTitle: TITLE,
            imdbId: 'tt0211915',
            type: TitleType.MOVIE,
        };

        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        it.skipIf(!hasCredentials(omdbCreds))('OMDB', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.OMDB, common);
        });

        it('IMDBAPI', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.IMDBAPI, common);
        });
    });

    describe('foreign original title', () => {
        const TITLE = 'La Vita è Bella';
        const EXPECTED_IMDB_ID = 'tt0118799';
        const common = {
            displayTitle: TITLE,
            imdbId: EXPECTED_IMDB_ID,
            year: 1997,
            type: TitleType.MOVIE,
        };

        it.skipIf(!hasCredentials(xmdbCreds))('XMDB', async () => {
            const client = new XmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.XMDB, common);
        });

        // OMDB does not reliably resolve original foreign-language titles.
        // It matched a 1943 Italian film (tt0036502) instead of the 1997 Benigni film.
        // Assert it does NOT resolve to the expected ID so the test alerts us if this changes.
        it.skipIf(!hasCredentials(omdbCreds))('OMDB — does not resolve to expected ID', async () => {
            const client = new OmdbApiClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expect(result).toBeInstanceOf(Title);
            expect(result.imdbId).not.toBe(EXPECTED_IMDB_ID);
        });

        it('IMDBAPI', async () => {
            const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
            const result = await client.fetch(TITLE);
            expectCommonTitleFields(result, ApiSource.IMDBAPI, common);
        });
    });
});
```

- [x] **Step 2: Run integration tests**

Run: `npm run test:integration -- --run`
Expected: All 19 tests PASS (or skip gracefully if credentials are missing).

- [x] **Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All suites PASS.

- [x] **Step 4: Commit**

```bash
git add tests/integration/api-clients.test.js
git commit -m "test: expand integration tests to 19 cases with type, error, and foreign title coverage"
```
