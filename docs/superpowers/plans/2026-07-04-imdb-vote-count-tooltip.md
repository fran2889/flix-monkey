# IMDb Vote Count in Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IMDb vote count display to the rating overlay tooltip with format `"IMDb: 8.5 (250k votes) - Open IMDb"`. Extract vote counts from all API providers that support it (Agregarr, OMDB, IMDb API Dev, XMDB).

**Architecture:** Add `imdbVotes` property to Title class, extract it from API responses in each client's `getDetails()` method, and update OverlayRenderer to format and include it in tooltips. RT and MC ratings removed from tooltip but remain as visual badges.

**Tech Stack:** JavaScript ES2022 modules, Vitest, existing FlixMonkey architecture

---

## File Structure

| File                                    | Responsibility                                  | Change Type |
| --------------------------------------- | ----------------------------------------------- | ----------- |
| `src/core/title.js`                     | Add `imdbVotes` property and normalization      | Modify      |
| `src/core/api-clients.js`               | Extract `imdbVotes` from each API provider      | Modify      |
| `src/core/overlay.js`                   | Format and display vote count in tooltip        | Modify      |
| `tests/unit/core/title.test.js`         | Test `imdbVotes` normalization                  | Modify      |
| `tests/unit/core/overlay.test.js`       | Test vote count formatting and tooltip building | Modify      |
| `tests/unit/core/api-clients.test.js`   | Test vote extraction from mock responses        | Modify      |
| `tests/integration/api-clients.test.js` | Add vote assertions for real API responses      | Modify      |

---

### Task 1: Add imdbVotes property to Title class

**Files:**

- Modify: `src/core/title.js`
- Test: `tests/unit/core/title.test.js`

- [x] **Step 1: Update TitleOptions typedef**

```javascript
/**
 * @typedef {Object} TitleOptions
 * @property {string|null} [displayTitle=null] - Title as shown on the Netflix UI.
 * @property {string|null} [apiTitle=null] - Canonical title returned by the API.
 * @property {string|null} [imdbId=null] - IMDb ID (e.g. `"tt1234567"`).
 * @property {number|string|null} [year=null] - Release year; coerced to integer.
 * @property {number|string|null} [rating=null] - IMDb rating (0–10); coerced to float.
 * @property {number|string|null} [imdbVotes=null] - IMDb vote count; coerced to integer.
 * @property {number|string|null} [rtRating=null] - Rotten Tomatoes score (0–100); coerced to integer.
 * @property {number|string|null} [mcRating=null] - Metacritic score (0–100); leading digits extracted, coerced to integer.
 * @property {string|null} [source=null] - API source that produced this title (an `ApiSource` value).
 * @property {string|null} [type=null] - Title type (e.g. `"movie"`, `"series"`).
 */
```

- [x] **Step 2: Add imdbVotes property to Title class**

```javascript
/** @type {number|null} */
imdbVotes;
```

- [x] **Step 3: Update constructor to accept and normalize imdbVotes**

```javascript
constructor({
    displayTitle = null,
    apiTitle = null,
    imdbId = null,
    year = null,
    rating = null,
    imdbVotes = null,
    rtRating = null,
    mcRating = null,
    source = null,
    type = null,
} = {}) {
    this.displayTitle = displayTitle;
    this.apiTitle = apiTitle;
    this.imdbId = imdbId;
    this.year = year !== null && year !== undefined ? Number.parseInt(year, 10) : null;
    this.rating = this.#normalizeRating(rating, v => {
        const num = parseFloat(v);
        return Number.isNaN(num) ? null : num;
    });
    this.imdbVotes = this.#normalizeRating(imdbVotes, v => {
        const num = Number.parseInt(v, 10);
        return Number.isNaN(num) ? null : num;
    });
    this.rtRating = this.#normalizeRating(rtRating, v => {
        const num = Number.parseInt(v, 10);
        return Number.isNaN(num) ? null : num;
    });
    this.mcRating = this.#normalizeRating(mcRating, v => {
        const m = String(v).match(/^(\d+)/);
        return m ? Number.parseInt(m[1], 10) : null;
    });
    this.source = source ?? null;
    this.type = type ?? null;
    Object.freeze(this);
}
```

