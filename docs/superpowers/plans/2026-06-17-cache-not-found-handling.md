# Cache Not-Found Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop caching "not found" results from disabled clients or API errors, and scope genuine not-found cache entries to their source provider so switching providers retries them.

**Architecture:** Three layers change bottom-up: the data layer (`Title`, `CacheManager`) learns about source-scoped not-found entries; the client layer (`BaseApiClient` and subclasses) stops swallowing errors and validates API keys in `getStatus()`; the orchestration layer (`ApiClientManager`) wires the new behaviors together — disabled and error paths skip the cache, genuine not-found entries carry source.

**Tech Stack:** JavaScript ES2022, Vitest + jsdom

## Global Constraints

- ES modules with `import`/`export` everywhere
- Private fields use `#field` syntax
- Every file starts with the GPL-3.0 license header
- Conventional Commits enforced by commitlint
- All changed business logic must have test coverage

---

### Task 1: Title and CacheManager source-awareness

**Files:**

- Modify: `src/core/title.js:63-65`
- Modify: `src/core/cache.js:53-65`
- Test: `tests/unit/core/title.test.js`
- Test: `tests/unit/core/cache.test.js`

**Interfaces:**

- Produces: `Title.notFound(displayTitle, source)` — used by Task 3
- Produces: `CacheManager.read(displayTitle, activeSource)` — used by Task 3

- [x] **Step 1: Write failing test for `Title.notFound` with source**

In `tests/unit/core/title.test.js`, update the existing test and add a new one:

```js
it('should create notFound title with default null source', () => {
    const title = Title.notFound('Missing Movie');
    expect(title.displayTitle).toBe('Missing Movie');
    expect(title.rating).toBeNull();
    expect(title.source).toBeNull();
});

it('should create notFound title with provided source', () => {
    const title = Title.notFound('Missing Movie', 'omdb');
    expect(title.displayTitle).toBe('Missing Movie');
    expect(title.source).toBe('omdb');
    expect(title.rating).toBeNull();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/title.test.js -t "should create notFound title with provided source"`
Expected: FAIL — `Title.notFound` does not accept a second argument, `source` is `null`

- [x] **Step 3: Implement `Title.notFound(displayTitle, source)`**

In `src/core/title.js`, change:

```js
static notFound(displayTitle) {
    return new Title({ displayTitle });
}
```

to:

```js
static notFound(displayTitle, source = null) {
    return new Title({ displayTitle, source });
}
```

- [x] **Step 4: Run title tests to verify they pass**

Run: `npx vitest run tests/unit/core/title.test.js`
Expected: All PASS

- [x] **Step 5: Write failing tests for source-aware `CacheManager.read()`**

In `tests/unit/core/cache.test.js`, add these tests:

```js
it('should return not-found entry when source matches active source', async () => {
    const titleObj = Title.notFound('Missing Movie', 'imdbapi');
    adapter.storageGet.mockResolvedValue(JSON.stringify({ data: titleObj, expires: Date.now() + 100000 }));
    const result = await cacheManager.read('Missing Movie', 'imdbapi');
    expect(result).not.toBeNull();
    expect(result.hasRating).toBe(false);
    expect(result.source).toBe('imdbapi');
});

it('should return null for not-found entry when source does not match active source', async () => {
    const titleObj = Title.notFound('Missing Movie', 'omdb');
    adapter.storageGet.mockResolvedValue(JSON.stringify({ data: titleObj, expires: Date.now() + 100000 }));
    const result = await cacheManager.read('Missing Movie', 'imdbapi');
    expect(result).toBeNull();
});

it('should return rated entry regardless of source mismatch', async () => {
    const titleObj = new Title({ displayTitle: 'Good Movie', rating: '8.0', source: 'omdb' });
    adapter.storageGet.mockResolvedValue(JSON.stringify({ data: titleObj, expires: Date.now() + 100000 }));
    const result = await cacheManager.read('Good Movie', 'imdbapi');
    expect(result).not.toBeNull();
    expect(result.rating).toBe(8.0);
});

it('should treat not-found entry with null source as cache miss', async () => {
    const titleObj = Title.notFound('Old Entry');
    adapter.storageGet.mockResolvedValue(JSON.stringify({ data: titleObj, expires: Date.now() + 100000 }));
    const result = await cacheManager.read('Old Entry', 'imdbapi');
    expect(result).toBeNull();
});
```

