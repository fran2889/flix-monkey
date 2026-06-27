# Agregarr API Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Agregarr as the new default ratings provider, replacing the unreliable IMDb API Dev client.

**Architecture:** Two-step flow: IMDb Suggestions API resolves Netflix display title to IMDb ID, then Agregarr public API fetches the IMDb rating. Both APIs are keyless. The new `AgregarrApiClient` extends `BaseApiClient` using the same search→getDetails template as all other clients.

**Tech Stack:** Vanilla JS (ES modules), Vitest for tests. Browser extension + userscript targets.

**Spec:** `docs/superpowers/specs/2026-06-23-agregarr-api-client-design.md`

## Global Constraints

- IMDb API Dev (`ImdbApiDevClient`) stays as a non-default selectable option
- Agregarr returns IMDb ratings only (no RT, no Metacritic) — `rtRating` and `mcRating` are `null`
- No API keys required for either endpoint
- IMDb Suggestions titles-only URL pattern: `https://v3.sg.media-imdb.com/suggestion/titles/{firstChar}/{encodedQuery}.json`
- Agregarr ratings URL: `https://api.agregarr.org/api/ratings?id={imdbId}`
- All source files require the GPLv3 copyright header (copy from any existing source file)

---

### Task 1: Constants and TITLE_TYPE_MAP updates

**Files:**

- Modify: `src/core/constants.js`
- Modify: `src/core/api-clients.js` (TITLE_TYPE_MAP only)

**Interfaces:**

- Produces: `ApiSource.AGREGARR` (`'agregarr'`), `RATE_LIMITS[ApiSource.AGREGARR]` (`250`), `TITLE_TYPE_MAP` entry for `tvMiniSeries`

- [x] **Step 1: Add AGREGARR to ApiSource and RATE_LIMITS**

In `src/core/constants.js`, add the new source:

```js
export const ApiSource = Object.freeze({
    XMDB: 'xmdb',
    OMDB: 'omdb',
    IMDBAPI: 'imdbapi',
    AGREGARR: 'agregarr',
});

export const RATE_LIMITS = {
    [ApiSource.XMDB]: 1500,
    [ApiSource.OMDB]: 250,
    [ApiSource.IMDBAPI]: 4000,
    [ApiSource.AGREGARR]: 250,
};
```

- [x] **Step 2: Add tvMiniSeries to TITLE_TYPE_MAP**

In `src/core/api-clients.js`, add the mapping:

```js
const TITLE_TYPE_MAP = {
    Movie: TitleType.MOVIE,
    movie: TitleType.MOVIE,
    'TV Series': TitleType.SERIES,
    series: TitleType.SERIES,
    tvSeries: TitleType.SERIES,
    tvMiniSeries: TitleType.SERIES,
};
```

- [x] **Step 3: Run existing tests to confirm no regressions**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: All existing tests PASS.

- [x] **Step 4: Commit**

```bash
git add src/core/constants.js src/core/api-clients.js
git commit -m "feat: add Agregarr to ApiSource and RATE_LIMITS, add tvMiniSeries mapping"
```

---

### Task 2: Add AgregarrApiClient class

**Files:**

- Modify: `src/core/api-clients.js`
- Create: `tests/unit/core/agregarr-api-client.test.js` (or add to existing test file)

**Interfaces:**

- Consumes: `BaseApiClient`, `RequestQueue`, `ApiSource.AGREGARR`, `RATE_LIMITS[ApiSource.AGREGARR]`, `Title`, `mapTitleType`
- Produces: `AgregarrApiClient` class (exported)

- [x] **Step 1: Write failing tests for AgregarrApiClient.search**

Add to `tests/unit/core/api-clients.test.js`:

```js
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient, AgregarrApiClient } from '../../../src/core/api-clients.js';

// ... existing tests ...

describe('AgregarrApiClient', () => {
    it('should return the first movie/series result from suggestions', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [
                    { id: 'tt1375666', l: 'Inception', qid: 'movie', y: 2010 },
                    { id: 'tt1790736', l: 'Inception: The Cobol Job', qid: 'video', y: 2010 },
                ],
            }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.search('Inception');
        expect(result.id).toBe('tt1375666');
        expect(result.l).toBe('Inception');
    });

    it('should filter out non-title results like videos and shorts', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [
                    { id: 'tt0001', l: 'Some Video', qid: 'video', y: 2020 },
                    { id: 'tt0002', l: 'Some Short', qid: 'short', y: 2020 },
                    { id: 'tt0003', l: 'The Real Movie', qid: 'movie', y: 2020 },
                ],
            }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.search('Some Movie');
        expect(result.id).toBe('tt0003');
    });

    it('should accept tvMiniSeries results', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({
                d: [{ id: 'tt9999', l: 'Mini Show', qid: 'tvMiniSeries', y: 2023 }],
            }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        const result = await client.search('Mini Show');
        expect(result.id).toBe('tt9999');
    });

    it('should return null if no title results found', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ d: [] }),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('xyznonexistent')).toBeNull();
    });

    it('should return null if suggestions response has no d array', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({}),
        });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        expect(await client.search('anything')).toBeNull();
    });

    it('should build correct IMDb suggestions URL', async () => {
        const httpFetch = vi.fn().mockResolvedValue({ d: [] });
        const mockAdapter = createMockAdapter({ httpFetch });
        const client = new AgregarrApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            undefined,
            createMockLogger()
        );
        await client.search('The Matrix');
        const calledUrl = httpFetch.mock.calls[0][0];
        expect(calledUrl).toContain('v3.sg.media-imdb.com/suggestion/titles/t/');
        expect(calledUrl).toContain('.json');
    });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: FAIL — `AgregarrApiClient` is not exported.

- [x] **Step 3: Implement AgregarrApiClient.search**

In `src/core/api-clients.js`, add after `ImdbApiDevClient`:

```js
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);

export class AgregarrApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.AGREGARR], null, adapter),
            ApiSource.AGREGARR,
            disabledManager,
            adapter,
            config,
            logger
        );
    }

    async search(displayTitle) {
        const encoded = encodeURIComponent(displayTitle.toLowerCase());
        const firstChar = encoded.charAt(0);
        this.logger?.debug(`Searching IMDb suggestions for title: "${displayTitle}"`);
        const data = await this.queuedFetch(
            `https://v3.sg.media-imdb.com/suggestion/titles/${firstChar}/${encoded}.json`,
            0
        );
        const results = data?.d;
        if (!results?.length) {
            this.logger?.debug(`No search results found in IMDb suggestions for: "${displayTitle}"`);
            return null;
        }
        const match = results.find(r => AGREGARR_TITLE_TYPES.has(r.qid));
        if (!match) {
            this.logger?.debug(`No title results found in IMDb suggestions for: "${displayTitle}"`);
            return null;
        }
        return match;
    }

    async getDetails(match, displayTitle) {
        const { id, l: title, qid, y: year } = match;
        this.logger?.debug(`Fetching Agregarr rating for ID: ${id} ("${displayTitle}")`);
        const ratings = await this.queuedFetch(`https://api.agregarr.org/api/ratings?id=${encodeURIComponent(id)}`, 1);
        const entry = ratings?.[0];
        return new Title({
            apiTitle: title ?? null,
            imdbId: id,
            year: year ?? null,
            rating: entry?.rating ?? null,
            rtRating: null,
            mcRating: null,
            type: mapTitleType(qid),
        });
    }
}
```

- [x] **Step 4: Run tests to verify search tests pass**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: All AgregarrApiClient search tests PASS. Existing tests still PASS.

- [x] **Step 5: Write failing tests for AgregarrApiClient.getDetails**

Add to the `AgregarrApiClient` describe block in `tests/unit/core/api-clients.test.js`:

```js
it('should fetch rating from Agregarr and return Title', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt1375666', rating: 8.8, votes: 2500000 }]),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.getDetails({ id: 'tt1375666', l: 'Inception', qid: 'movie', y: 2010 }, 'Inception');
    expect(result.apiTitle).toBe('Inception');
    expect(result.imdbId).toBe('tt1375666');
    expect(result.year).toBe(2010);
    expect(result.rating).toBe(8.8);
    expect(result.rtRating).toBeNull();
    expect(result.mcRating).toBeNull();
    expect(result.type).toBe('movie');
});

it('should handle null rating from Agregarr', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt999999', rating: null, votes: null }]),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.getDetails(
        { id: 'tt999999', l: 'Unknown Title', qid: 'movie', y: 2020 },
        'Unknown Title'
    );
    expect(result.rating).toBeNull();
});