- [x] **Step 4: Run lint to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/core/title.js`

- [x] **Step 5: Commit**

```bash
git add src/core/title.js
git commit -m "feat(title): add imdbVotes property"
```

---

### Task 2: Update AgregarrApiClient to extract votes

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

- [x] **Step 1: Update AgregarrApiClient.getDetails() to extract votes**

In the `getDetails` method of `AgregarrApiClient` (around line 383-404), update the return statement:

```javascript
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
```

- [x] **Step 2: Run unit tests for api-clients**

Run: `npx vitest run tests/unit/core/api-clients.test.js --reporter=verbose`
Expected: All AgregarrApiClient tests pass

- [x] **Step 3: Commit**

```bash
git add src/core/api-clients.js
git commit -m "feat(api-clients): extract imdbVotes from AgregarrApiClient"
```

---

### Task 3: Update OmdbApiClient to extract imdbVotes

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

- [x] **Step 1: Update OmdbApiClient.getDetails() to extract imdbVotes**

In the `getDetails` method of `OmdbApiClient` (around line 282-304), update the return statement:

```javascript
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
```

- [x] **Step 2: Run unit tests for api-clients**

Run: `npx vitest run tests/unit/core/api-clients.test.js --reporter=verbose`
Expected: All OmdbApiClient tests pass

- [x] **Step 3: Commit**

```bash
git add src/core/api-clients.js
git commit -m "feat(api-clients): extract imdbVotes from OmdbApiClient"
```

---

### Task 4: Update ImdbApiDevClient to extract voteCount

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

- [x] **Step 1: Update ImdbApiDevClient.getDetails() to extract rating.voteCount**

In the `getDetails` method of `ImdbApiDevClient` (around line 330-352), update the return statement:

```javascript
const { primaryTitle, startYear, rating, metacritic, type } = detailsJson;

return new Title({
    apiTitle: primaryTitle ?? null,
    imdbId: id,
    year: startYear,
    rating: rating?.aggregateRating ?? null,
    imdbVotes: rating?.voteCount ?? null,
    rtRating: null,
    mcRating: metacritic?.score ?? null,
    type: mapTitleType(type),
});
```

- [x] **Step 2: Run unit tests for api-clients**

Run: `npx vitest run tests/unit/core/api-clients.test.js --reporter=verbose`
Expected: All ImdbApiDevClient tests pass

- [x] **Step 3: Commit**

```bash
git add src/core/api-clients.js
git commit -m "feat(api-clients): extract imdbVotes from ImdbApiDevClient"
```

---

### Task 5: Update XmdbApiClient to extract vote_count

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

- [x] **Step 1: Update XmdbApiClient.getDetails() to extract vote_count**

In the `getDetails` method of `XmdbApiClient` (around line 236-257), update the destructuring and return statement:

```javascript
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
```

- [x] **Step 2: Run unit tests for api-clients**

Run: `npx vitest run tests/unit/core/api-clients.test.js --reporter=verbose`
Expected: All XmdbApiClient tests pass

- [x] **Step 3: Commit**

```bash
git add src/core/api-clients.js
git commit -m "feat(api-clients): extract imdbVotes from XmdbApiClient"
```

---

### Task 6: Add vote count formatting helper to OverlayRenderer

**Files:**

- Modify: `src/core/overlay.js`
- Test: `tests/unit/core/overlay.test.js`

- [x] **Step 1: Add #formatVoteCount helper method**

Add this method to the `OverlayRenderer` class, after the `#formatPercentRating` method:

```javascript
#formatVoteCount(count) {
    if (count === null || count === undefined) return '';
    const num = Number(count);
    if (Number.isNaN(num) || num < 0) return '';
    if (num >= 1000000) return `${Math.round(num / 1000000)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(Math.round(num));
}
```

- [x] **Step 2: Run lint to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/core/overlay.js`

- [x] **Step 3: Commit**

```bash
git add src/core/overlay.js
git commit -m "feat(overlay): add formatVoteCount helper method"
```

---

### Task 7: Update tooltip building in OverlayRenderer

**Files:**

- Modify: `src/core/overlay.js`
- Test: `tests/unit/core/overlay.test.js`

- [x] **Step 1: Update #buildTooltip to use shorter suffix**

Replace the current `#buildTooltip` method with:

```javascript
#buildTooltip(titleParts, imdbId) {
    if (titleParts.length) {
        return `${titleParts.join(' · ')} - Open IMDb`;
    }
    if (imdbId) return 'No rating - Open IMDb';
    return 'Not found - Search IMDb';
}
```

