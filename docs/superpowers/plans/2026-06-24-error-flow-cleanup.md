# Error Flow Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the error handling flow across the HTTP fetch pipeline so every error is either logged or thrown (never both), and add structured error logging with status codes, URLs, and response bodies at the correct layers.

**Architecture:** Errors originate in platform adapters as `FlixMonkeyError` instances enriched with `.status`, `.url`, and `.body`. They propagate untouched through `queuedFetch` (pure transport wrapper). API-level errors are logged at `warn` and handled (return `null`) in subclass `getDetails` methods. HTTP errors are caught, logged, and handled once in `ApiClientManager.getData` (the terminal handler), which also takes over the disable-on-4xx policy.

**Tech Stack:** Vitest, JavaScript (ES modules)

## Global Constraints

- License header: all source and test files start with the GPLv3 copyright block (`Copyright (C) 2026 Fran`).
- Test runner: `npx vitest run <path>` for targeted runs, `npx vitest run` for full suite.
- Build: `npm run build` must pass after all changes.
- Mock logger: use `createMockLogger()` from `tests/mocks/logger.js` — provides `debug`, `info`, `warn`, `error` as `vi.fn()`.
- Mock adapter: use `createMockAdapter()` from `tests/mocks/adapter.js`.
- Response body truncation: 200 characters max.

---

### Task 1: Enrich `FlixMonkeyError` with `.body` and `.url`

**Files:**

- Modify: `src/core/utils.js:22-28`
- Test: `tests/unit/core/utils.test.js`

**Interfaces:**

- Produces: `FlixMonkeyError(message, status?, body?, url?)` constructor. Properties: `.name`, `.status`, `.body`, `.url`.

- [ ] **Step 1: Write the failing tests**

Add a new `describe('FlixMonkeyError', ...)` block at the end of `tests/unit/core/utils.test.js`:

```js
describe('FlixMonkeyError', () => {
    it('should set message and name', () => {
        const err = new FlixMonkeyError('test error');
        expect(err.message).toBe('test error');
        expect(err.name).toBe('FlixMonkeyError');
        expect(err).toBeInstanceOf(Error);
    });

    it('should set status when provided', () => {
        const err = new FlixMonkeyError('HTTP 401', 401);
        expect(err.status).toBe(401);
    });

    it('should default status to null', () => {
        const err = new FlixMonkeyError('test');
        expect(err.status).toBeNull();
    });

    it('should set body when provided', () => {
        const err = new FlixMonkeyError('HTTP 401', 401, 'Unauthorized');
        expect(err.body).toBe('Unauthorized');
    });

    it('should default body to null', () => {
        const err = new FlixMonkeyError('test', 500);
        expect(err.body).toBeNull();
    });

    it('should set url when provided', () => {
        const err = new FlixMonkeyError('HTTP 401', 401, 'Unauthorized', 'https://api.example.com/foo');
        expect(err.url).toBe('https://api.example.com/foo');
    });

    it('should default url to null', () => {
        const err = new FlixMonkeyError('test');
        expect(err.url).toBeNull();
    });
});
```

Add the import at the top of the file alongside the existing imports:

```js
import { debounce, runIdle, FlixMonkeyError } from '../../../src/core/utils.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/utils.test.js`
Expected: The new `FlixMonkeyError` tests fail — `body` and `url` properties are `undefined`.

- [ ] **Step 3: Update `FlixMonkeyError` constructor**

In `src/core/utils.js`, replace the `FlixMonkeyError` class:

```js
export class FlixMonkeyError extends Error {
    constructor(message, status = null, body = null, url = null) {
        super(message);
        this.name = 'FlixMonkeyError';
        this.status = status;
        this.body = body;
        this.url = url;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/core/utils.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/utils.js tests/unit/core/utils.test.js
git commit -m "feat(utils): add body and url properties to FlixMonkeyError"
```

---

### Task 2: Capture response body and URL in platform adapters

**Files:**

- Modify: `src/platform/userscript.js:73-74`
- Modify: `src/targets/extension/fetch-proxy.js:36`
- Modify: `src/platform/webextension.js:63,67-69`
- Test: `tests/unit/platform/userscript.test.js`
- Test: `tests/unit/platform/webextension.test.js`

**Interfaces:**