- [x] **Step 6: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/cache.test.js -t "source"`
Expected: FAIL — `read()` does not check source, returns the entry regardless

- [x] **Step 7: Implement source-aware `CacheManager.read()`**

In `src/core/cache.js`, change the `read` method from:

```js
async read(displayTitle) {
    const key = this.#getCacheKey(displayTitle);
    const raw = await this.#adapter.storageGet(key);
    if (!raw) return null;
    try {
        const entry = JSON.parse(raw);
        const expired = entry.expires !== null && Date.now() > entry.expires;
        return expired ? null : Title.fromJSON(entry.data);
    } catch {
        this.#logger.warn('Cache entry corrupt, treating as miss', { key });
        return null;
    }
}
```

to:

```js
async read(displayTitle, activeSource) {
    const key = this.#getCacheKey(displayTitle);
    const raw = await this.#adapter.storageGet(key);
    if (!raw) return null;
    try {
        const entry = JSON.parse(raw);
        const expired = entry.expires !== null && Date.now() > entry.expires;
        if (expired) return null;
        const titleObj = Title.fromJSON(entry.data);
        if (!titleObj.hasRating && titleObj.source !== activeSource) return null;
        return titleObj;
    } catch {
        this.#logger.warn('Cache entry corrupt, treating as miss', { key });
        return null;
    }
}
```

- [x] **Step 8: Update existing cache test for indefinite TTL**

The test "should return valid entry for indefinite cache expiration (null)" creates a Title with no ratings and no source. With the new logic it would be treated as a source mismatch. Update it to use a rated title since it's testing TTL behavior, not not-found behavior:

Change:

```js
it('should return valid entry for indefinite cache expiration (null)', async () => {
    const titleData = { displayTitle: 'Indefinite Title' };
    const titleObj = new Title(titleData);
    adapter.storageGet.mockResolvedValue(JSON.stringify({ data: titleObj, expires: null }));
    const result = await cacheManager.read('Indefinite Title');
    expect(result.displayTitle).toEqual(titleObj.displayTitle);
});
```

to:

```js
it('should return valid entry for indefinite cache expiration (null)', async () => {
    const titleObj = new Title({ displayTitle: 'Indefinite Title', rating: '8.0' });
    adapter.storageGet.mockResolvedValue(JSON.stringify({ data: titleObj, expires: null }));
    const result = await cacheManager.read('Indefinite Title', 'imdbapi');
    expect(result.displayTitle).toBe('Indefinite Title');
});
```

- [x] **Step 9: Run all cache and title tests**

Run: `npx vitest run tests/unit/core/cache.test.js tests/unit/core/title.test.js`
Expected: All PASS

- [x] **Step 10: Commit**

```bash
git add src/core/title.js src/core/cache.js tests/unit/core/title.test.js tests/unit/core/cache.test.js
git commit -m "$(cat <<'EOF'
fix: scope not-found cache entries to source provider