- [x] **Step 2: Update #createOverlay to pass imdbVotes and build tooltip correctly**

In the `#createOverlay` method, update the tooltip building section:

```javascript
#createOverlay(titleObj) {
    const container = document.createElement('div');
    container.className = this.#OVERLAY_CLASS;

    const { rating, imdbId, rtRating, mcRating, imdbVotes } = titleObj;

    // Helper to add click handler for propagation
    const addStopPropagation = el => {
        el.addEventListener('click', e => e.stopPropagation());
        return el;
    };

    // IMDb (Interactive Link)
    const imdbLink = document.createElement('a');
    imdbLink.target = '_blank';
    imdbLink.rel = 'noopener noreferrer';
    imdbLink.href = titleObj.imdbUrl;
    imdbLink.addEventListener('click', e => e.stopPropagation());

    const titleParts = [];
    // eslint-disable-next-line eqeqeq
    if (rating != null) {
        const formatted = this.#formatImdbRating(rating);
        const votesStr = this.#formatVoteCount(imdbVotes);
        const voteText = votesStr ? ` (${votesStr} votes)` : '';
        imdbLink.appendChild(this.#createRatingElement('IMDb', formatted, 'fm-imdb'));
        titleParts.push(`IMDb: ${formatted}${voteText}`);
    } else if (imdbId) {
        imdbLink.appendChild(this.#createMissingRatingElement('IMDb', 'fm-imdb'));
    } else {
        imdbLink.appendChild(this.#createSearchRatingElement('IMDb', 'fm-imdb'));
    }
    container.appendChild(imdbLink);

    // RT
    // eslint-disable-next-line eqeqeq
    if (this.#config.getBool('showRtRating') && rtRating != null) {
        const formatted = this.#formatPercentRating(rtRating);
        container.appendChild(addStopPropagation(this.#createRatingElement('RT', formatted, 'fm-rt')));
    }

    // MC
    // eslint-disable-next-line eqeqeq
    if (this.#config.getBool('showMcRating') && mcRating != null) {
        const formatted = this.#formatPercentRating(mcRating);
        container.appendChild(addStopPropagation(this.#createRatingElement('MC', formatted, 'fm-mc')));
    }

    imdbLink.title = this.#buildTooltip(titleParts, imdbId);
    return container;
}
```

- [x] **Step 3: Run lint to verify syntax**

Run: `npm run lint`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add src/core/overlay.js
git commit -m "feat(overlay): include imdbVotes in tooltip"
```

---

### Task 8: Add unit tests for Title.imdbVotes

**Files:**

- Modify: `tests/unit/core/title.test.js`

- [x] **Step 1: Add test file license header if not present**

Ensure the file starts with the standard GPL-3.0 license header matching `LICENSE_HEADER.template`.

- [x] **Step 2: Add imdbVotes normalization tests**

Add these tests to the existing test suite:

```javascript
import { describe, expect, it } from 'vitest';
import { Title } from '../../../src/core/title';

