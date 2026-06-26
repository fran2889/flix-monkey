# Error Flow Cleanup Design

## Context

When rating retrieval fails (HTTP error, invalid API response, or network failure), the error details and status codes are not consistently logged across `api-clients.js`. Additionally, the error handling flow has structural issues: `queuedFetch` mixes transport with policy (disable-on-4xx), `getDetails` contracts are inconsistent (some return `null`, one throws), and there is no way to distinguish "title not found" from "API is broken" in logs.

This spec covers cleaning up the error handling flow across the HTTP fetch pipeline and adding structured error logging at the correct layers.

## Design Principle

**Log or throw, never both.** At each layer in the call stack, a failure is either logged and handled (return null/notFound), or propagated (re-thrown/ignored). No layer catches an error, logs it, and re-throws.

## Error Flow Layers

### Layer 1: Platform Adapters (transport)

**Files:** `src/platform/userscript.js`, `src/targets/extension/fetch-proxy.js`, `src/platform/webextension.js`

The adapters are the only layer with access to the raw HTTP response. On error, they throw a `FlixMonkeyError` with status code and a truncated response body.

**Changes:**

- `FlixMonkeyError` gains `.body` and `.url` properties (optional, `null` by default).
- `userscript.js` (line 74): capture `responseText` on HTTP error, truncate to 200 characters, pass body and `url` to `FlixMonkeyError`.
- `fetch-proxy.js` (line 36): on `!res.ok`, read `await res.text()`, truncate to 200 characters, return as `{ error, status, body }`.
- `webextension.js` (line 69): pass `response.body` and the request `url` to `FlixMonkeyError` constructor.

The 200-character limit prevents large error pages from inflating log output while retaining enough content to diagnose the issue (e.g. `"Invalid API key"`, `"Rate limit exceeded"`).

No logging at this layer. Errors are thrown/returned for the layers above to handle.

### Layer 2: `BaseApiClient.queuedFetch` (clean transport wrapper)

**File:** `src/core/api-clients.js`

Currently catches 4xx errors to trigger `disable()` and re-throws. This mixes transport with policy.

**Change:** Remove the try/catch entirely. `queuedFetch` becomes a pure enqueue-and-return wrapper:

```js
async queuedFetch(url, priority = 0, responseType = 'json') {
    return this.#queue.enqueue(
        url, priority,
        (u, rt) => this.#adapter.httpFetch(u, { responseType: rt }),
        responseType
    );
}
```

No logging, no policy decisions, no side effects. HTTP errors propagate as thrown `FlixMonkeyError` instances.

### Layer 3: Subclass Methods (business logic)

**File:** `src/core/api-clients.js`

Subclass `search()` and `getDetails()` methods interpret API responses. They follow a consistent contract:

- **Return a result** (match object or `Title`) on success.
- **Return `null`** when the title is not found (expected outcome).
- **Return `null` + `warn` log** for unexpected API responses (error fields, missing required data).
- **Let HTTP errors propagate** as thrown exceptions (do not catch them).

**Per-client changes:**

#### `XmdbApiClient.getDetails` (line 247)

Currently returns `null` silently on bad response. Add a `warn` log:

```js
if (!detailsJson || detailsJson.error || !detailsJson.title) {
    this.logger?.warn(`XMDB details request returned invalid response for "${displayTitle}" (ID: ${id})`, {
        error: detailsJson?.error ?? null,
    });
    return null;
}
```

#### `OmdbApiClient.getDetails` (line 290)

Currently logs "No search results" at `debug`. OMDB puts its error message in `json.Error`. Change to `warn` with the error field:

```js
if (json.Response === 'False') {
    this.logger?.warn(`OMDB returned error for "${displayTitle}": ${json.Error ?? 'unknown'}`);
    return null;
}
```

#### `ImdbApiDevClient.getDetails` (line 335)

Currently throws a generic `Error`. Change to `warn` log + `return null` for consistency:

```js
if (!detailsJson || detailsJson.error) {
    this.logger?.warn(`IMDb API Dev details request failed for "${displayTitle}" (ID: ${id})`, {
        error: detailsJson?.error ?? null,
    });
    return null;
}
```

#### `AgregarrApiClient.getDetails`

No change needed. If the response is bad, values end up `null`, which is acceptable.

#### `search()` methods

Change existing `debug` logs to `info`. "No results found" is an expected outcome but worth surfacing without requiring debug mode.

### Layer 4: `ApiClientManager.getData` (terminal error handler)

**File:** `src/core/api-manager.js`

This is the single place where thrown HTTP errors are caught, logged, and converted to `Title.notFound()`. It also takes over the disable-on-4xx policy from `queuedFetch`.

**Change the catch block (line 67):**

```js
catch (err) {
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

HTTP errors (4xx/5xx) are logged at `error` level with status code, request URL, and truncated response body. Other errors (network, timeout) are logged at `warn` with URL when available.

### `BaseApiClient.disable()` method

No change to the method itself. It still clears the queue, marks the client as disabled via `DisabledClientsManager`, and logs an operational `warn` about the lockout. It is now called from `ApiClientManager.getData` instead of from `queuedFetch`.

## Files Changed

### `src/core/utils.js`

- Add optional `.body` and `.url` properties to `FlixMonkeyError` constructor.

### `src/platform/userscript.js`

- Capture truncated `responseText` (first 200 chars) on HTTP error, pass to `FlixMonkeyError`.

### `src/targets/extension/fetch-proxy.js`

- On `!res.ok`, read truncated response body, include in return object as `body`.

### `src/platform/webextension.js`

- Pass `response.body` to `FlixMonkeyError` constructor.

### `src/core/api-clients.js`

- Remove try/catch from `BaseApiClient.queuedFetch`.
- Add `warn` log to `XmdbApiClient.getDetails` for invalid responses.
- Change `OmdbApiClient.getDetails` from `debug` "no results" to `warn` with `json.Error`.
- Change `ImdbApiDevClient.getDetails` from `throw` to `warn` log + `return null`.

### `src/core/api-manager.js`

- Enhance `getData` catch block: add disable-on-4xx policy, log at `error` for HTTP errors with status/body, log at `warn` for other errors.

### Tests

- Update unit tests in `tests/unit/core/api-clients.test.js` for:
    - `queuedFetch` no longer catches/disables on 4xx.
    - `XmdbApiClient.getDetails` logs warn on invalid response.
    - `OmdbApiClient.getDetails` logs warn with error message.
    - `ImdbApiDevClient.getDetails` returns null instead of throwing.
- Update unit tests in `tests/unit/core/api-manager.test.js` for:
    - `getData` disables client on 4xx errors.
    - `getData` logs at `error` for HTTP errors, `warn` for others.
    - `getData` includes status, url, and body in log context.
- Update `FlixMonkeyError` tests if any exist.
- Update platform adapter tests for body capture.

## Error Logging Summary

| Failure type     | Where logged               | Level   | Context                                  |
| ---------------- | -------------------------- | ------- | ---------------------------------------- |
| HTTP 4xx         | `ApiClientManager.getData` | `error` | displayTitle, url, status, body, message |
| HTTP 5xx         | `ApiClientManager.getData` | `error` | displayTitle, url, status, body, message |
| Network/timeout  | `ApiClientManager.getData` | `warn`  | displayTitle, url, message               |
| Bad API response | Subclass `getDetails`      | `warn`  | displayTitle, ID, API error field        |
| Title not found  | Subclass `search`          | `info`  | displayTitle                             |
| Client disabled  | `BaseApiClient.disable`    | `warn`  | client name, duration, purged count      |

## Verification

1. Unit tests: `npx vitest run tests/unit/core/api-clients.test.js`
2. Manager tests: `npx vitest run tests/unit/core/api-manager.test.js`
3. Full test suite: `npx vitest run`
4. Build all targets: `npm run build`
5. Manual: trigger each failure scenario (invalid API key, network off, bad response) and verify correct log level and content in the console.
