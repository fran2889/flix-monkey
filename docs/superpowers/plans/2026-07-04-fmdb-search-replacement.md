# FM-DB Search Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IMDb suggestions API with FM-DB API for title search in AgregarrApiClient, while keeping Agregarr for ratings. Remove all references to v3.sg.media-imdb.com.

**Architecture:** Hybrid approach: AgregarrApiClient uses FM-DB (imdb.iamidiotareyoutoo.com) for search to get title metadata (IMDb ID, title, year), and continues using Agregarr (api.agregarr.org) for ratings. The client adapts to FM-DB's native response format with `#` prefixed keys.

**Tech Stack:** JavaScript ES2022, existing FlixMonkey codebase, FM-DB API, Agregarr API

## Global Constraints

- Client identifier remains `'agregarr'` throughout codebase
- Class name remains `AgregarrApiClient`
- `ApiSource.AGREGARR` constant unchanged
- Settings label displays "FM-DB + Agregarr"
- Complete cleanup: remove all `v3.sg.media-imdb.com` references
- No transformation of FM-DB response to mimic old API format
- `Title.type` will be `null` for all results (FM-DB does not provide type)

---

## File Structure

| File                                  | Responsibility                                         |
| ------------------------------------- | ------------------------------------------------------ |
| `src/core/api-clients.js`             | Update `AgregarrApiClient.search()` and `getDetails()` |
| `src/targets/extension/domains.js`    | Remove old domain, add new domain                      |
| `src/core/config-fields.js`           | Update settings label                                  |
| `src/targets/chrome/manifest.json`    | Update host permissions                                |
| `src/targets/firefox/manifest.json`   | Update host permissions                                |
| `src/targets/userscript/metadata.js`  | Update @connect directives                             |
| `tests/unit/core/api-clients.test.js` | Update tests for new behavior                          |

---

## Tasks

---

### Task 1: Update AgregarrApiClient.search() to use FM-DB

**Files:**

- Modify: `src/core/api-clients.js` (lines 369-384)
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Consumes: `queuedFetch` from `BaseApiClient`, `logger` from constructor
- Produces: FM-DB result object with `#` prefixed keys, or `null` if no match

- [x] **Step 1: Update search() method in AgregarrApiClient**

Replace the current `search()` implementation with FM-DB call:

```javascript
    async search(displayTitle) {
        const encoded = encodeURIComponent(displayTitle);
        this.logger?.debug(`Searching FM-DB for title: "${displayTitle}"`);
        const data = await this.queuedFetch(
            `https://imdb.iamidiotareyoutoo.com/search?q=${encoded}`,
            0
        );
        const results = data?.description;
        if (!results?.length) {
            this.logger?.info(`No search results found in FM-DB for "${displayTitle}"`);
            return null;
        }
        return results[0];
    }
```

- [x] **Step 2: Remove unused AGREGARR_TITLE_TYPES constant**

Delete the constant at the top of the class section (line 355):

```javascript
const AGREGARR_TITLE_TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries']);
```

- [x] **Step 3: Run linter to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/core/api-clients.js`

- [x] **Step 4: Commit search changes**

```bash
git add src/core/api-clients.js
git commit -m "refactor(api-clients): replace IMDb suggestions with FM-DB in AgregarrApiClient.search"
```

---

### Task 2: Update AgregarrApiClient.getDetails() to handle FM-DB format

**Files:**

- Modify: `src/core/api-clients.js` (lines 386-405)
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Consumes: FM-DB match object from updated `search()` method
- Produces: `Title` object with metadata from FM-DB and rating from Agregarr

- [x] **Step 1: Update getDetails() method in AgregarrApiClient**

Replace the current `getDetails()` implementation:

```javascript
    async getDetails(match, displayTitle) {
        const id = match["#IMDB_ID"];
        const title = match["#TITLE"];
        const year = match["#YEAR"];
        this.logger?.debug(`Fetching Agregarr details for ID: ${id} ("${displayTitle}")`);
        const ratings = await this.queuedFetch(
            `https://api.agregarr.org/api/ratings?id=${encodeURIComponent(id)}`,
            1
        );
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
            rtRating: null,
            mcRating: null,
            type: null,
        });
    }