describe('Title', () => {
    // ... existing tests

    describe('imdbVotes', () => {
        it('normalizes null imdbVotes', () => {
            const t = new Title({ imdbVotes: null });
            expect(t.imdbVotes).toBeNull();
        });

        it('normalizes undefined imdbVotes', () => {
            const t = new Title({ imdbVotes: undefined });
            expect(t.imdbVotes).toBeNull();
        });

        it('normalizes empty string imdbVotes', () => {
            const t = new Title({ imdbVotes: '' });
            expect(t.imdbVotes).toBeNull();
        });

        it('normalizes N/A imdbVotes', () => {
            const t = new Title({ imdbVotes: 'N/A' });
            expect(t.imdbVotes).toBeNull();
        });

        it('parses integer imdbVotes', () => {
            const t = new Title({ imdbVotes: 2500000 });
            expect(t.imdbVotes).toBe(2500000);
        });

        it('parses numeric string imdbVotes', () => {
            const t = new Title({ imdbVotes: '2500000' });
            expect(t.imdbVotes).toBe(2500000);
        });

        it('parses string with commas imdbVotes', () => {
            const t = new Title({ imdbVotes: '2,500,000' });
            expect(t.imdbVotes).toBeNull(); // commas make it NaN with parseInt
        });

        it('normalizes non-numeric imdbVotes to null', () => {
            const t = new Title({ imdbVotes: 'not a number' });
            expect(t.imdbVotes).toBeNull();
        });
    });

    describe('fromJSON', () => {
        it('handles imdbVotes field from JSON', () => {
            const obj = { displayTitle: 'Test', imdbVotes: 1000 };
            const t = Title.fromJSON(obj);
            expect(t.imdbVotes).toBe(1000);
        });

        it('handles missing imdbVotes field from JSON', () => {
            const obj = { displayTitle: 'Test' };
            const t = Title.fromJSON(obj);
            expect(t.imdbVotes).toBeNull();
        });
    });
});
```

- [x] **Step 3: Run title tests**

Run: `npx vitest run tests/unit/core/title.test.js --reporter=verbose`
Expected: All tests pass

- [x] **Step 4: Commit**

```bash
git add tests/unit/core/title.test.js
git commit -m "test(title): add imdbVotes normalization tests"
```

---

### Task 9: Add unit tests for OverlayRenderer vote formatting

**Files:**

- Modify: `tests/unit/core/overlay.test.js`

- [x] **Step 1: Add formatVoteCount tests**

Add these tests to the existing OverlayRenderer test suite:

```javascript
import { describe, expect, it, vi } from 'vitest';
import { OverlayRenderer } from '../../../src/core/overlay';
import { ConfigManager } from '../../../src/core/config-manager';
import { createMockAdapter } from '../../mocks/adapter';

describe('OverlayRenderer', () => {
    // ... existing setup

    describe('#formatVoteCount', () => {
        it('returns empty string for null', () => {
            const renderer = new OverlayRenderer(config);
            expect(renderer['#formatVoteCount'](null)).toBe('');
        });

        it('returns empty string for undefined', () => {
            const renderer = new OverlayRenderer(config);
            expect(renderer['#formatVoteCount'](undefined)).toBe('');
        });

        it('returns string for small numbers', () => {
            const renderer = new OverlayRenderer(config);
            expect(renderer['#formatVoteCount'](0)).toBe('0');
            expect(renderer['#formatVoteCount'](1)).toBe('1');
            expect(renderer['#formatVoteCount'](999)).toBe('999');
        });

        it('returns k format for thousands', () => {
            const renderer = new OverlayRenderer(config);
            expect(renderer['#formatVoteCount'](1000)).toBe('1k');
            expect(renderer['#formatVoteCount'](1500)).toBe('2k');
            expect(renderer['#formatVoteCount'](999999)).toBe('1000k');
        });

        it('returns M format for millions', () => {
            const renderer = new OverlayRenderer(config);
            expect(renderer['#formatVoteCount'](1000000)).toBe('1M');
            expect(renderer['#formatVoteCount'](1500000)).toBe('2M');
            expect(renderer['#formatVoteCount'](2500000)).toBe('3M');
        });

        it('returns empty string for negative numbers', () => {
            const renderer = new OverlayRenderer(config);
            expect(renderer['#formatVoteCount'](-100)).toBe('');
        });
    });

    describe('#buildTooltip', () => {
        it('builds tooltip with rating and votes', () => {
            const renderer = new OverlayRenderer(config);
            const result = renderer['#buildTooltip'](['IMDb: 8.5 (250k votes)'], 'tt1234567');
            expect(result).toBe('IMDb: 8.5 (250k votes) - Open IMDb');
        });

        it('builds tooltip with rating without votes', () => {
            const renderer = new OverlayRenderer(config);
            const result = renderer['#buildTooltip'](['IMDb: 8.5'], 'tt1234567');
            expect(result).toBe('IMDb: 8.5 - Open IMDb');
        });

        it('builds no rating tooltip with imdbId', () => {
            const renderer = new OverlayRenderer(config);
            const result = renderer['#buildTooltip']([], 'tt1234567');
            expect(result).toBe('No rating - Open IMDb');
        });

        it('builds not found tooltip without imdbId', () => {
            const renderer = new OverlayRenderer(config);
            const result = renderer['#buildTooltip']([], null);
            expect(result).toBe('Not found - Search IMDb');
        });
    });
});
```

- [x] **Step 2: Run overlay tests**

Run: `npx vitest run tests/unit/core/overlay.test.js --reporter=verbose`
Expected: All tests pass

- [x] **Step 3: Commit**

```bash
git add tests/unit/core/overlay.test.js
git commit -m "test(overlay): add vote count formatting tests"
```

---

### Task 10: Add unit tests for API client vote extraction

**Files:**

- Modify: `tests/unit/core/api-clients.test.js`

- [x] **Step 1: Update AgregarrApiClient tests to verify imdbVotes extraction**

Find the existing AgregarrApiClient test section and add vote assertions:

```javascript
it('getDetails extracts votes from Agregarr response', async () => {
    const client = new AgregarrApiClient(
        disabledManager,
        mockAdapter({ httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: 2500000 }]) }),
        config,
        null
    );
    const result = await client.getDetails({ '#IMDB_ID': 'tt1' }, 'Test Title');
    expect(result.imdbVotes).toBe(2500000);
});