Title.notFound() now accepts an optional source parameter.
CacheManager.read() accepts activeSource and treats not-found entries
from a different provider as cache misses, so switching providers
retries titles that were only missing on the previous provider.
EOF
)"
```

---

### Task 2: API client error propagation and key validation

**Files:**

- Modify: `src/core/api-clients.js:91-115` (BaseApiClient.fetch)
- Modify: `src/core/api-clients.js:117-163` (XmdbApiClient)
- Modify: `src/core/api-clients.js:165-203` (OmdbApiClient)
- Modify: `src/core/api-clients.js:205-246` (ImdbApiDevClient)
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Produces: `BaseApiClient.fetch(displayTitle)` now throws on API errors instead of returning `null`
- Produces: `XmdbApiClient.getStatus()` / `OmdbApiClient.getStatus()` return unhealthy when API key is missing
- Consumed by: Task 3 (`ApiClientManager.getData()` catches errors from `fetch()`)

- [x] **Step 1: Write failing test — `fetch()` propagates errors**

In `tests/unit/core/api-clients.test.js`, change the test "should return null on fetch error and log warning" to expect a throw:

```js
it('should throw when fetch encounters an error', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        {
            get: _k => 'key',
        },
        createMockLogger()
    );

    await expect(client.fetch('Some Title')).rejects.toThrow('Network error');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/api-clients.test.js -t "should throw when fetch encounters an error"`
Expected: FAIL — `fetch()` currently catches errors and returns `null`

- [x] **Step 3: Remove try/catch from `BaseApiClient.fetch()`**

In `src/core/api-clients.js`, change:

```js
async fetch(displayTitle) {
    if (await this.isDisabled()) return null;
    try {
        const match = await this.search(displayTitle);
        if (!match) return null;
        const titleObj = await this.getDetails(match, displayTitle);
        if (titleObj) {
            titleObj.displayTitle = displayTitle;
            titleObj.source = this.#source;
        }
        return titleObj;
    } catch (err) {
        this.#logger?.warn(`${this.constructor.name} failed: ${err.message}`);
        return null;
    }
}
```

to:

```js
async fetch(displayTitle) {
    if (await this.isDisabled()) return null;
    const match = await this.search(displayTitle);
    if (!match) return null;
    const titleObj = await this.getDetails(match, displayTitle);
    if (titleObj) {
        titleObj.displayTitle = displayTitle;
        titleObj.source = this.#source;
    }
    return titleObj;
}
```

- [x] **Step 4: Run the error propagation test**

Run: `npx vitest run tests/unit/core/api-clients.test.js -t "should throw when fetch encounters an error"`
Expected: PASS

- [x] **Step 5: Write failing test — XMDB `getDetails()` throws on error response**

Change the existing test "should return null if details fetch fails" to expect a throw:

```js
it('should throw if details fetch returns an error', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValueOnce({ error: 'not found' }),
    });
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        {
            get: _k => 'key',
        },
        createMockLogger()
    );
    await expect(client.getDetails({ id: 'm1' }, 'Movie 1')).rejects.toThrow();
});
```

- [x] **Step 6: Write failing test — IMDBAPI `getDetails()` throws on error response**

Add a new test in the `ImdbApiDevClient` describe block:

```js
it('should throw if details fetch returns an error', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({ error: 'server error' }),
    });
    const client = new ImdbApiDevClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        createMockLogger()
    );
    await expect(client.getDetails({ id: 'tt1' }, 'Movie')).rejects.toThrow();
});
```

- [x] **Step 7: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/api-clients.test.js -t "should throw if details fetch returns an error"`
Expected: FAIL — `getDetails()` currently returns `null` on error

- [x] **Step 8: Make XMDB and IMDBAPI `getDetails()` throw on error responses**

In `src/core/api-clients.js`, change `XmdbApiClient.getDetails()`:

```js
async getDetails({ id, title: searchResultTitle }, displayTitle) {
    this.logger?.debug(`Fetching XMDB details for ID: ${id} ("${displayTitle}")`);
    const apiKey = this.config.get('xmdbApiKey');
    const detailsParams = new URLSearchParams({ apiKey });
    const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
    if (!detailsJson || detailsJson.error) return null;
    const { rating, release_year, title, metascore } = detailsJson;
```

to:

```js
async getDetails({ id, title: searchResultTitle }, displayTitle) {
    this.logger?.debug(`Fetching XMDB details for ID: ${id} ("${displayTitle}")`);
    const apiKey = this.config.get('xmdbApiKey');
    const detailsParams = new URLSearchParams({ apiKey });
    const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
    if (!detailsJson || detailsJson.error) {
        throw new Error(`XMDB details request failed for ID: ${id}`);
    }
    const { rating, release_year, title, metascore } = detailsJson;
```

Change `ImdbApiDevClient.getDetails()`:

```js
const detailsJson = await this.queuedFetch(`https://api.imdbapi.dev/titles/${id}`, 1);
if (!detailsJson || detailsJson.error) return null;
```

to:

```js
const detailsJson = await this.queuedFetch(`https://api.imdbapi.dev/titles/${id}`, 1);
if (!detailsJson || detailsJson.error) {
    throw new Error(`IMDb API Dev details request failed for ID: ${id}`);
}
```

- [x] **Step 9: Run the getDetails throw tests**

Run: `npx vitest run tests/unit/core/api-clients.test.js -t "should throw if details fetch returns an error"`
Expected: PASS

- [x] **Step 10: Write failing tests — API key validation in `getStatus()`**

Replace the two "sentinel key guard" tests and the two "should return null if no API key is set" tests with `getStatus()` tests:

Remove the `sentinel key guard` describe block entirely and the two "should return null if no API key is set" tests. Add inside the `XmdbApiClient` describe block:

```js
it('should return unhealthy status when API key is missing', async () => {
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        createMockAdapter(),
        { get: () => '' },
        createMockLogger()
    );
    const status = await client.getStatus();
    expect(status.healthy).toBe(false);
});
```

Add inside the `OmdbApiClient` describe block:

```js
it('should return unhealthy status when API key is missing', async () => {
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        createMockAdapter(),
        { get: () => '' },
        createMockLogger()
    );
    const status = await client.getStatus();
    expect(status.healthy).toBe(false);
});
```

- [x] **Step 11: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/api-clients.test.js -t "should return unhealthy status when API key is missing"`
Expected: FAIL — `getStatus()` doesn't check API keys yet