- Consumes: `FlixMonkeyError(message, status, body, url)` from Task 1.
- Produces: `FlixMonkeyError` instances thrown from `httpFetch` now carry `.body` (truncated response text, max 200 chars) and `.url` (the request URL). `fetch-proxy.js` returns `{ error, status, body }` on failure.

- [ ] **Step 1: Write failing tests for `UserscriptAdapter`**

Add these tests to the existing `describe('UserscriptAdapter', ...)` block in `tests/unit/platform/userscript.test.js`:

```js
it('httpFetch should include url on HTTP error', async () => {
    GM_xmlhttpRequest.mockImplementation(({ onload }) => {
        onload({ status: 403, responseText: '' });
    });

    try {
        await adapter.httpFetch('http://example.com/api');
    } catch (e) {
        expect(e.url).toBe('http://example.com/api');
    }
});

it('httpFetch should include truncated body on HTTP error', async () => {
    GM_xmlhttpRequest.mockImplementation(({ onload }) => {
        onload({ status: 401, responseText: 'Invalid API key' });
    });

    try {
        await adapter.httpFetch('http://example.com/api');
    } catch (e) {
        expect(e.body).toBe('Invalid API key');
    }
});

it('httpFetch should truncate body to 200 characters', async () => {
    const longBody = 'x'.repeat(500);
    GM_xmlhttpRequest.mockImplementation(({ onload }) => {
        onload({ status: 500, responseText: longBody });
    });

    try {
        await adapter.httpFetch('http://example.com/api');
    } catch (e) {
        expect(e.body).toHaveLength(200);
    }
});

it('httpFetch should include url on network error', async () => {
    GM_xmlhttpRequest.mockImplementation(({ onerror }) => {
        onerror();
    });

    try {
        await adapter.httpFetch('http://example.com/api');
    } catch (e) {
        expect(e.url).toBe('http://example.com/api');
    }
});

it('httpFetch should include url on timeout error', async () => {
    GM_xmlhttpRequest.mockImplementation(({ ontimeout }) => {
        ontimeout();
    });

    try {
        await adapter.httpFetch('http://example.com/api');
    } catch (e) {
        expect(e.url).toBe('http://example.com/api');
    }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/platform/userscript.test.js`
Expected: New tests fail — `.url` is `undefined`, `.body` is `undefined`.

- [ ] **Step 3: Update `UserscriptAdapter.httpFetch`**

In `src/platform/userscript.js`, replace the `httpFetch` method:

```js
async httpFetch(url, { responseType = 'json', timeout = DEFAULT_FETCH_TIMEOUT } = {}) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            responseType,
            headers: {
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout,
            onload: r => {
                const { status, response, responseText } = r;
                if (status >= 200 && status < 300) {
                    if (responseType === 'json') {
                        resolve(response ?? JSON.parse(responseText));
                    } else {
                        resolve(responseText);
                    }
                } else {
                    const body = responseText ? responseText.slice(0, 200) : null;
                    reject(new FlixMonkeyError(`HTTP ${status}`, status, body, url));
                }
            },
            onerror: () => reject(new FlixMonkeyError('network error', null, null, url)),
            ontimeout: () => reject(new FlixMonkeyError('timeout', null, null, url)),
        });
    });
}
```

- [ ] **Step 4: Run userscript tests to verify they pass**

Run: `npx vitest run tests/unit/platform/userscript.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Write failing tests for `WebExtensionAdapter`**

Add these tests to the existing `describe('WebExtensionAdapter', ...)` block in `tests/unit/platform/webextension.test.js`:

```js
it('httpFetch should include url on HTTP error from background', async () => {
    browser.runtime.sendMessage.mockResolvedValue({ error: 'HTTP 403', status: 403, body: 'Forbidden' });

    try {
        await adapter.httpFetch('https://api.example.com/test');
    } catch (e) {
        expect(e.url).toBe('https://api.example.com/test');
        expect(e.status).toBe(403);
        expect(e.body).toBe('Forbidden');
    }
});