it('should map tvSeries type to series', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt0903747', rating: 9.5, votes: 2000000 }]),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.getDetails(
        { id: 'tt0903747', l: 'Breaking Bad', qid: 'tvSeries', y: 2008 },
        'Breaking Bad'
    );
    expect(result.type).toBe('series');
});

it('should map tvMiniSeries type to series', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue([{ imdbId: 'tt5180504', rating: 8.6, votes: 500000 }]),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.getDetails(
        { id: 'tt5180504', l: 'The Witcher', qid: 'tvMiniSeries', y: 2019 },
        'The Witcher'
    );
    expect(result.type).toBe('series');
});

it('should handle full fetch flow (search + details)', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi
            .fn()
            .mockResolvedValueOnce({
                d: [{ id: 'tt1375666', l: 'Inception', qid: 'movie', y: 2010 }],
            })
            .mockResolvedValueOnce([{ imdbId: 'tt1375666', rating: 8.8, votes: 2500000 }]),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    const result = await client.fetch('Inception');
    expect(result.displayTitle).toBe('Inception');
    expect(result.apiTitle).toBe('Inception');
    expect(result.imdbId).toBe('tt1375666');
    expect(result.rating).toBe(8.8);
    expect(result.source).toBe('agregarr');
});
```

- [x] **Step 6: Run all tests to verify they pass**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: All tests PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "feat: add AgregarrApiClient with IMDb suggestions search and Agregarr ratings"
```

---

### Task 3: Wire up AgregarrApiClient and update config

**Files:**

- Modify: `src/core/app.js`
- Modify: `src/core/config-fields.js`
- Modify: `tests/unit/core/config-fields.test.js`

**Interfaces:**

- Consumes: `AgregarrApiClient`, `ApiSource.AGREGARR`
- Produces: Agregarr as selectable (and default) provider in config and app wiring

- [x] **Step 1: Import and register AgregarrApiClient in app.js**

In `src/core/app.js`, update the import:

```js
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient, AgregarrApiClient } from './api-clients.js';
```

Update `createApiClient()`:

```js
function createApiClient(config, disabledManager, adapter, logger) {
    const provider = (config.get('apiClient') ?? 'agregarr').trim().toLowerCase();
    const clientMap = {
        [ApiSource.AGREGARR]: AgregarrApiClient,
        [ApiSource.XMDB]: XmdbApiClient,
        [ApiSource.OMDB]: OmdbApiClient,
        [ApiSource.IMDBAPI]: ImdbApiDevClient,
    };
    const ClientClass = clientMap[provider] ?? AgregarrApiClient;
    return new ClientClass(disabledManager, adapter, config, logger);
}
```

- [x] **Step 2: Update config-fields.js**

In `src/core/config-fields.js`, update the `apiClient` field:

```js
    {
        key: 'apiClient',
        label: 'API Provider',
        type: 'select',
        options: [
            ['agregarr', 'Agregarr'],
            ['imdbapi', 'IMDb API'],
            ['omdb', 'OMDB'],
            ['xmdb', 'XMDB'],
        ],
        default: 'agregarr',
        title: 'Which service to fetch ratings from.',
    },
```

- [x] **Step 3: Update config-fields tests**

In `tests/unit/core/config-fields.test.js`, the API key validation test uses `'imdbapi'` as the "not selected" provider. Update to use `'agregarr'` since that's the new default:

```js
describe.each([
    ['xmdbApiKey', 'xmdb'],
    ['omdbApiKey', 'omdb'],
])('%s validation', (key, provider) => {
    // ... existing beforeEach ...

    it('should accept empty key when provider is not selected', () => {
        expect(field.validate('', { apiClient: 'agregarr' })).toBeNull();
    });
});
```

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/unit/core/config-fields.test.js`
Expected: All tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/app.js src/core/config-fields.js tests/unit/core/config-fields.test.js
git commit -m "feat: wire up AgregarrApiClient as default ratings provider"
```

---

### Task 4: Update domain allowlists and permissions

**Files:**

- Modify: `src/targets/extension/domains.js`
- Modify: `src/targets/chrome/manifest.json`
- Modify: `src/targets/firefox/manifest.json`
- Modify: `src/targets/userscript/metadata.js`

**Interfaces:**

- Produces: Network access to `v3.sg.media-imdb.com` and `api.agregarr.org` across all targets

- [x] **Step 1: Update domains.js**

In `src/targets/extension/domains.js`:

```js
export const ALLOWED_DOMAINS = [
    'api.imdbapi.dev',
    'www.omdbapi.com',
    'xmdbapi.com',
    'v3.sg.media-imdb.com',
    'api.agregarr.org',
];
```

- [x] **Step 2: Update Chrome manifest**

In `src/targets/chrome/manifest.json`, update `host_permissions`:

```json
    "host_permissions": [
        "https://www.netflix.com/*",
        "https://xmdbapi.com/*",
        "https://www.omdbapi.com/*",
        "https://api.imdbapi.dev/*",
        "https://v3.sg.media-imdb.com/*",
        "https://api.agregarr.org/*"
    ],
```

- [x] **Step 3: Update Firefox manifest**

In `src/targets/firefox/manifest.json`, update `host_permissions` (same entries as Chrome):

```json
    "host_permissions": [
        "https://www.netflix.com/*",
        "https://xmdbapi.com/*",
        "https://www.omdbapi.com/*",
        "https://api.imdbapi.dev/*",
        "https://v3.sg.media-imdb.com/*",
        "https://api.agregarr.org/*"
    ],
```

- [x] **Step 4: Update userscript metadata**

In `src/targets/userscript/metadata.js`, add `@connect` directives after the existing ones:

```js
// @connect      www.omdbapi.com
// @connect      xmdbapi.com
// @connect      api.imdbapi.dev
// @connect      v3.sg.media-imdb.com
// @connect      api.agregarr.org
```

- [x] **Step 5: Build all targets to verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [x] **Step 6: Commit**

```bash
git add src/targets/extension/domains.js src/targets/chrome/manifest.json src/targets/firefox/manifest.json src/targets/userscript/metadata.js
git commit -m "feat: add Agregarr and IMDb suggestions domains to allowlists and permissions"
```

---

### Task 5: Add integration tests

**Files:**

- Modify: `tests/integration/api-clients.test.js`

**Interfaces:**

- Consumes: `AgregarrApiClient`, `ApiSource.AGREGARR`

- [x] **Step 1: Add Agregarr integration tests**

In `tests/integration/api-clients.test.js`, add the import:

```js
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient, AgregarrApiClient } from '../../src/core/api-clients';
```

Add Agregarr test cases alongside existing providers in each describe block:

```js
describe('movie with all ratings', () => {
    // ... existing XMDB, OMDB, IMDBAPI tests ...

    it('Agregarr', async () => {
        const client = new AgregarrApiClient(disabledManager, adapter, configManager);
        const result = await client.fetch(TITLE);
        expectCommonTitleFields(result, ApiSource.AGREGARR, common);
        expect(result.rtRating).toBeNull();
        expect(result.mcRating).toBeNull();
    });
});

describe('TV show', () => {
    // ... existing tests ...

    it('Agregarr', async () => {
        const client = new AgregarrApiClient(disabledManager, adapter, configManager);
        const result = await client.fetch(TITLE);
        expectCommonTitleFields(result, ApiSource.AGREGARR, common);
    });
});

describe('invalid title search', () => {
    // ... existing tests ...

    it('Agregarr', async () => {
        const client = new AgregarrApiClient(disabledManager, adapter, configManager);
        expect(await client.search(TITLE)).toBeNull();
    });
});

describe('non-ASCII title', () => {
    // ... existing tests ...

    it('Agregarr', async () => {
        const client = new AgregarrApiClient(disabledManager, adapter, configManager);
        const result = await client.fetch(TITLE);
        expectCommonTitleFields(result, ApiSource.AGREGARR, common);
    });
});

describe('foreign original title', () => {
    // ... existing tests ...

    it('Agregarr', async () => {
        const client = new AgregarrApiClient(disabledManager, adapter, configManager);
        const result = await client.fetch(TITLE);
        expectCommonTitleFields(result, ApiSource.AGREGARR, common);
    });
});
```

- [x] **Step 2: Run integration tests**

Run: `npx vitest run tests/integration/api-clients.test.js`
Expected: All Agregarr tests PASS (these hit real APIs).

- [x] **Step 3: Commit**

```bash
git add tests/integration/api-clients.test.js
git commit -m "test: add Agregarr integration tests for movies, TV, non-ASCII, and foreign titles"
```

---

## Verification

After all tasks complete:

1. Run full unit test suite: `npx vitest run tests/unit/`
2. Run integration tests: `npx vitest run tests/integration/api-clients.test.js`
3. Build all targets: `npm run build`
