# Agregarr TV Movies and TV Specials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve `tvMovie` and `tvSpecial` IMDb Suggestions results in the Agregarr provider and map both to `TitleType.MOVIE`.

**Architecture:** The provider has an explicit allowlist of accepted IMDb `qid` values and a separate mapper from `qid` to canonical `TitleType`. This change adds the two values to both lists, pins the behavior with unit tests, and updates the original design spec so its allowlist matches the code. Short-form values stay excluded.

**Tech Stack:** TypeScript (ES2022, ESM), Vitest, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-11-07-agregarr-tv-movie-special-design.md`

## Global Constraints

- Exclude `tvShort`, `short`, `video`, `videoGame`, `musicVideo`, and `podcastSeries`.
- Map `tvMovie` and `tvSpecial` to `TitleType.MOVIE`, exactly matching the existing `movie` mapping.
- Return the first supported result; do not change result ranking.
- Do not change the search URL, response parsing, rating lookup, or caching.
- No persisted data shape or cache key changes, so no migration.
- Preserve the SPDX header and the repo's ASCII-only, no-em-dash prose rules.
- Tests are required for every business-logic change.

## Review Focus

- A TV movie appears before a regular movie: the first supported result must win, so the TV movie is selected.
- The only result is `short` or `tvShort`: search must return `undefined` and log the existing info message, not produce a rating.
- A `tvSpecial` result has no `y` field: it must still resolve with an undefined year.
- A result uses mixed-case `qid` such as `TvMovie`: it must stay excluded because the API contract is exact-case.

---

### Task 1: Accept and map TV movies and TV specials

**Files:**

- Modify: `src/core/api/agregarr-api-client.ts:41`
- Modify: `src/core/api/title-type-mappers.ts:38-42`
- Test: `tests/unit/core/api/title-type-mappers.test.ts:52-71`
- Test: `tests/unit/core/api/agregarr-api-client.test.ts:42-74`
- Modify: `docs/superpowers/specs/2026-06-23-agregarr-api-client-design.md:22,50`

**Interfaces:**

- Consumes: `mapAgregarrTitleType(apiValue: string | undefined): TitleTypeType | undefined` and `AGREGARR_TITLE_TYPES: Set<string>` from the existing modules.
- Produces: `mapAgregarrTitleType('tvMovie')` and `mapAgregarrTitleType('tvSpecial')` return `TitleType.MOVIE`; `AGREGARR_TITLE_TYPES` contains both. No signature changes.

- [x] **Step 1: Update the mapper tests to expect the new values**

In `tests/unit/core/api/title-type-mappers.test.ts`, replace the `mapAgregarrTitleType` `movie` case with:

```ts
it.each(['movie', 'tvMovie', 'tvSpecial'])('should map %s to MOVIE', value => {
    expect(mapAgregarrTitleType(value)).toBe(TitleType.MOVIE);
});
```

Then change the unrecognised-value case to:

```ts
it.each(['tvShow', 'Movie', 'series', 'tvShort', 'short', 'videoGame'])(
    'should return undefined for unrecognised value %s',
    value => {
        expect(mapAgregarrTitleType(value)).toBeUndefined();
    }
);
```

- [x] **Step 2: Run the mapper test to verify it fails**

Run: `npx vitest run tests/unit/core/api/title-type-mappers.test.ts`
Expected: FAIL on `should map tvMovie to MOVIE` and `should map tvSpecial to MOVIE` because the mapper returns `undefined`.

- [x] **Step 3: Implement the mapper change**

In `src/core/api/title-type-mappers.ts`, change the first branch of `mapAgregarrTitleType` to:

```ts
if (apiValue === 'movie' || apiValue === 'tvMovie' || apiValue === 'tvSpecial') return TitleType.MOVIE;
```

- [x] **Step 4: Run the mapper test to verify it passes**

Run: `npx vitest run tests/unit/core/api/title-type-mappers.test.ts`
Expected: PASS.

- [x] **Step 5: Add the client tests**

In `tests/unit/core/api/agregarr-api-client.test.ts`, extend the existing `should map IMDb Suggestions %s results to %s` table with:

```ts
['tvMovie', 'movie'],
['tvSpecial', 'movie'],
```

Add these tests inside the top-level `describe('AgregarrApiClient', ...)`:

```ts
it('should use the first supported result even when it is a TV movie', async () => {
    const mockAdapter = buildMockAdapter()
        .withHttpFetchResolvingTo({
            d: [
                { id: 'tt1', l: 'TV Movie', qid: 'tvMovie', y: 2021 },
                { id: 'tt2', l: 'Regular Movie', qid: 'movie', y: 2022 },
            ],
        })
        .build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

    const result = await client.search('TV Movie');

    expect(result!.imdbId).toBe('tt1');
    expect(result!.type).toBe('movie');
});