it('httpFetch should include url on empty background response', async () => {
    browser.runtime.sendMessage.mockResolvedValue(undefined);

    try {
        await adapter.httpFetch('https://api.example.com/test');
    } catch (e) {
        expect(e.url).toBe('https://api.example.com/test');
    }
});
```

- [ ] **Step 6: Run webextension tests to verify they fail**

Run: `npx vitest run tests/unit/platform/webextension.test.js`
Expected: New tests fail — `.url` and `.body` are `undefined`.

- [ ] **Step 7: Update `WebExtensionAdapter.httpFetch`**

In `src/platform/webextension.js`, replace the `httpFetch` method:

```js
async httpFetch(url, options = {}) {
    const timeout = options.timeout ?? DEFAULT_FETCH_TIMEOUT;
    const fetchPromise = browser.runtime.sendMessage({ type: 'FM_FETCH', url, options });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new FlixMonkeyError('background relay timeout', null, null, url)), timeout)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    if (!response) throw new FlixMonkeyError('empty background response', null, null, url);
    if (response.error) {
        throw new FlixMonkeyError(response.error, response.status, response.body ?? null, url);
    }
    return response.data;
}
```

- [ ] **Step 8: Run webextension tests to verify they pass**

Run: `npx vitest run tests/unit/platform/webextension.test.js`
Expected: All tests PASS.

- [ ] **Step 9: Update `fetch-proxy.js` to capture response body**

In `src/targets/extension/fetch-proxy.js`, replace the `try` block inside `handleFetchMessage`:

```js
try {
    const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
        const body = await res.text().catch(() => null);
        return { error: `HTTP ${res.status}`, status: res.status, body: body ? body.slice(0, 200) : null };
    }
    const data = responseType === 'json' ? await res.json() : await res.text();
    return { data };
} catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message };
}
```

- [ ] **Step 10: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/platform/userscript.js src/platform/webextension.js src/targets/extension/fetch-proxy.js tests/unit/platform/userscript.test.js tests/unit/platform/webextension.test.js
git commit -m "feat(platform): capture response body and url in FlixMonkeyError"
```

---

### Task 3: Clean up `queuedFetch` and update `BaseApiClient` tests

**Files:**

- Modify: `src/core/api-clients.js:145-158`
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Consumes: `FlixMonkeyError` with `.status`, `.body`, `.url` from Tasks 1–2.
- Produces: `queuedFetch(url, priority, responseType)` — pure transport wrapper that propagates all errors without catching. No longer calls `disable()` on 4xx.

- [ ] **Step 1: Update existing tests for `queuedFetch` behavior change**

In `tests/unit/core/api-clients.test.js`, replace the first test (`should disable itself and purge queue on 4xx error`) with a test that verifies `queuedFetch` does NOT disable on 4xx:

```js
it('should NOT disable itself on 4xx error in queuedFetch', async () => {
    const error = new Error('HTTP 403');
    error.status = 403;

    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockRejectedValueOnce(error),
    });
    const mockDisabledManager = {
        isDisabled: vi.fn().mockResolvedValue(false),
        disable: vi.fn().mockResolvedValue(undefined),
    };

    const client = new XmdbApiClient(mockDisabledManager, mockAdapter, { get: _k => 'key' }, createMockLogger());

    await expect(client.queuedFetch('url1')).rejects.toThrow('HTTP 403');
    expect(mockDisabledManager.disable).not.toHaveBeenCalled();
});
```

The existing `should NOT disable itself on 5xx error` and `should NOT disable itself on a network error with no status property` tests remain unchanged — they already assert no disable, which is still correct.

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: The new test fails — `queuedFetch` still calls `disable()` on 4xx.

- [ ] **Step 3: Simplify `queuedFetch` in `BaseApiClient`**

In `src/core/api-clients.js`, replace the `queuedFetch` method (lines 145–158) with:

```js
async queuedFetch(url, priority = 0, responseType = 'json') {
    return this.#queue.enqueue(
        url,
        priority,
        (u, rt) => this.#adapter.httpFetch(u, { responseType: rt }),
        responseType
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "refactor(api-clients): remove policy logic from queuedFetch"
```

---

### Task 4: Add `warn` logging to subclass `getDetails` and upgrade `search` logs to `info`

**Files:**

- Modify: `src/core/api-clients.js` (XmdbApiClient, OmdbApiClient, ImdbApiDevClient `getDetails` methods; all `search` methods)
- Test: `tests/unit/core/api-clients.test.js`

**Interfaces:**