- [x] **Step 12: Implement `getStatus()` overrides and remove `search()` guards**

In `src/core/api-clients.js`, add `getStatus()` to `XmdbApiClient` and remove the API key guard from `search()`:

```js
export class XmdbApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
            ApiSource.XMDB,
            disabledManager,
            adapter,
            config,
            logger
        );
    }

    async getStatus() {
        const apiKey = this.config.get('xmdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    async search(displayTitle) {
        const apiKey = this.config.get('xmdbApiKey');
        const searchParams = new URLSearchParams({ apiKey, q: displayTitle, limit: 5 });
        this.logger?.debug(`Searching XMDB for title: "${displayTitle}"`);
```

Note: the `if (!apiKey) return null;` line is removed from `search()`, but `const apiKey = ...` stays because it's needed for the URL.

Add `getStatus()` to `OmdbApiClient` and simplify `search()`:

```js
export class OmdbApiClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.OMDB], null, adapter),
            ApiSource.OMDB,
            disabledManager,
            adapter,
            config,
            logger
        );
    }

    async getStatus() {
        const apiKey = this.config.get('omdbApiKey');
        if (!apiKey) return { healthy: false, reason: 'No API key configured' };
        return super.getStatus();
    }

    async search(displayTitle) {
        return { title: displayTitle };
    }
```

Note: `OmdbApiClient.search()` no longer reads the API key at all — it was only used for the guard.

- [x] **Step 13: Run all api-clients tests**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: All PASS

- [x] **Step 14: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "$(cat <<'EOF'
fix: propagate API errors instead of swallowing them