```

- [x] **Step 2: Run linter to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/core/api-clients.js`

- [x] **Step 3: Commit getDetails changes**

```bash
git add src/core/api-clients.js
git commit -m "refactor(api-clients): adapt getDetails to FM-DB response format"
```

---

### Task 3: Update domains.js to remove old domain and add new domain

**Files:**

- Modify: `src/targets/extension/domains.js`

**Interfaces:**

- Consumes: None
- Produces: Updated `ALLOWED_DOMAINS` array

- [x] **Step 1: Update ALLOWED_DOMAINS array**

Replace:

```javascript
export const ALLOWED_DOMAINS = [
    'api.imdbapi.dev',
    'www.omdbapi.com',
    'xmdbapi.com',
    'v3.sg.media-imdb.com',
    'api.agregarr.org',
];
```

With:

```javascript
export const ALLOWED_DOMAINS = [
    'api.imdbapi.dev',
    'www.omdbapi.com',
    'xmdbapi.com',
    'api.agregarr.org',
    'imdb.iamidiotareyoutoo.com',
];
```

- [x] **Step 2: Run linter to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/targets/extension/domains.js`

- [x] **Step 3: Commit domains changes**

```bash
git add src/targets/extension/domains.js
git commit -m "refactor(domains): replace v3.sg.media-imdb.com with imdb.iamidiotareyoutoo.com"
```

---

### Task 4: Update config-fields.js settings label

**Files:**

- Modify: `src/core/config-fields.js` (around line 45-50)

**Interfaces:**

- Consumes: None
- Produces: Updated `apiClient` select options with new label

- [x] **Step 1: Update apiClient options label**

Find the `apiClient` configuration in `CONFIG_FIELDS` array and update:

Replace:

```javascript
{ key: 'apiClient', label: 'API Client', type: 'select', default: 'agregarr', options: [
    ['agregarr', 'Agregarr'],
    ['imdbapi', 'IMDb API Dev'],
    ['omdb', 'OMDB'],
    ['xmdb', 'XMDB'],
] },
```

With:

```javascript
{ key: 'apiClient', label: 'API Client', type: 'select', default: 'agregarr', options: [
    ['agregarr', 'FM-DB + Agregarr'],
    ['imdbapi', 'IMDb API Dev'],
    ['omdb', 'OMDB'],
    ['xmdb', 'XMDB'],
] },
```

- [x] **Step 2: Run linter to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/core/config-fields.js`

- [x] **Step 3: Commit config-fields changes**

```bash
git add src/core/config-fields.js
git commit -m "docs(config): update agregarr label to FM-DB + Agregarr"
```

---

### Task 5: Update Chrome manifest host permissions

**Files:**

- Modify: `src/targets/chrome/manifest.json`

**Interfaces:**

- Consumes: None
- Produces: Updated `host_permissions` array

- [x] **Step 1: Update host_permissions in Chrome manifest**

Replace:

```json
"host_permissions": [
    "https://api.agregarr.org/*",
    "https://api.imdbapi.dev/*",
    "https://v3.sg.media-imdb.com/*",
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*",
    "https://xmdbapi.com/*"
],
```

With:

```json
"host_permissions": [
    "https://api.agregarr.org/*",
    "https://api.imdbapi.dev/*",
    "https://imdb.iamidiotareyoutoo.com/*",
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*",
    "https://xmdbapi.com/*"
],
```

- [x] **Step 2: Verify JSON is valid**

Run: `node -e "require('./src/targets/chrome/manifest.json')"`
Expected: No errors

- [x] **Step 3: Commit Chrome manifest changes**

```bash
git add src/targets/chrome/manifest.json
git commit -m "build(chrome): replace v3.sg.media-imdb.com with imdb.iamidiotareyoutoo.com"
```

---

### Task 6: Update Firefox manifest host permissions

**Files:**

- Modify: `src/targets/firefox/manifest.json`

**Interfaces:**

- Consumes: None
- Produces: Updated `host_permissions` array

- [x] **Step 1: Update host_permissions in Firefox manifest**