- Consumes: `this.logger?.warn(...)`, `this.logger?.info(...)` from `BaseApiClient`.
- Produces: All `getDetails` methods return `null` (never throw) on API-level errors, with a `warn` log. All `search` methods log "no results" at `info` instead of `debug`.

- [ ] **Step 1: Write failing tests for `getDetails` warn logging**

Add these tests to `tests/unit/core/api-clients.test.js`:

In the `describe('XmdbApiClient', ...)` block, add:

```js
it('should log warn when details response has error field', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValueOnce({ error: 'not found' }),
    });
    const mockLogger = createMockLogger();
    const client = new XmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        mockLogger
    );
    await client.getDetails({ id: 'm1' }, 'Movie 1');
    expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Movie 1'),
        expect.objectContaining({ error: 'not found' })
    );
});
```

In the `describe('OmdbApiClient', ...)` block, add:

```js
it('should log warn with error message on OMDB False response', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({ Response: 'False', Error: 'Movie not found!' }),
    });
    const mockLogger = createMockLogger();
    const client = new OmdbApiClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        { get: _k => 'key' },
        mockLogger
    );
    await client.getDetails({ title: 'Unknown' }, 'Unknown');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Movie not found!'));
});
```

In the `describe('ImdbApiDevClient', ...)` block, replace the existing `should throw if details fetch returns an error` test:

```js
it('should return null and log warn when details fetch returns an error', async () => {
    const mockAdapter = createMockAdapter({
        httpFetch: vi.fn().mockResolvedValue({ error: 'server error' }),
    });
    const mockLogger = createMockLogger();
    const client = new ImdbApiDevClient(
        { isDisabled: vi.fn().mockResolvedValue(false) },
        mockAdapter,
        undefined,
        mockLogger
    );
    const result = await client.getDetails({ id: 'tt1' }, 'Movie 1');
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Movie 1'),
        expect.objectContaining({ error: 'server error' })
    );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: XMDB warn test fails (no warn call), OMDB warn test fails (no warn call), IMDb test fails (throws instead of returning null).

- [ ] **Step 3: Add warn logging to `XmdbApiClient.getDetails`**

In `src/core/api-clients.js`, replace lines 247–249:

```js
if (!detailsJson || detailsJson.error || !detailsJson.title) {
    return null;
}
```

with:

```js
if (!detailsJson || detailsJson.error || !detailsJson.title) {
    this.logger?.warn(`XMDB details request returned invalid response for "${displayTitle}" (ID: ${id})`, {
        error: detailsJson?.error ?? null,
    });
    return null;
}
```

- [ ] **Step 4: Update `OmdbApiClient.getDetails` logging**

In `src/core/api-clients.js`, replace lines 290–293:

```js
if (json.Response === 'False') {
    this.logger?.debug(`No search results found in OMDB for: "${t}"`);
    return null;
}
```

with:

```js
if (json.Response === 'False') {
    this.logger?.warn(`OMDB returned error for "${displayTitle}": ${json.Error ?? 'unknown'}`);
    return null;
}
```

- [ ] **Step 5: Change `ImdbApiDevClient.getDetails` from throw to warn + return null**

In `src/core/api-clients.js`, replace lines 335–337:

```js
if (!detailsJson || detailsJson.error) {
    throw new Error(`IMDb API Dev details request failed for ID: ${id}`);
}
```

with:

```js
if (!detailsJson || detailsJson.error) {
    this.logger?.warn(`IMDb API Dev details request failed for "${displayTitle}" (ID: ${id})`, {
        error: detailsJson?.error ?? null,
    });
    return null;
}
```

- [ ] **Step 6: Upgrade `search` method logs from `debug` to `info`**

In `src/core/api-clients.js`, change all "No search results" / "No title results" `debug` calls in search methods to `info`:

`XmdbApiClient.search` (lines 231 and 236): change `this.logger?.debug(` to `this.logger?.info(`

`ImdbApiDevClient.search` (line 325): change `this.logger?.debug(` to `this.logger?.info(`

`AgregarrApiClient.search` (lines 373 and 378): change `this.logger?.debug(` to `this.logger?.info(`

Note: `OmdbApiClient.search` has no "not found" log (it always returns a match object) — no change needed.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/core/api-clients.test.js`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "feat(api-clients): add warn logging for API errors, upgrade search logs to info"
```

---

### Task 5: Move disable-on-4xx policy to `ApiClientManager.getData` and enhance error logging

**Files:**

- Modify: `src/core/api-manager.js:67-69`
- Test: `tests/unit/core/api-manager.test.js`

**Interfaces:**

- Consumes: `this.#client.disable()` from `BaseApiClient`. `FlixMonkeyError` with `.status`, `.url`, `.body`.
- Produces: `getData` catch block disables client on 4xx, logs at `error` for HTTP errors (with url, status, body), logs at `warn` for non-HTTP errors.

- [ ] **Step 1: Write failing tests**

Add these tests to the existing `describe('ApiClientManager', ...)` block in `tests/unit/core/api-manager.test.js`. First, add the import at the top of the file alongside existing imports:

```js
import { FlixMonkeyError } from '../../../src/core/utils.js';
```

Then add the tests:

```js
it('should disable client on 4xx HTTP error', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const error = new FlixMonkeyError('HTTP 401', 401, 'Unauthorized', 'https://api.example.com');
    const mockClient = {
        source: 'xmdb',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockRejectedValue(error),
        disable: vi.fn().mockResolvedValue(undefined),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    const result = await manager.getData('Test Movie');
    expect(mockClient.disable).toHaveBeenCalled();
    expect(result.hasRating).toBe(false);
});

it('should NOT disable client on 5xx HTTP error', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const error = new FlixMonkeyError('HTTP 500', 500, 'Internal Server Error', 'https://api.example.com');
    const mockClient = {
        source: 'xmdb',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockRejectedValue(error),
        disable: vi.fn().mockResolvedValue(undefined),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    await manager.getData('Test Movie');
    expect(mockClient.disable).not.toHaveBeenCalled();
});

it('should log at error level for HTTP errors with status, url, and body', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const error = new FlixMonkeyError('HTTP 403', 403, 'Forbidden', 'https://api.example.com/search');
    const mockClient = {
        source: 'xmdb',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockRejectedValue(error),
        disable: vi.fn().mockResolvedValue(undefined),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    await manager.getData('Test Movie');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
        url: 'https://api.example.com/search',
        status: 403,
        body: 'Forbidden',
    });
});

it('should log at warn level for non-HTTP errors', async () => {
    const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
    const error = new Error('network error');
    const mockClient = {
        source: 'xmdb',
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
        fetch: vi.fn().mockRejectedValue(error),
    };
    const mockLogger = createMockLogger();
    const manager = new ApiClientManager(mockCache, {}, mockClient, mockLogger);
    await manager.getData('Test Movie');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Test Movie'), {
        url: null,
        status: null,
        body: null,
    });
    expect(mockLogger.error).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/core/api-manager.test.js`
Expected: disable-on-4xx test fails (no `.disable()` call), error-level logging test fails (no `.error()` call), non-HTTP test fails (`.warn()` called with wrong signature).

- [ ] **Step 3: Update the `getData` catch block**

In `src/core/api-manager.js`, replace the catch block (lines 67–69):

```js
        } catch (err) {
            this.#logger.warn(`Failed to fetch ratings for "${displayTitle}": ${err.message}`);
            return Title.notFound(displayTitle, source);
        }
```

with:

```js
        } catch (err) {
            const isHttpError = Number.isInteger(err.status) && err.status >= 400;
            if (isHttpError && err.status < 500) {
                await this.#client.disable();
            }
            this.#logger[isHttpError ? 'error' : 'warn'](
                `Failed to fetch ratings for "${displayTitle}": ${err.message}`,
                { url: err.url ?? null, status: err.status ?? null, body: err.body ?? null }
            );
            return Title.notFound(displayTitle, source);
        }
```

- [ ] **Step 4: Update existing test assertion**

The existing test `should not cache result when fetch throws an error` (line 92) asserts that `mockLogger.warn` was called with a string containing `'Error Movie'`. After our change, a plain `new Error('API error')` (no `.status`) will still log at `warn` level — but now with a second argument. Update the assertion:

Replace:

```js
expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error Movie'));
```

with:

```js
expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error Movie'), {
    url: null,
    status: null,
    body: null,
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/core/api-manager.test.js`
Expected: All tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 7: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "feat(api-manager): move disable policy to getData, add structured error logging"
```