it('should skip unsupported results before a TV special', async () => {
    const mockAdapter = buildMockAdapter()
        .withHttpFetchResolvingTo({
            d: [
                { id: 'tt0', l: 'Music Video', qid: 'musicVideo', y: 2020 },
                { id: 'tt1', l: 'Special', qid: 'tvSpecial', y: 2021 },
            ],
        })
        .build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

    const result = await client.search('Special');

    expect(result!.imdbId).toBe('tt1');
    expect(result!.type).toBe('movie');
});

it.each(['short', 'tvShort'])('should not accept %s IMDb Suggestions results', async qid => {
    const mockAdapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ d: [{ id: 'tt1', l: 'Short', qid, y: 2020 }] })
        .build();
    const mockLogger = buildLogger().build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter, logger: mockLogger });

    expect(await client.search('Short')).toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
        'No supported title-type results found in IMDb Suggestions for "Short"'
    );
});

it('should keep a TV special result that has no year', async () => {
    const mockAdapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ d: [{ id: 'tt1', l: 'Special', qid: 'tvSpecial' }] })
        .build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

    const result = await client.search('Special');

    expect(result!.imdbId).toBe('tt1');
    expect(result!.year).toBeUndefined();
    expect(result!.type).toBe('movie');
});

it.each(['TvMovie', 'TVSPECIAL'])('should not accept mixed-case %s results', async qid => {
    const mockAdapter = buildMockAdapter()
        .withHttpFetchResolvingTo({ d: [{ id: 'tt1', l: 'Title', qid, y: 2020 }] })
        .build();
    const client = new AgregarrApiClient({ ...deps, adapter: mockAdapter });

    expect(await client.search('Title')).toBeUndefined();
});
```

- [x] **Step 6: Run the client test to verify the new acceptance cases fail**

Run: `npx vitest run tests/unit/core/api/agregarr-api-client.test.ts`
Expected: FAIL on `should map IMDb Suggestions tvMovie results to movie`, `should map IMDb Suggestions tvSpecial results to movie`, the TV movie precedence case, and the TV special cases because `tvMovie`/`tvSpecial` are not in the allowlist.

- [x] **Step 7: Implement the allowlist change**

In `src/core/api/agregarr-api-client.ts`, change the constant to:

```ts
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvMovie', 'tvSpecial', 'tvSeries', 'tvMiniSeries']);
```

- [x] **Step 8: Run both targeted test files to verify they pass**

Run: `npx vitest run tests/unit/core/api/title-type-mappers.test.ts tests/unit/core/api/agregarr-api-client.test.ts`
Expected: PASS.

- [x] **Step 9: Update the original design spec's allowlist**

In `docs/superpowers/specs/2026-06-23-agregarr-api-client-design.md`:

Line 22 becomes:

```markdown
- Filter results to `qid` in `['movie', 'tvMovie', 'tvSpecial', 'tvSeries', 'tvMiniSeries']`; ignore shorts, videos, franchises.
```

Line 50 becomes:

```markdown
3. Filter `response.d` to entries where `qid` is `movie`, `tvMovie`, `tvSpecial`, `tvSeries`, or `tvMiniSeries`.
```

- [x] **Step 10: Run the full local gate**

Run: `npm run type-check && npm run lint && npm run format:check && npm run test:coverage`
Expected: all commands exit 0 and coverage meets the configured thresholds.

- [x] **Step 11: Commit**

```bash
git add src/core/api/agregarr-api-client.ts src/core/api/title-type-mappers.ts \
    tests/unit/core/api/title-type-mappers.test.ts tests/unit/core/api/agregarr-api-client.test.ts \
    docs/superpowers/specs/2026-06-23-agregarr-api-client-design.md \
    docs/superpowers/specs/2026-11-07-agregarr-tv-movie-special-design.md \
    docs/superpowers/plans/2026-11-07-agregarr-tv-movie-special.md
git commit -m "fix(api): accept TV movies and specials in Agregarr search"
```