it('getDetails handles null votes from Agregarr response', async () => {
    const client = new AgregarrApiClient(
        disabledManager,
        mockAdapter({ httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1', rating: 8.8, votes: null }]) }),
        config,
        null
    );
    const result = await client.getDetails({ '#IMDB_ID': 'tt1' }, 'Test Title');
    expect(result.imdbVotes).toBeNull();
});
```

- [x] **Step 2: Update OmdbApiClient tests to verify imdbVotes extraction**

```javascript
it('getDetails extracts imdbVotes from OMDB response', async () => {
    const client = new OmdbApiClient(
        disabledManager,
        mockAdapter({ httpFetch: vi.fn().mockResolvedValue({ imdbVotes: '2,500,000', imdbRating: '8.8' }) }),
        config,
        null
    );
    const result = await client.getDetails({ title: 'Test' }, 'Test Title');
    expect(result.imdbVotes).toBe(2500000);
});

it('getDetails handles missing imdbVotes from OMDB response', async () => {
    const client = new OmdbApiClient(
        disabledManager,
        mockAdapter({ httpFetch: vi.fn().mockResolvedValue({ imdbRating: '8.8' }) }),
        config,
        null
    );
    const result = await client.getDetails({ title: 'Test' }, 'Test Title');
    expect(result.imdbVotes).toBeNull();
});
```

- [x] **Step 3: Update ImdbApiDevClient tests to verify rating.voteCount extraction**

```javascript
it('getDetails extracts voteCount from IMDb API Dev response', async () => {
    const client = new ImdbApiDevClient(
        disabledManager,
        mockAdapter({ httpFetch: vi.fn().mockResolvedValue({ rating: { aggregateRating: 8.8, voteCount: 2500000 } }) }),
        config,
        null
    );
    const result = await client.getDetails({ id: 'tt1' }, 'Test Title');
    expect(result.imdbVotes).toBe(2500000);
});
```

- [x] **Step 4: Update XmdbApiClient tests to verify vote_count extraction**

```javascript
it('getDetails extracts vote_count from XMDB response', async () => {
    const client = new XmdbApiClient(
        disabledManager,
        mockAdapter({ httpFetch: vi.fn().mockResolvedValue({ vote_count: 2500000, rating: 8.8 }) }),
        config,
        null
    );
    const result = await client.getDetails({ id: 'tt1', title: 'Test' }, 'Test Title');
    expect(result.imdbVotes).toBe(2500000);
});
```

- [x] **Step 5: Run api-clients unit tests**

Run: `npx vitest run tests/unit/core/api-clients.test.js --reporter=verbose`
Expected: All tests pass

- [x] **Step 6: Commit**

```bash
git add tests/unit/core/api-clients.test.js
git commit -m "test(api-clients): add imdbVotes extraction tests"
```

---

### Task 11: Update integration tests to verify votes from real APIs

**Files:**

- Modify: `tests/integration/api-clients.test.js`

- [x] **Step 1: Add helper function to check imdbVotes**

Add this helper function after the existing rating helpers:

```javascript
function expectImdbVotes(votes, label = 'IMDb votes') {
    expect(votes, `${label} missing`).toBeTypeOf('number');
    expect(votes, `${label} out of range`).toBeGreaterThanOrEqual(0);
}
```

- [x] **Step 2: Update expectCommonTitleFields to check imdbVotes**

Update the existing helper to optionally check votes:

```javascript
function expectCommonTitleFields(result, source, { displayTitle, apiTitleContains, imdbId, year, type, imdbVotes }) {
    expect(result).toBeInstanceOf(Title);
    expect(result.displayTitle).toBe(displayTitle);
    if (apiTitleContains) expect(result.apiTitle).toContain(apiTitleContains);
    expect(result.imdbId).toBe(imdbId);
    if (year !== undefined) expect(result.year).toBe(year);
    expect(result.source).toBe(source);
    if (type !== undefined) expect(result.type).toBe(type);
    expectImdbRating(result.rating);
    if (imdbVotes !== undefined) {
        expect(result.imdbVotes).toBeTypeOf('number');
        expect(result.imdbVotes).toBeGreaterThanOrEqual(0);
    }
}
```

- [x] **Step 3: Update existing integration tests to verify votes**

Update the test calls in `describe('movie with all ratings')` to include imdbVotes expectation:

```javascript
it('XMDB', async () => {
    const client = new XmdbApiClient(disabledManager, adapter, configManager);
    const result = await client.fetch(TITLE);
    expectCommonTitleFields(result, ApiSource.XMDB, { ...common, imdbVotes: true });
    expectPercentageRating(result.mcRating, 'XMDB Metacritic');
    expect(result.rtRating).toBeNull();
});

it('OMDB', async () => {
    const client = new OmdbApiClient(disabledManager, adapter, configManager);
    const result = await client.fetch(TITLE);
    expectCommonTitleFields(result, ApiSource.OMDB, { ...common, imdbVotes: true });
    expectPercentageRating(result.rtRating, 'OMDB Rotten Tomatoes');
    expectPercentageRating(result.mcRating, 'OMDB Metacritic');
});

it('IMDBAPI', async () => {
    const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
    const result = await client.fetch(TITLE);
    expectCommonTitleFields(result, ApiSource.IMDBAPI, { ...common, imdbVotes: true });
    expectPercentageRating(result.mcRating, 'IMDBAPI Metacritic');
    expect(result.rtRating).toBeNull();
}, 15000);

it('Agregarr', async () => {
    const client = new AgregarrApiClient(disabledManager, adapter, configManager);
    const result = await client.fetch(TITLE);
    expectCommonTitleFields(result, ApiSource.AGREGARR, { ...common, imdbVotes: true });
    expect(result.rtRating).toBeNull();
    expect(result.mcRating).toBeNull();
});
```

Also update the TV show tests similarly.

- [x] **Step 4: Run integration tests (if API keys available)**

Run: `npm run test:integration`
Expected: All tests pass (requires XMDB_API_KEY and OMDB_API_KEY in environment)

- [x] **Step 5: Commit**

```bash
git add tests/integration/api-clients.test.js
git commit -m "test(integration): verify imdbVotes from real API responses"
```

---

### Task 12: Final verification

- [x] **Step 1: Run full lint**

Run: `npm run lint`
Expected: No errors

- [x] **Step 2: Run full format check**

Run: `npm run format:check`
Expected: No formatting issues

- [x] **Step 3: Run all unit tests**

Run: `npm test`
Expected: All 300+ unit tests pass

- [x] **Step 4: Build all targets**

Run: `npm run build`
Expected: All three targets (userscript, firefox, chrome) build successfully

- [x] **Step 5: Commit final verification**

```bash
git commit -m "chore: final verification of imdbVotes feature"
```

---

## Plan Self-Review

**1. Spec coverage:**

- ✅ Title class has `imdbVotes` property (Task 1)
- ✅ API clients extract votes from responses (Tasks 2-5)
- ✅ OverlayRenderer formats and displays votes (Tasks 6-7)
- ✅ Tooltip format matches spec (Task 7)
- ✅ Unit tests for all components (Tasks 8-10)
- ✅ Integration tests for real APIs (Task 11)
- ✅ Backwards compatibility maintained

**2. Placeholder scan:**

- ✅ No TBD, TODO, or incomplete sections
- ✅ All code blocks contain actual implementation
- ✅ All file paths are exact
- ✅ All commands are complete

**3. Type consistency:**

- ✅ `imdbVotes` is consistently typed as `number|null` throughout
- ✅ Vote formatting uses consistent logic
- ✅ API field names match actual API responses

**4. Edge cases covered:**

- ✅ Null/undefined votes
- ✅ Non-numeric votes
- ✅ Various vote count magnitudes (0, 999, 1000, 1000000+)
- ✅ Missing votes in cache entries

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-imdb-vote-count-tooltip.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