BaseApiClient.fetch() no longer catches errors, letting them propagate
to the caller for proper handling. XMDB and IMDBAPI getDetails() throw
on error responses instead of returning null. XMDB and OMDB validate
API key presence in getStatus() instead of silently returning null from
search().
EOF
)"
```

---

### Task 3: ApiClientManager no-cache error and disabled paths

**Files:**

- Modify: `src/core/api-manager.js:47-68`
- Test: `tests/unit/core/api-manager.test.js`

**Interfaces:**

- Consumes: `Title.notFound(displayTitle, source)` from Task 1
- Consumes: `CacheManager.read(displayTitle, activeSource)` from Task 1
- Consumes: `BaseApiClient.fetch()` throws on errors (Task 2)
- Consumes: `BaseApiClient.source` getter (existing)

- [x] **Step 1: Write failing test — disabled client does not cache**

In `tests/unit/core/api-manager.test.js`, update the existing "should skip unhealthy client" test to verify no caching:

```js
it('should skip unhealthy client and not cache the result', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const unhealthyClient = {
        source: 'imdbapi',
        getStatus: vi.fn().mockResolvedValue({ healthy: false }),
        fetch: vi.fn(),
    };
    const manager = new ApiClientManager(mockCache, {}, unhealthyClient, createMockLogger());
    const result = await manager.getData('Test Movie');
    expect(result.hasRating).toBe(false);
    expect(result.source).toBe('imdbapi');
    expect(unhealthyClient.fetch).not.toHaveBeenCalled();
    expect(mockCache.write).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Write failing test — fetch error does not cache**

Add a new test:

```js
it('should not cache result when fetch throws an error', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const mockClient = {
        source: 'imdbapi',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockRejectedValue(new Error('API error')),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    const result = await manager.getData('Error Movie');
    expect(result.hasRating).toBe(false);
    expect(result.displayTitle).toBe('Error Movie');
    expect(result.source).toBe('imdbapi');
    expect(mockCache.write).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error Movie'));
});
```

- [x] **Step 3: Write failing test — genuine not-found caches with source**

Update the existing "should cache 'Not Found' result if client fails" test:

```js
it('should cache genuine not-found result with source', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const client = {
        source: 'omdb',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(null),
    };
    const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
    const result = await manager.getData('Unknown Movie');
    expect(result.hasRating).toBe(false);
    expect(result.source).toBe('omdb');
    expect(mockCache.write).toHaveBeenCalledWith(
        'Unknown Movie',
        expect.objectContaining({ source: 'omdb', rating: null })
    );
});
```

- [x] **Step 4: Write failing test — `cache.read()` receives active source**

Update the existing "should return cached data if available" test:

```js
it('should return cached data if available', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
    const mockClient = { source: 'imdbapi' };
    const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
    const result = await manager.getData('Some Title');
    expect(result.apiTitle).toBe('Cached Movie');
    expect(mockCache.read).toHaveBeenCalledWith('Some Title', 'imdbapi');
});
```

- [x] **Step 5: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/api-manager.test.js`
Expected: Multiple failures — `getData()` still caches disabled results, doesn't pass source, doesn't catch fetch errors

- [x] **Step 6: Implement the new `getData()`**

In `src/core/api-manager.js`, change `getData()` from:

```js
async getData(displayTitle) {
    const cached = await this.#cache.read(displayTitle);
    if (cached !== null) return cached;

    const status = await this.#client.getStatus();
    if (!status.healthy) {
        const notFound = Title.notFound(displayTitle);
        await this.#cache.write(displayTitle, notFound);
        return notFound;
    }

    const data = await this.#client.fetch(displayTitle);
    if (!data) {
        const notFound = Title.notFound(displayTitle);
        await this.#cache.write(displayTitle, notFound);
        return notFound;
    }

    await this.#cache.write(displayTitle, data);
    this.#logger.debug(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}.`);
    return data;
}
```

to:

```js
async getData(displayTitle) {
    const source = this.#client.source;
    const cached = await this.#cache.read(displayTitle, source);
    if (cached !== null) return cached;

    const status = await this.#client.getStatus();
    if (!status.healthy) {
        return Title.notFound(displayTitle, source);
    }

    try {
        const data = await this.#client.fetch(displayTitle);
        if (!data) {
            const notFound = Title.notFound(displayTitle, source);
            await this.#cache.write(displayTitle, notFound);
            return notFound;
        }
        await this.#cache.write(displayTitle, data);
        this.#logger.debug(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}.`);
        return data;
    } catch (err) {
        this.#logger.warn(`Failed to fetch ratings for "${displayTitle}": ${err.message}`);
        return Title.notFound(displayTitle, source);
    }
}
```

- [x] **Step 7: Update remaining tests to include `source` on mock clients**

Update "should fetch and return result from client":

```js
it('should fetch and return result from client', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const mockClient = {
        source: 'imdbapi',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })),
    };
    const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
    const result = await manager.getData('Some Title');
    expect(result.apiTitle).toBe('Fetched Movie');
});
```

Update "should handle fail if client returns null":

```js
it('should handle fail if client returns null', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const client = {
        source: 'imdbapi',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(null),
    };
    const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
    const result = await manager.getData('Some Title');
    expect(result).not.toBeNull();
    expect(result.hasRating).toBe(false);
    expect(result.displayTitle).toBe('Some Title');
    expect(client.fetch).toHaveBeenCalled();
});
```

Update "should log on successful data retrieval":

```js
it('should log on successful data retrieval', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const title = new Title({ apiTitle: 'Logged Movie' });
    title.source = 'test-source';
    const mockClient = {
        source: 'test-source',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockResolvedValue(title),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    await manager.getData('Logged Movie');
    expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from test-source.')
    );
});
```

- [x] **Step 8: Run all api-manager tests**

Run: `npx vitest run tests/unit/core/api-manager.test.js`
Expected: All PASS

- [x] **Step 9: Run the full test suite**

Run: `npm test`
Expected: All PASS

- [x] **Step 10: Commit**

```bash
git add src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "$(cat <<'EOF'
fix: stop caching not-found results from disabled clients and errors

ApiClientManager.getData() no longer caches results when the client is
disabled or when fetch throws an error. Genuine not-found results carry
the source provider and are scoped via CacheManager.read(), so switching
providers retries previously missed titles.
EOF
)"
```