Replace:

```json
"host_permissions": [
    "https://api.agregarr.org/*",
    "https://api.imdbapi.dev/*",
    "https://v3.sg.media-imdb.com/*",
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*",
    "https://xmdbapi.com/*"
],
```

With:

```json
"host_permissions": [
    "https://api.agregarr.org/*",
    "https://api.imdbapi.dev/*",
    "https://imdb.iamidiotareyoutoo.com/*",
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*",
    "https://xmdbapi.com/*"
],
```

- [x] **Step 2: Verify JSON is valid**

Run: `node -e "require('./src/targets/firefox/manifest.json')"`
Expected: No errors

- [x] **Step 3: Commit Firefox manifest changes**

```bash
git add src/targets/firefox/manifest.json
git commit -m "build(firefox): replace v3.sg.media-imdb.com with imdb.iamidiotareyoutoo.com"
```

---

### Task 7: Update userscript metadata

**Files:**

- Modify: `src/targets/userscript/metadata.js`

**Interfaces:**

- Consumes: None
- Produces: Updated `@connect` directives

- [x] **Step 1: Update @connect directives**

Replace:

```javascript
// @connect      api.imdbapi.dev
// @connect      www.omdbapi.com
// @connect      xmdbapi.com
// @connect      v3.sg.media-imdb.com
// @connect      api.agregarr.org
```

With:

```javascript
// @connect      api.imdbapi.dev
// @connect      www.omdbapi.com
// @connect      xmdbapi.com
// @connect      imdb.iamidiotareyoutoo.com
// @connect      api.agregarr.org
```

- [x] **Step 2: Run linter to verify syntax**

Run: `npm run lint`
Expected: No errors in `src/targets/userscript/metadata.js`

- [x] **Step 3: Commit userscript metadata changes**

```bash
git add src/targets/userscript/metadata.js
git commit -m "build(userscript): replace v3.sg.media-imdb.com with imdb.iamidiotareyoutoo.com"
```

---

### Task 8: Update unit tests for AgregarrApiClient

**Files:**

- Modify: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Consumes: Updated `AgregarrApiClient` behavior
- Produces: Passing tests for FM-DB search and getDetails

- [x] **Step 1: Update search test to expect FM-DB format**

Find the `AgregarrApiClient` describe block and update the search test. Replace:

```javascript
it('should handle search with Agregarr format', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            d: [{ id: 'tt123', l: 'Test Movie', qid: 'movie', y: 2020 }],
        }),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => '' },
        createMockLogger()
    );
    const result = await client.search('Test Movie');
    expect(result).toEqual({ id: 'tt123', l: 'Test Movie', qid: 'movie', y: 2020 });
});
```

With:

```javascript
it('should handle search with FM-DB format', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({
            ok: true,
            description: [{ '#IMDB_ID': 'tt123', '#TITLE': 'Test Movie', '#YEAR': 2020 }],
        }),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => '' },
        createMockLogger()
    );
    const result = await client.search('Test Movie');
    expect(result).toEqual({ '#IMDB_ID': 'tt123', '#TITLE': 'Test Movie', '#YEAR': 2020 });
});
```

- [x] **Step 2: Add test for empty FM-DB response**

Add after the search test:

```javascript
it('should return null when FM-DB returns empty results', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({ ok: true, description: [] }),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => '' },
        createMockLogger()
    );
    const result = await client.search('Nonexistent Movie');
    expect(result).toBeNull();
});
```

- [x] **Step 3: Update getDetails test to handle FM-DB match format**

Find the `AgregarrApiClient` getDetails test and update. Replace:

```javascript
it('should handle getDetails with Agregarr match format', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockImplementation(url => {
            if (url.includes('api.agregarr.org')) {
                return Promise.resolve([{ rating: '7.5' }]);
            }
            return Promise.resolve({ d: [{ id: 'tt123', l: 'Test', qid: 'movie', y: 2020 }] });
        }),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => '' },
        createMockLogger()
    );
    const match = { id: 'tt123', l: 'Test Movie', qid: 'movie', y: 2020 };
    const result = await client.getDetails(match, 'Test Movie');
    expect(result).toBeInstanceOf(Title);
    expect(result.imdbId).toBe('tt123');
    expect(result.apiTitle).toBe('Test Movie');
    expect(result.year).toBe(2020);
    expect(result.rating).toBe(7.5);
});
```

With:

```javascript
it('should handle getDetails with FM-DB match format', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockImplementation(url => {
            if (url.includes('api.agregarr.org')) {
                return Promise.resolve([{ rating: '7.5' }]);
            }
            return Promise.resolve({
                ok: true,
                description: [{ '#IMDB_ID': 'tt123', '#TITLE': 'Test', '#YEAR': 2020 }],
            });
        }),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => '' },
        createMockLogger()
    );
    const match = { '#IMDB_ID': 'tt123', '#TITLE': 'Test Movie', '#YEAR': 2020 };
    const result = await client.getDetails(match, 'Test Movie');
    expect(result).toBeInstanceOf(Title);
    expect(result.imdbId).toBe('tt123');
    expect(result.apiTitle).toBe('Test Movie');
    expect(result.year).toBe(2020);
    expect(result.rating).toBe(7.5);
    expect(result.type).toBeNull();
});
```

- [x] **Step 4: Add test for missing optional fields in FM-DB response**

Add after the getDetails test:

```javascript
it('should handle getDetails with missing optional FM-DB fields', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockImplementation(url => {
            if (url.includes('api.agregarr.org')) {
                return Promise.resolve([{ rating: '8.0' }]);
            }
            return Promise.resolve({
                ok: true,
                description: [{ '#IMDB_ID': 'tt456' }],
            });
        }),
    });
    const client = new AgregarrApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => '' },
        createMockLogger()
    );
    const match = { '#IMDB_ID': 'tt456' };
    const result = await client.getDetails(match, 'Partial Movie');
    expect(result).toBeInstanceOf(Title);
    expect(result.imdbId).toBe('tt456');
    expect(result.apiTitle).toBeNull();
    expect(result.year).toBeNull();
    expect(result.rating).toBe(8.0);
    expect(result.type).toBeNull();
});
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit -- --reporter=verbose tests/unit/core/api-clients.test.js`
Expected: All AgregarrApiClient tests pass

- [x] **Step 6: Commit test updates**

```bash
git add tests/unit/core/api-clients.test.js
git commit -m "test(api-clients): update AgregarrApiClient tests for FM-DB format"
```

---

### Task 9: Run full test suite and build

**Files:**

- All modified files

**Interfaces:**

- Consumes: All previous changes
- Produces: Passing tests, successful build

- [x] **Step 1: Run full lint check**

Run: `npm run lint`
Expected: No errors

- [x] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass (335+ unit tests, 5+ UI tests)

- [x] **Step 3: Run build**

Run: `npm run build`
Expected: All three targets (userscript, chrome, firefox) build successfully

- [x] **Step 4: Verify no references to v3.sg.media-imdb.com remain**

Run: `grep -r "v3.sg.media-imdb.com" src/ tests/ docs/`
Expected: No matches (or only in this plan file)

- [x] **Step 5: Verify new domain is present**

Run: `grep -r "imdb.iamidiotareyoutoo.com" src/`
Expected: Matches in domains.js, both manifests, userscript metadata, and api-clients.js

---

## Verification Checkpoints

| Checkpoint               | Command                                     | Expected         |
| ------------------------ | ------------------------------------------- | ---------------- |
| All tests pass           | `npm test`                                  | PASS             |
| All targets build        | `npm run build`                             | Success          |
| No old domain references | `grep -r "v3.sg.media-imdb.com" src/`       | No matches       |
| New domain present       | `grep -r "imdb.iamidiotareyoutoo.com" src/` | Multiple matches |
| Lint clean               | `npm run lint`                              | No errors        |

---

## Rollback Plan

If issues are discovered after deployment:

1. Revert to previous commit: `git revert HEAD~9..HEAD` (reverts all 9 commits from this plan)
2. Or cherry-pick individual revert commits for specific tasks
3. All changes are isolated to the Agregarr client and domain configurations
