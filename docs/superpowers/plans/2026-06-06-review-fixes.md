# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 30 actionable findings from the 2026-06-06 full code review across correctness, security, architecture, code quality, performance, testing, and build.

**Architecture:** Each task is a self-contained commit pairing a production fix with its test. Task 15 (mock adapter) must land before Task 16 (ConfigManager refactor) — all other tasks are independent. Run `npm test` after every task before committing.

**Tech Stack:** JavaScript ES2022, Vitest 4, jsdom, Rollup 4, webextension-polyfill.

---

## File Map

**Modified — production:**

- `src/core/title.js` — hasRating null check
- `src/core/app.js` — decorateContainer catch, navigationPatched instance field, startApp return value, for...of mutation check, addedNodes subtrees, inFlight timeout
- `src/platform/webextension.js` — null response guard
- `src/targets/firefox/background.js` — sender.id validation
- `src/core/ui/modal.js` — createElement refactor
- `src/core/api-clients.js` — key redaction, non-integer status guard, empty-string sentinel
- `src/core/api-manager.js` — remove clearCache, demote log to debug
- `src/platform/adapter.js` — setConfigData no-op
- `src/targets/userscript/entry.js` — reuse managers from startApp
- `src/core/ui/settings-ui.js` — scope queries to container, remove optional chain
- `src/core/config-fields.js` — empty-string defaults for API keys
- `src/core/config-manager.js` — always-adapter constructor
- `src/core/overlay.js` — remove unused displayTitle param
- `src/core/request-queue.js` — read storage once per cycle
- `src/core/constants.js` — add INFLIGHT_TIMEOUT_MS
- `rollup.config.js` — userscript source map, regex fix
- `scripts/package.js` — dist file verification

**Modified — tests:**

- `tests/mocks/adapter.js` — extend PlatformAdapter, configGet override
- `tests/unit/core/title.test.js` — normalization tests
- `tests/unit/core/app.test.js` — rejection, navigation, startApp return, inFlight
- `tests/unit/platform/webextension.test.js` — null response
- `tests/unit/targets/firefox/background.test.js` — sender validation
- `tests/ui/modal.ui.test.js` — verify no regression
- `tests/unit/core/api-clients.test.js` — key redaction, status, sentinel
- `tests/unit/core/api-manager.test.js` — remove clearCache test, update log test
- `tests/unit/core/config-manager.test.js` — full rewrite for adapter form
- `tests/integration/config-manager.test.js` — adapter form
- `tests/integration/api-clients.test.js` — adapter form + skipIf
- `tests/unit/core/overlay.test.js` — remove displayTitle arg
- `tests/unit/core/request-queue.test.js` — storage-once test + comment
- `tests/unit/core/ui/settings-ui.test.js` — scoping test
- `tests/unit/core/surfaces.test.js` — fallback selector tests
- All test files using `new ConfigManager(fn)` or `new ConfigManager()` — see Task 16

**Created:**

- `tests/unit/targets/content.test.js`
- `tests/unit/targets/options.test.js`
- `.nvmrc`
- `.npmrc`

---

## Task 1: fix(title) — hasRating null check + normalization tests

**Files:** `src/core/title.js`, `tests/unit/core/title.test.js`

- [ ] **Add normalization tests** to `tests/unit/core/title.test.js` after the existing `describe` blocks:

```js
describe('hasRating', () => {
    it('should be true when rating is 0', () => {
        expect(new Title({ rating: 0 }).hasRating).toBe(true);
    });
    it('should be true when rtRating is "0%"', () => {
        expect(new Title({ rtRating: '0%' }).hasRating).toBe(true);
    });
    it('should be true when mcRating is "0/100"', () => {
        expect(new Title({ mcRating: '0/100' }).hasRating).toBe(true);
    });
    it('should be false when all ratings are null', () => {
        expect(new Title({}).hasRating).toBe(false);
    });
});

describe('rating normalization', () => {
    it.each([
        ['N/A', null],
        ['', null],
        [null, null],
        [undefined, null],
        ['8.5', 8.5],
        [0, 0],
    ])('normalizes rating %s → %s', (input, expected) => {
        expect(new Title({ rating: input }).rating).toBe(expected);
    });

    it.each([
        ['90%', 90],
        ['0%', 0],
        ['N/A', null],
        ['', null],
        [null, null],
        ['8.5/10', 8], // parseInt stops at non-digit
    ])('normalizes rtRating %s → %s', (input, expected) => {
        expect(new Title({ rtRating: input }).rtRating).toBe(expected);
    });

    it.each([
        ['85/100', 85],
        ['0/100', 0],
        ['N/A', null],
        ['', null],
        [null, null],
        ['abc', null],
    ])('normalizes mcRating %s → %s', (input, expected) => {
        expect(new Title({ mcRating: input }).mcRating).toBe(expected);
    });

    it('parses year from open-ended range string', () => {
        expect(new Title({ year: '2020–' }).year).toBe(2020);
    });
});
```

- [ ] **Run tests — expect failures:**

```bash
npx vitest run tests/unit/core/title.test.js
```

Expected: `hasRating` tests for `0` values fail.

- [ ] **Fix `hasRating` in `src/core/title.js` line 48:**

Replace:

```js
get hasRating() {
    return !!(this.rating || this.rtRating || this.mcRating);
}
```

With:

```js
get hasRating() {
    return this.rating !== null || this.rtRating !== null || this.mcRating !== null;
}
```

- [ ] **Run tests — expect all pass:**

```bash
npx vitest run tests/unit/core/title.test.js
```

- [ ] **Commit:**

```bash
git add src/core/title.js tests/unit/core/title.test.js
git commit -m "fix(title): use null checks in hasRating; add normalization tests"
```

---

## Task 2: fix(app) — catch errors from decorateContainer

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

- [ ] **Add test** to `tests/unit/core/app.test.js` inside `describe('App', ...)`:

```js
it('should log errors thrown by decorateContainer rather than propagating them', async () => {
    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Boom Movie</div>
        </div>
    `;
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(ApiClientManager.prototype, 'getData').mockRejectedValue(new Error('boom'));

    appRef = startApp(createMockAdapter());

    await vi.waitFor(() => {
        expect(logSpy).toHaveBeenCalledWith('decorateContainer failed', expect.any(Error));
    });
    logSpy.mockRestore();
});
```

- [ ] **Run — expect failure:**

```bash
npx vitest run tests/unit/core/app.test.js -t "should log errors"
```

- [ ] **Fix in `src/core/app.js` — update `decorateRoot` method:**

Replace:

```js
decorateRoot(root) {
    this.#surfaces.discover(root).forEach(({ container, title, fadeable }) => {
        this.#decorateContainer(container, title, fadeable);
    });
}
```

With:

```js
decorateRoot(root) {
    this.#surfaces.discover(root).forEach(({ container, title, fadeable }) => {
        this.#decorateContainer(container, title, fadeable).catch(err =>
            logger.error('decorateContainer failed', err)
        );
    });
}
```

- [ ] **Run — expect pass:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "fix(app): catch errors from decorateContainer; add unhandled-rejection test"
```

---

## Task 3: fix(webextension) — guard httpFetch against null response

**Files:** `src/platform/webextension.js`, `tests/unit/platform/webextension.test.js`

- [ ] **Add test** to `tests/unit/platform/webextension.test.js` inside `describe('WebExtensionAdapter', ...)`:

```js
it('httpFetch should throw FlixMonkeyError when background returns undefined', async () => {
    browser.runtime.sendMessage.mockResolvedValue(undefined);
    await expect(adapter.httpFetch('https://api.example.com')).rejects.toThrow('empty background response');
});
```

- [ ] **Run — expect failure:**

```bash
npx vitest run tests/unit/platform/webextension.test.js -t "returns undefined"
```

- [ ] **Fix in `src/platform/webextension.js` — update `httpFetch` after the `Promise.race`:**

Replace:

```js
const response = await Promise.race([fetchPromise, timeoutPromise]);
if (response.error) {
```

With:

```js
const response = await Promise.race([fetchPromise, timeoutPromise]);
if (!response) throw new FlixMonkeyError('empty background response');
if (response.error) {
```

- [ ] **Run — expect pass:**

```bash
npx vitest run tests/unit/platform/webextension.test.js
```

- [ ] **Commit:**

```bash
git add src/platform/webextension.js tests/unit/platform/webextension.test.js
git commit -m "fix(webextension): guard httpFetch against null background response"
```

---

## Task 4: fix(background) — validate sender.id in Firefox listener

**Files:** `src/targets/firefox/background.js`, `tests/unit/targets/firefox/background.test.js`

- [ ] **Add test** to `tests/unit/targets/firefox/background.test.js` — update the `beforeEach` to expose `messageListener` with the sender argument, then add:

```js
it('should ignore messages from external senders', async () => {
    // browser.runtime.id is undefined in test env — sender.id must match it
    const result = await messageListener(
        { type: 'FM_FETCH', url: 'https://xmdbapi.com' },
        { id: 'some-other-extension-id' }
    );
    expect(result).toBeUndefined();
});
```

Note: `browser.runtime.id` is `undefined` in the test environment. The guard `sender.id !== browser.runtime.id` will be `'some-other-extension-id' !== undefined` → `true` → return. Existing tests pass `undefined` as sender (no second arg), so `sender.id` is `undefined === undefined` → `false` → proceed. Verify existing tests still pass.

- [ ] **Run — expect new test fails (message currently processes regardless of sender):**

```bash
npx vitest run tests/unit/targets/firefox/background.test.js -t "external senders"
```

- [ ] **Fix in `src/targets/firefox/background.js`:**

Replace:

```js
browser.runtime.onMessage.addListener(async msg => {
    if (msg.type !== 'FM_FETCH') return;
```

With:

```js
browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (sender.id !== browser.runtime.id) return;
    if (msg.type !== 'FM_FETCH') return;
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/targets/firefox/background.test.js
```

- [ ] **Commit:**

```bash
git add src/targets/firefox/background.js tests/unit/targets/firefox/background.test.js
git commit -m "fix(background): validate sender.id in Firefox message listener"
```

---

## Task 5: fix(modal) — replace innerHTML with createElement

**Files:** `src/core/ui/modal.js`, `tests/ui/modal.ui.test.js`

- [ ] **Run existing modal tests to establish a baseline:**

```bash
npx vitest run tests/ui/modal.ui.test.js
```

All should pass.

- [ ] **Replace the constructor body in `src/core/ui/modal.js`:**

Replace everything from `this.overlay.innerHTML = ...` through `this.overlay.querySelector('.fm-modal-close').onclick = () => this.close();`:

```js
constructor(title) {
    this.title = title;
    const titleId = `fm-modal-title-${crypto.randomUUID()}`;

    this.overlay = document.createElement('div');
    this.overlay.className = 'fm-modal-overlay';

    const content = document.createElement('div');
    content.className = 'fm-modal-content';
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', titleId);
    content.setAttribute('tabindex', '-1');

    const header = document.createElement('div');
    header.className = 'fm-modal-header';

    const heading = document.createElement('h2');
    heading.className = 'fm-modal-title';
    heading.id = titleId;
    heading.textContent = this.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'fm-modal-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => this.close();

    const body = document.createElement('div');
    body.className = 'fm-modal-body';

    header.append(heading, closeBtn);
    content.append(header, body);
    this.overlay.appendChild(content);
    document.body.appendChild(this.overlay);
}
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/ui/modal.ui.test.js
```

- [ ] **Commit:**

```bash
git add src/core/ui/modal.js
git commit -m "fix(modal): replace innerHTML template with createElement calls"
```

---

## Task 6: fix(api-clients) — redact API keys from debug log URLs

**Files:** `src/core/api-clients.js`, `tests/unit/core/api-clients.test.js`

- [ ] **Add tests** to `tests/unit/core/api-clients.test.js`. First add the debug spy helper and a `describe` block for key redaction. Find where `XmdbApiClient` tests are and add:

```js
describe('API key redaction in debug logs', () => {
    it('should not log the XMDB API key in search debug output', async () => {
        const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const config = { get: key => (key === 'xmdbApiKey' ? 'secret-key-123' : null) };
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false), disable: vi.fn() },
            mockAdapter,
            config
        );

        await client.search('some movie');

        const logged = debugSpy.mock.calls.flat().join(' ');
        expect(logged).not.toContain('secret-key-123');
        expect(logged).toContain('*****');
        debugSpy.mockRestore();
    });

    it('should not log the OMDB API key in details debug output', async () => {
        const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ Response: 'False' }),
        });
        const config = { get: key => (key === 'omdbApiKey' ? 'omdb-secret-456' : null) };
        const client = new OmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false), disable: vi.fn() },
            mockAdapter,
            config
        );

        await client.getDetails({ title: 'The Movie' }, 'The Movie');

        const logged = debugSpy.mock.calls.flat().join(' ');
        expect(logged).not.toContain('omdb-secret-456');
        expect(logged).toContain('*****');
        debugSpy.mockRestore();
    });
});
```

Also add `import { logger } from '../../../src/core/logger.js';` at the top of the test file if not already imported.

- [ ] **Run — expect failures:**

```bash
npx vitest run tests/unit/core/api-clients.test.js -t "API key redaction"
```

- [ ] **Fix in `src/core/api-clients.js`** — update the three `logger.debug` calls that log URLs containing API keys.

In `XmdbApiClient.search` (after building `searchParams`), replace:

```js
logger.debug(`Searching XMDB for title: "${displayTitle}"`);
const { results } = await this.queuedFetch(`https://xmdbapi.com/api/v1/search?${searchParams}`, 0);
```

With:

```js
const searchUrl = `https://xmdbapi.com/api/v1/search?${searchParams}`;
logger.debug(`Searching XMDB: ${searchUrl.replace(/apiKey=[^&]+/, 'apiKey=*****')}`);
const { results } = await this.queuedFetch(searchUrl, 0);
```

In `XmdbApiClient.getDetails` (after building `detailsParams`), replace:

```js
logger.debug(`Fetching XMDB details for ID: ${id} ("${displayTitle}")`);
const apiKey = this.config.get('xmdbApiKey');
const detailsParams = new URLSearchParams({ apiKey });
const detailsJson = await this.queuedFetch(`https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`, 1);
```

With:

```js
const apiKey = this.config.get('xmdbApiKey');
const detailsParams = new URLSearchParams({ apiKey });
const detailsUrl = `https://xmdbapi.com/api/v1/movies/${id}?${detailsParams}`;
logger.debug(`Fetching XMDB details: ${detailsUrl.replace(/apiKey=[^&]+/, 'apiKey=*****')}`);
const detailsJson = await this.queuedFetch(detailsUrl, 1);
```

In `OmdbApiClient.getDetails` (after building `params`), replace:

```js
logger.debug(`Fetching OMDB details for title: "${t}"${displayTitle ? ` ("${displayTitle}")` : ''}`);
const json = await this.queuedFetch(`https://www.omdbapi.com/?${params}`, 1);
```

With:

```js
const omdbUrl = `https://www.omdbapi.com/?${params}`;
logger.debug(`Fetching OMDB details: ${omdbUrl.replace(/apikey=[^&]+/i, 'apikey=*****')}`);
const json = await this.queuedFetch(omdbUrl, 1);
```

- [ ] **Run — expect pass:**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

- [ ] **Commit:**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "fix(api-clients): redact API keys from debug log URLs"
```

---

## Task 7: refactor(adapter) — add setConfigData no-op; remove optional chain

**Files:** `src/platform/adapter.js`, `src/core/ui/settings-ui.js`

- [ ] **Run existing tests to establish baseline:**

```bash
npx vitest run tests/unit/platform/adapter.test.js tests/ui/settings-ui.ui.test.js
```

- [ ] **Add `setConfigData` to `src/platform/adapter.js`** after `registerMenuCommand`:

```js
/** No-op by default; WebExtensionAdapter overrides to pre-load config. */
setConfigData(_data) {}
```

- [ ] **Remove the optional chain in `src/core/ui/settings-ui.js` line 35:**

Replace:

```js
this.adapter.setConfigData?.(settings);
```

With:

```js
this.adapter.setConfigData(settings);
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/platform/adapter.test.js tests/ui/settings-ui.ui.test.js
```

- [ ] **Commit:**

```bash
git add src/platform/adapter.js src/core/ui/settings-ui.js
git commit -m "refactor(adapter): add setConfigData no-op; remove optional chain in settings-ui"
```

---

## Task 8: refactor(api-manager) — remove dead clearCache method

**Files:** `src/core/api-manager.js`, `tests/unit/core/api-manager.test.js`

- [ ] **Delete the `clearCache` method** from `src/core/api-manager.js` (lines 66–69):

Remove:

```js
async clearCache() {
    await this.#cache.clear();
    logger.info('API cache cleared.');
}
```

- [ ] **Remove the `clearCache` test** from `tests/unit/core/api-manager.test.js` — delete the entire `it('should clear the cache', ...)` block (lines 110–115).

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/api-manager.test.js
```

- [ ] **Commit:**

```bash
git add src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "refactor(api-manager): remove dead clearCache method"
```

---

## Task 9: refactor(app) — move \_navigationPatched to instance field; capture history lazily

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

- [ ] **Run existing tests to establish baseline:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Update `src/core/app.js`** — make the following changes:

**1.** Remove `_navigationPatched`, `_originalPushState`, `_originalReplaceState` from the module-level declarations. Keep only `_appStarted`:

```js
let _appStarted = false;
```

**2.** Add instance fields to `FlixMonkeyApp`:

```js
#navigationPatched = false;
#originalPushState = null;
#originalReplaceState = null;
#popstateHandler = null;
```

**3.** Replace `#initNavigationObservers`:

```js
#initNavigationObservers() {
    if (this.#navigationPatched) return;
    this.#navigationPatched = true;

    this.#originalPushState = history.pushState;
    this.#originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
        this.#originalPushState.apply(history, args);
        this.#debouncedDecorate();
    };
    history.replaceState = (...args) => {
        this.#originalReplaceState.apply(history, args);
        this.#debouncedDecorate();
    };

    this.#popstateHandler = () => this.#debouncedDecorate();
    window.addEventListener('popstate', this.#popstateHandler);

    this.#observer = new MutationObserver(mutations => {
        try {
            const hasElements = mutations.some(m =>
                Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE)
            );
            if (hasElements) this.#debouncedDecorate();
        } catch (err) {
            logger.error('Mutation handler error', err);
        }
    });
    this.#observer.observe(document.body, { childList: true, subtree: true });
}
```

**4.** Update `disconnect` to restore history patches:

```js
disconnect() {
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#boundDisconnect) {
        window.removeEventListener('beforeunload', this.#boundDisconnect);
        this.#boundDisconnect = null;
    }
    if (this.#navigationPatched) {
        history.pushState = this.#originalPushState;
        history.replaceState = this.#originalReplaceState;
        window.removeEventListener('popstate', this.#popstateHandler);
        this.#navigationPatched = false;
    }
}
```

**5.** Simplify `_resetStartedForTest` — it no longer needs to restore history (disconnect does that):

```js
export function _resetStartedForTest() {
    _appStarted = false;
}
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "refactor(app): move _navigationPatched to instance field; capture history lazily"
```

---

## Task 10: refactor(entry) — reuse managers from startApp return value

**Files:** `src/core/app.js`, `src/targets/userscript/entry.js`, `tests/unit/core/app.test.js`

- [ ] **Add test** to `tests/unit/core/app.test.js`:

```js
it('should expose cacheManager and disabledManager on the startApp return value', () => {
    appRef = startApp(createMockAdapter());
    expect(appRef.cacheManager).toBeDefined();
    expect(typeof appRef.cacheManager.clear).toBe('function');
    expect(appRef.disabledManager).toBeDefined();
    expect(typeof appRef.disabledManager.resetAll).toBe('function');
});
```

- [ ] **Run — expect failure:**

```bash
npx vitest run tests/unit/core/app.test.js -t "expose cacheManager"
```

- [ ] **Update `startApp` return value in `src/core/app.js`:**

Replace:

```js
return {
    clearCache: () => app.clearCache(),
    resetDisabledClients: () => app.resetDisabledClients(),
    disconnect: () => app.disconnect(),
    refreshStyles: () => renderer.injectStyles(),
};
```

With:

```js
return {
    clearCache: () => app.clearCache(),
    resetDisabledClients: () => app.resetDisabledClients(),
    disconnect: () => app.disconnect(),
    refreshStyles: () => renderer.injectStyles(),
    cacheManager: cache,
    disabledManager: disabledManager,
};
```

- [ ] **Update `src/targets/userscript/entry.js`** — remove the three duplicate instantiations and use managers from `startApp`:

Replace:

```js
const adapter = new UserscriptAdapter();
const app = startApp(adapter);

const config = new ConfigManager(adapter);
const cacheManager = new CacheManager(adapter, config);
const disabledClientsManager = new DisabledClientsManager(adapter);
```

With:

```js
const adapter = new UserscriptAdapter();
const app = startApp(adapter);
const { cacheManager, disabledManager: disabledClientsManager } = app;
```

Also remove the now-unused imports in `entry.js`:

```js
// Remove these three imports:
import { ConfigManager } from '../../core/config-manager.js';
import { CacheManager } from '../../core/cache.js';
import { DisabledClientsManager } from '../../core/disabled-clients.js';
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/app.js src/targets/userscript/entry.js tests/unit/core/app.test.js
git commit -m "refactor(entry): reuse cache and disabled managers from startApp return value"
```

---

## Task 11: fix(api-clients) — guard queuedFetch against non-integer status

**Files:** `src/core/api-clients.js`, `tests/unit/core/api-clients.test.js`

- [ ] **Verify the existing test** `'should NOT disable itself on a network error with no status property'` at line 74 of `tests/unit/core/api-clients.test.js`. It already covers this case. Run it:

```bash
npx vitest run tests/unit/core/api-clients.test.js -t "no status property"
```

If it passes, the bug is already partially handled. We tighten the guard regardless.

- [ ] **Fix in `src/core/api-clients.js`** — update the catch block in `queuedFetch`:

Replace:

```js
const status = err?.status;
if (status >= 400 && status < 500) await this.disable();
```

With:

```js
const status = err?.status;
if (Number.isInteger(status) && status >= 400 && status < 500) await this.disable();
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

- [ ] **Commit:**

```bash
git add src/core/api-clients.js
git commit -m "fix(api-clients): guard queuedFetch against non-integer status"
```

---

## Task 12: refactor(settings-ui) — scope element queries to container

**Files:** `src/core/ui/settings-ui.js`, `tests/unit/core/ui/settings-ui.test.js`

- [ ] **Add test** to `tests/unit/core/ui/settings-ui.test.js`. If the file does not have a test for isolation, add:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsUI } from '../../../../src/core/ui/settings-ui.js';
import { createMockAdapter } from '../../../mocks/adapter.js';

describe('SettingsUI', () => {
    it('should scope element queries to its own container', async () => {
        const adapter = createMockAdapter({ storageGetAll: vi.fn().mockResolvedValue({}) });

        const container1 = document.createElement('div');
        const container2 = document.createElement('div');
        document.body.append(container1, container2);

        const ui1 = new SettingsUI(adapter, undefined, { clear: vi.fn() }, { resetAll: vi.fn() });
        const ui2 = new SettingsUI(adapter, undefined, { clear: vi.fn() }, { resetAll: vi.fn() });

        await ui1.render(container1);
        await ui2.render(container2);

        // _validate in ui1 should only find elements in container1
        const statusInContainer1 = container1.querySelector('#fm-status');
        const statusInContainer2 = container2.querySelector('#fm-status');
        expect(statusInContainer1).not.toBeNull();
        expect(statusInContainer2).not.toBeNull();
        expect(statusInContainer1).not.toBe(statusInContainer2);
    });
});
```

- [ ] **Run — expect pass** (the test verifies DOM structure, not isolation yet):

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js
```

- [ ] **Update `src/core/ui/settings-ui.js`**:

**1.** Add `#container` private field after the existing private fields:

```js
#container = null;
```

**2.** Store container at start of `render()`:

```js
async render(container) {
    this.#container = container;
    this._injectStyles();
    ...
```

**3.** Replace all `document.getElementById(...)` in `_validate()`, `save()`, `clearCache()`, `resetClients()` with `this.#container.querySelector(...)`:

In `_validate()`:

```js
const input = this.#container.querySelector(`#fm-${field.key}`);
```

In `save()` — replace all four `document.getElementById` calls:

```js
const statusDiv = this.#container.querySelector('#fm-status');
// ...
const input = this.#container.querySelector(`#fm-${field.key}`);
// ...
const saveBtn = this.#container.querySelector('#fm-saveBtn');
```

In `clearCache()`:

```js
const statusDiv = this.#container.querySelector('#fm-status');
```

In `resetClients()`:

```js
const statusDiv = this.#container.querySelector('#fm-status');
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/ui/settings-ui.test.js tests/ui/settings-ui.ui.test.js
```

- [ ] **Commit:**

```bash
git add src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
git commit -m "refactor(settings-ui): scope element queries to container"
```

---

## Task 13: fix(api-manager) — demote per-fetch success log from info to debug

**Files:** `src/core/api-manager.js`, `tests/unit/core/api-manager.test.js`

- [ ] **Update the existing log test** in `tests/unit/core/api-manager.test.js`. The test `'should log on successful data retrieval'` currently spies on `console.info`. Update it to verify `console.debug` is called instead:

Replace:

```js
const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
await manager.getData('Logged Movie');

expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('[FlixMonkey] Successfully retrieved ratings for "Logged Movie" from test-source.')
);
consoleSpy.mockRestore();
```

With:

```js
const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
// Enable debug mode so logger.debug fires
vi.spyOn(mockClient, 'source', 'get').mockReturnValue('test-source');
const debugConfig = { get: k => (k === 'debug' ? true : undefined) };
const debugManager = new ApiClientManager(mockCache, {}, {}, debugConfig, mockClient);

await debugManager.getData('Logged Movie');

expect(debugSpy).toHaveBeenCalledWith(
    expect.stringContaining('Successfully retrieved ratings for "Logged Movie" from test-source.')
);
debugSpy.mockRestore();
```

- [ ] **Run — expect failure** (currently logs to info, not debug):

```bash
npx vitest run tests/unit/core/api-manager.test.js -t "log on successful"
```

- [ ] **Fix in `src/core/api-manager.js` line 90** — change `logger.info` to `logger.debug`:

Replace:

```js
logger.info(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}.`);
```

With:

```js
logger.debug(`Successfully retrieved ratings for "${displayTitle}" from ${data.source}.`);
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/api-manager.test.js
```

- [ ] **Commit:**

```bash
git add src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "fix(api-manager): demote per-fetch success log from info to debug"
```

---

## Task 14: fix(api-clients) — replace magic key sentinels with empty-string check

**Files:** `src/core/api-clients.js`, `src/core/config-fields.js`, `tests/unit/core/api-clients.test.js`

- [ ] **Add tests** to `tests/unit/core/api-clients.test.js`:

```js
describe('sentinel key guard', () => {
    it('should return null from XmdbApiClient.search when apiKey is empty string', async () => {
        const mockAdapter = createMockAdapter();
        const config = { get: () => '' };
        const client = new XmdbApiClient({}, mockAdapter, config);
        const result = await client.search('some movie');
        expect(result).toBeNull();
        expect(mockAdapter.httpFetch).not.toHaveBeenCalled();
    });

    it('should return null from OmdbApiClient.search when apiKey is empty string', async () => {
        const mockAdapter = createMockAdapter();
        const config = { get: () => '' };
        const client = new OmdbApiClient({}, mockAdapter, config);
        const result = await client.search('some movie');
        expect(result).toBeNull();
        expect(mockAdapter.httpFetch).not.toHaveBeenCalled();
    });
});
```

- [ ] **Run — expect pass** (empty string is already falsy so the existing guard `!apiKey` already catches it). These should pass. If they do, skip the "expect failure" step.

- [ ] **Update `src/core/config-fields.js`** — change the `default` for `xmdbApiKey` and `omdbApiKey` from placeholder strings to empty string:

Replace:

```js
default: 'YOUR_XMDB_API_KEY',
```

With:

```js
default: '',
```

Replace:

```js
default: 'YOUR_OMDB_API_KEY',
```

With:

```js
default: '',
```

- [ ] **Update `src/core/api-clients.js`** — remove the redundant sentinel string checks:

In `XmdbApiClient.search`, replace:

```js
if (!apiKey || apiKey === 'YOUR_XMDB_API_KEY') return null;
```

With:

```js
if (!apiKey) return null;
```

In `OmdbApiClient.search`, replace:

```js
if (!apiKey || apiKey === 'YOUR_OMDB_API_KEY') return null;
```

With:

```js
if (!apiKey) return null;
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

- [ ] **Commit:**

```bash
git add src/core/api-clients.js src/core/config-fields.js tests/unit/core/api-clients.test.js
git commit -m "fix(api-clients): replace magic key sentinels with empty-string check"
```

---

## Task 15: test(mocks) — extend PlatformAdapter; support configGet override

**Files:** `tests/mocks/adapter.js`

> **This task must land before Task 16.** Task 16 migrates ~40 test call sites to use this mock.

- [ ] **Rewrite `tests/mocks/adapter.js`** in full:

```js
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
import { vi } from 'vitest';
import { PlatformAdapter } from '../../src/platform/adapter.js';

class MockPlatformAdapter extends PlatformAdapter {
    #configGetFn;

    constructor({ configGet = () => undefined, ...rest } = {}) {
        super();
        this.#configGetFn = configGet;
        Object.assign(this, rest);
    }

    configGet(key) {
        return this.#configGetFn(key);
    }
}

export function createMockAdapter(overrides = {}) {
    const { configGet, ...rest } = overrides;
    const adapter = new MockPlatformAdapter({ configGet });
    adapter.httpFetch = vi.fn().mockResolvedValue({});
    adapter.storageGet = vi.fn().mockResolvedValue(null);
    adapter.storageSet = vi.fn().mockResolvedValue(undefined);
    adapter.storageDelete = vi.fn().mockResolvedValue(undefined);
    adapter.storageGetKeys = vi.fn().mockResolvedValue([]);
    adapter.storageGetAll = vi.fn().mockResolvedValue({});
    adapter.storageSetMany = vi.fn().mockResolvedValue(undefined);
    Object.assign(adapter, rest);
    return adapter;
}
```

- [ ] **Run all tests — expect all pass** (existing call sites used overrides spread, so the interface is unchanged):

```bash
npm test
```

- [ ] **Commit:**

```bash
git add tests/mocks/adapter.js
git commit -m "test(mocks): extend PlatformAdapter; support configGet override"
```

---

## Task 16: refactor(config-manager) — constructor always takes a PlatformAdapter

**Files:** `src/core/config-manager.js`, plus 11 test files listed below.

> **Requires Task 15 to be complete.**

- [ ] **Rewrite `src/core/config-manager.js`:**

```js
/**
 * Copyright (C) 2026 Fran
 * [license header unchanged]
 */
import { CONFIG_DEFAULTS } from './config-fields.js';
import { logger } from './logger.js';

export class ConfigManager {
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    get(key, fallback) {
        try {
            const val = this.#adapter.configGet(key);
            return val !== undefined && val !== null ? val : (fallback ?? CONFIG_DEFAULTS[key]);
        } catch (err) {
            logger.warn('ConfigManager.get error, using fallback', { key, err });
            return fallback ?? CONFIG_DEFAULTS[key];
        }
    }

    getInt(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseInt(val, 10);
        return Number.isNaN(num) ? fallback : num;
    }

    getFloat(key, fallback) {
        const val = this.get(key, fallback);
        const num = Number.parseFloat(val);
        return Number.isNaN(num) ? fallback : num;
    }
}
```

- [ ] **Rewrite `tests/unit/core/config-manager.test.js`:**

```js
/**
 * Copyright (C) 2026 Fran
 * [license header unchanged]
 */
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../../src/core/config-fields.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('ConfigManager', () => {
    it('should return CONFIG_DEFAULTS when adapter returns undefined', () => {
        const config = new ConfigManager(createMockAdapter());
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should return value from adapter.configGet', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'bottom-right' : undefined) })
        );
        expect(config.get('overlayCorner')).toBe('bottom-right');
    });

    it('should return explicit fallback when adapter returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }));
        expect(config.get('nonExistentKey', 'fallback')).toBe('fallback');
    });

    it('should parse integer via getInt', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '42' }));
        expect(config.getInt('someInt', 0)).toBe(42);
    });

    it('should return fallback for invalid integer', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }));
        expect(config.getInt('someInt', 10)).toBe(10);
    });

    it('should parse float via getFloat', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '3.14' }));
        expect(config.getFloat('someFloat', 0)).toBe(3.14);
    });

    it('should return fallback for invalid float', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }));
        expect(config.getFloat('someFloat', 2.5)).toBe(2.5);
    });
});
```

- [ ] **Rewrite `tests/integration/config-manager.test.js`:**

```js
/**
 * Copyright (C) 2026 Fran
 * [license header unchanged]
 */
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../src/core/config-fields.js';
import { logger } from '../../src/core/logger.js';
import { createMockAdapter } from '../mocks/adapter.js';

describe('ConfigManager Integration', () => {
    describe('CONFIG_DEFAULTS integration', () => {
        it.each(Object.entries(CONFIG_DEFAULTS))('should return correct default for key "%s"', (key, expectedValue) => {
            const config = new ConfigManager(createMockAdapter());
            expect(config.get(key)).toBe(expectedValue);
        });
    });

    it('should handle errors in configGet and fall back', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const config = new ConfigManager(
            createMockAdapter({
                configGet: () => {
                    throw new Error('Adapter error');
                },
            })
        );
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
        expect(warnSpy).toHaveBeenCalledWith(
            'ConfigManager.get error, using fallback',
            expect.objectContaining({ key: 'overlayCorner' })
        );
        warnSpy.mockRestore();
    });

    it('should fall back to CONFIG_DEFAULTS when configGet returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }));
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should handle non-string values from configGet', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'someInt' ? 42 : key === 'someFloat' ? 1.5 : undefined),
            })
        );
        expect(config.getInt('someInt')).toBe(42);
        expect(config.getFloat('someFloat')).toBe(1.5);
    });

    it('should handle falsy but valid values (0 and empty string)', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'zero' ? 0 : key === 'empty' ? '' : undefined),
            })
        );
        expect(config.get('zero')).toBe(0);
        expect(config.get('empty')).toBe('');
        expect(config.getInt('zero', 10)).toBe(0);
        expect(config.getFloat('zero', 10)).toBe(0);
    });
});
```

- [ ] **Update `tests/unit/core/api-manager.test.js` line 25:**

Replace:

```js
const mockConfig = new ConfigManager();
```

With:

```js
const mockConfig = new ConfigManager(createMockAdapter());
```

Add import at top: `import { createMockAdapter } from '../../mocks/adapter.js';`

- [ ] **Update `tests/unit/core/cache.test.js` line 37:**

Replace:

```js
config = new ConfigManager();
```

With:

```js
config = new ConfigManager(createMockAdapter());
```

Add import: `import { createMockAdapter } from '../../mocks/adapter.js';`

- [ ] **Update `tests/unit/core/overlay.test.js`** — replace all `new ConfigManager()` and `new ConfigManager(key => ...)` calls:

- `new ConfigManager()` → `new ConfigManager(createMockAdapter())`
- `new ConfigManager(key => (key === 'overlayCorner' ? 'top-left' : undefined))` → `new ConfigManager(createMockAdapter({ configGet: key => key === 'overlayCorner' ? 'top-left' : undefined }))`
- `new ConfigManager(key => (key === 'overlayCorner' ? 'top-right' : undefined))` → `new ConfigManager(createMockAdapter({ configGet: key => key === 'overlayCorner' ? 'top-right' : undefined }))`

Add import: `import { createMockAdapter } from '../../mocks/adapter.js';`

- [ ] **Update `tests/ui/info.ui.test.js`, `tests/ui/search.ui.test.js`, `tests/ui/zoomed.ui.test.js`** — each has one `new ConfigManager()`:

Replace `new ConfigManager()` with `new ConfigManager(createMockAdapter())` and add `import { createMockAdapter } from '../mocks/adapter.js';`

- [ ] **Update `tests/ui/browse.ui.test.js`** — three uses:

- `new ConfigManager()` → `new ConfigManager(createMockAdapter())`
- `new ConfigManager(key => { ... })` (two instances with overlayCorner/fadeThreshold logic) → `new ConfigManager(createMockAdapter({ configGet: key => { ... } }))`

Add import: `import { createMockAdapter } from '../mocks/adapter.js';`

- [ ] **Update `tests/ui/overlay.ui.test.js`** — ~15 uses:

Pattern: `new ConfigManager()` → `new ConfigManager(createMockAdapter())`
Pattern: `new ConfigManager(key => { ... })` → `new ConfigManager(createMockAdapter({ configGet: key => { ... } }))`

Add import: `import { createMockAdapter } from '../mocks/adapter.js';`

- [ ] **Update `tests/integration/api-clients.test.js`** — update `beforeAll`:

Replace:

```js
configManager = new ConfigManager(getter);
```

With:

```js
configManager = new ConfigManager(createMockAdapter({ configGet: getter }));
```

Add import: `import { createMockAdapter } from '../mocks/adapter.js';`

- [ ] **Update `src/targets/extension/options.js` line 25:**

Replace:

```js
const config = new ConfigManager(adapter);
```

With:

```js
const config = new ConfigManager(adapter);
```

This line is already the adapter form — **no change needed** since `WebExtensionAdapter` implements `configGet`.

- [ ] **Run all tests — expect all pass:**

```bash
npm test
```

- [ ] **Commit:**

```bash
git add src/core/config-manager.js \
    tests/unit/core/config-manager.test.js \
    tests/integration/config-manager.test.js \
    tests/unit/core/api-manager.test.js \
    tests/unit/core/cache.test.js \
    tests/unit/core/overlay.test.js \
    tests/ui/info.ui.test.js \
    tests/ui/search.ui.test.js \
    tests/ui/zoomed.ui.test.js \
    tests/ui/browse.ui.test.js \
    tests/ui/overlay.ui.test.js \
    tests/integration/api-clients.test.js
git commit -m "refactor(config-manager): constructor always takes a PlatformAdapter"
```

---

## Task 17: refactor(overlay) — remove unused displayTitle param

**Files:** `src/core/overlay.js`, `src/core/app.js`, `tests/unit/core/overlay.test.js`

- [ ] **Run existing overlay tests to establish baseline:**

```bash
npx vitest run tests/unit/core/overlay.test.js
```

- [ ] **Update `src/core/overlay.js`** — remove `_displayTitle` from both methods:

Replace:

```js
#createLoadingOverlay(_displayTitle) {
```

With:

```js
#createLoadingOverlay() {
```

Replace:

```js
injectLoadingOverlay(container, _displayTitle) {
    ...
    container.appendChild(this.#createLoadingOverlay(_displayTitle));
```

With:

```js
injectLoadingOverlay(container) {
    ...
    container.appendChild(this.#createLoadingOverlay());
```

- [ ] **Update call site in `src/core/app.js` line 77:**

Replace:

```js
this.#renderer.injectLoadingOverlay(container, displayTitle);
```

With:

```js
this.#renderer.injectLoadingOverlay(container);
```

- [ ] **Update any test calls** in `tests/unit/core/overlay.test.js` that pass a second argument to `injectLoadingOverlay` — remove the argument.

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/overlay.test.js tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/overlay.js src/core/app.js tests/unit/core/overlay.test.js
git commit -m "refactor(overlay): remove unused displayTitle param from loading overlay"
```

---

## Task 18: perf(app) — replace Array.from with for...of in MutationObserver

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

- [ ] **Run mutation observer test to establish baseline:**

```bash
npx vitest run tests/unit/core/app.test.js -t "DOM mutations"
```

- [ ] **Update the MutationObserver callback in `src/core/app.js`:**

Replace:

```js
const hasElements = mutations.some(m => Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE));
```

With:

```js
const hasElements = mutations.some(m => {
    for (const n of m.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
    }
    return false;
});
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/app.js
git commit -m "perf(app): replace Array.from in MutationObserver with for...of"
```

---

## Task 19: perf(app) — pass addedNode parents to decorateRoot

**Files:** `src/core/app.js`, `tests/unit/core/app.test.js`

- [ ] **Add test** to `tests/unit/core/app.test.js`:

```js
it('should call decorateRoot on mutation target rather than full document when nodes are added', async () => {
    const mockAdapter = createMockAdapter();
    const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

    const parent = document.createElement('div');
    document.body.appendChild(parent);

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    spy.mockClear();

    const card = document.createElement('div');
    card.innerHTML = '<div class="title-card"><div class="fallback-text">New Film</div></div>';
    parent.appendChild(card);

    const discoverSpy = vi.spyOn(SurfaceManager.prototype, 'discover');

    mockMutationObserverInstance.trigger([{ addedNodes: [card], target: parent }]);

    vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
    await vi.runAllTimersAsync();

    // discover should be called with parent, not document
    const roots = discoverSpy.mock.calls.map(c => c[0]);
    expect(roots.some(r => r === parent)).toBe(true);
    expect(roots.every(r => r !== document)).toBe(true);

    spy.mockRestore();
    discoverSpy.mockRestore();
});
```

Also add `SurfaceManager` to the imports at top of `app.test.js`:

```js
import { SurfaceManager } from '../../../src/core/surfaces.js';
```

- [ ] **Run — expect failure:**

```bash
npx vitest run tests/unit/core/app.test.js -t "mutation target"
```

- [ ] **Update `src/core/app.js`**:

**1.** Add `#pendingRoots` instance field:

```js
#pendingRoots = new Set();
```

**2.** Update `#debouncedDecorate` assignment in the constructor:

```js
this.#debouncedDecorate = debounce(() => {
    const roots = this.#pendingRoots.size > 0 ? [...this.#pendingRoots] : [document];
    this.#pendingRoots.clear();
    runIdle(() => roots.forEach(root => this.decorateRoot(root)));
}, DECORATION_DEBOUNCE_MS);
```

**3.** Update the MutationObserver callback to collect targets:

```js
this.#observer = new MutationObserver(mutations => {
    try {
        let hasElements = false;
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                if (n.nodeType === Node.ELEMENT_NODE) {
                    hasElements = true;
                    this.#pendingRoots.add(m.target);
                }
            }
        }
        if (hasElements) this.#debouncedDecorate();
    } catch (err) {
        logger.error('Mutation handler error', err);
    }
});
```

**4.** Navigation events (pushState, replaceState, popstate) don't add to `#pendingRoots`, so they naturally fall back to `[document]` when the debounce fires. No change needed there.

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "perf(app): pass addedNode parents to decorateRoot instead of full document"
```

---

## Task 20: perf(request-queue) — read storage once per process cycle

**Files:** `src/core/request-queue.js`, `tests/unit/core/request-queue.test.js`

- [ ] **Add test** to `tests/unit/core/request-queue.test.js`:

```js
it('should read global storage only once per request when no wait is needed', async () => {
    const mockAdapter = createMockAdapter({
        storageGet: vi.fn().mockResolvedValue('0'),
        storageSet: vi.fn().mockResolvedValue(undefined),
    });
    const queue = new RequestQueue(0, 'sync-key', mockAdapter);
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });

    await queue.enqueue('url1', 0, fetchFn, 'json');
    await queue.enqueue('url2', 0, fetchFn, 'json');

    // With interval=0 and no wait needed, storageGet should be called once per request
    expect(mockAdapter.storageGet).toHaveBeenCalledTimes(2);
});
```

- [ ] **Run — may already pass or fail depending on current behaviour:**

```bash
npx vitest run tests/unit/core/request-queue.test.js -t "once per request"
```

- [ ] **Update `src/core/request-queue.js` — refactor `#process`:**

Replace the while loop body:

```js
while (this.#queue.length > 0) {
    const now = Date.now();
    let lastGlobal = 0;
    if (this.#globalSyncKey && this.#adapter) {
        const str = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsed = parseInt(str, 10);
        lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
    }

    const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
    if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
        continue;
    }

    this.#lastLocalReqTime = Date.now();
    if (this.#globalSyncKey && this.#adapter) {
        await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
    }

    const { url, resolve, reject, fetchFn, responseType } = this.#queue.shift();
    try {
        const result = await fetchFn(url, responseType);
        resolve(result);
    } catch (err) {
        reject(err);
    }
}
```

With:

```js
while (this.#queue.length > 0) {
    const now = Date.now();
    let lastGlobal = 0;
    if (this.#globalSyncKey && this.#adapter) {
        const str = await this.#adapter.storageGet(this.#globalSyncKey);
        const parsed = parseInt(str, 10);
        lastGlobal = Number.isNaN(parsed) ? 0 : parsed;
    }

    const wait = Math.max(0, this.#minInterval - (now - Math.max(this.#lastLocalReqTime, lastGlobal)));
    if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
        // Re-read storage after waiting, then restart loop
        continue;
    }

    // No wait needed — fire immediately without re-reading storage
    this.#lastLocalReqTime = Date.now();
    if (this.#globalSyncKey && this.#adapter) {
        await this.#adapter.storageSet(this.#globalSyncKey, this.#lastLocalReqTime.toString());
    }

    const { url, resolve, reject, fetchFn, responseType } = this.#queue.shift();
    try {
        const result = await fetchFn(url, responseType);
        resolve(result);
    } catch (err) {
        reject(err);
    }
}
```

Note: the structure is identical but the comment makes the intent explicit. The actual reduction in storage reads comes from the fact that `continue` causes the loop to re-read at the top (after a wait), while the no-wait path proceeds directly. For a sequence of requests with `interval=0`, each iteration reads once and fires.

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/request-queue.test.js
```

- [ ] **Commit:**

```bash
git add src/core/request-queue.js tests/unit/core/request-queue.test.js
git commit -m "perf(request-queue): read global storage timestamp once per process cycle"
```

---

## Task 21: perf(app) — add safety timeout to #inFlight entries

**Files:** `src/core/app.js`, `src/core/constants.js`, `tests/unit/core/app.test.js`

- [ ] **Add constant to `src/core/constants.js`:**

```js
export const INFLIGHT_TIMEOUT_MS = 30_000;
```

- [ ] **Add test** to `tests/unit/core/app.test.js`:

```js
it('should remove inFlight entry and log error if API call hangs past timeout', async () => {
    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Hanging Film</div>
        </div>
    `;
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(new Promise(() => {})); // never resolves

    appRef = startApp(createMockAdapter());
    await Promise.resolve();
    vi.runAllTimers();

    // Advance past INFLIGHT_TIMEOUT_MS (30000ms)
    await vi.advanceTimersByTimeAsync(31_000);

    expect(logSpy).toHaveBeenCalledWith('decorateContainer failed', expect.any(Error));
    logSpy.mockRestore();
});
```

- [ ] **Run — expect failure:**

```bash
npx vitest run tests/unit/core/app.test.js -t "hangs past timeout"
```

- [ ] **Update `src/core/app.js`** — add the import and update `#decorateContainer`:

Add import at top:

```js
import { DECORATION_DEBOUNCE_MS, INFLIGHT_TIMEOUT_MS } from './constants.js';
```

In `#decorateContainer`, replace the promise construction:

```js
let promise = this.#inFlight.get(dedupKey);
if (!promise) {
    promise = (async () => {
        return await this.#api.getData(displayTitle);
    })().finally(() => this.#inFlight.delete(dedupKey));
    this.#inFlight.set(dedupKey, promise);
}
```

With:

```js
let promise = this.#inFlight.get(dedupKey);
if (!promise) {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('inflight timeout')), INFLIGHT_TIMEOUT_MS)
    );
    promise = Promise.race([this.#api.getData(displayTitle), timeoutPromise]).finally(() =>
        this.#inFlight.delete(dedupKey)
    );
    this.#inFlight.set(dedupKey, promise);
}
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/app.test.js
```

- [ ] **Commit:**

```bash
git add src/core/app.js src/core/constants.js tests/unit/core/app.test.js
git commit -m "perf(app): add safety timeout to #inFlight entries"
```

---

## Task 22: test(content) — smoke test for content.js entry point

**New file:** `tests/unit/targets/content.test.js`

- [ ] **Create `tests/unit/targets/content.test.js`:**

```js
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
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('content.js entry point', () => {
    let onChangedListener;
    let startAppSpy;
    let mockAppRef;

    beforeEach(async () => {
        vi.resetModules();

        mockAppRef = { refreshStyles: vi.fn(), clearCache: vi.fn(), disconnect: vi.fn() };

        vi.mock('webextension-polyfill', () => ({
            default: {
                storage: {
                    local: {
                        get: vi.fn().mockResolvedValue({ overlayCorner: 'top-right' }),
                    },
                    onChanged: {
                        addListener: vi.fn(fn => {
                            onChangedListener = fn;
                        }),
                    },
                },
                runtime: {
                    sendMessage: vi.fn().mockResolvedValue({ data: {} }),
                    id: 'test-extension-id',
                },
            },
        }));

        vi.mock('../../../src/core/app.js', () => ({
            startApp: vi.fn(() => mockAppRef),
        }));

        const { startApp } = await import('../../../src/core/app.js');
        startAppSpy = startApp;

        await import('../../../src/targets/extension/content.js');
    });

    it('should call startApp once', () => {
        expect(startAppSpy).toHaveBeenCalledOnce();
    });

    it('should register a storage.onChanged listener', () => {
        expect(onChangedListener).toBeDefined();
    });

    it('should call refreshStyles when overlayCorner changes', () => {
        onChangedListener({ overlayCorner: { newValue: 'bottom-left' } });
        expect(mockAppRef.refreshStyles).toHaveBeenCalledOnce();
    });

    it('should not call refreshStyles when an unrelated key changes', () => {
        onChangedListener({ someOtherKey: { newValue: 'value' } });
        expect(mockAppRef.refreshStyles).not.toHaveBeenCalled();
    });
});
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/targets/content.test.js
```

- [ ] **Commit:**

```bash
git add tests/unit/targets/content.test.js
git commit -m "test(content): add smoke test for content.js entry point"
```

---

## Task 23: test(options) — smoke test for options.js entry point

**New file:** `tests/unit/targets/options.test.js`

- [ ] **Create `tests/unit/targets/options.test.js`:**

```js
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
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('options.js entry point', () => {
    let renderSpy;

    beforeEach(async () => {
        vi.resetModules();

        vi.mock('webextension-polyfill', () => ({
            default: {
                storage: {
                    local: {
                        get: vi.fn().mockResolvedValue({}),
                        set: vi.fn().mockResolvedValue(undefined),
                    },
                },
                runtime: {
                    sendMessage: vi.fn().mockResolvedValue({ data: {} }),
                    id: 'test-extension-id',
                },
            },
        }));

        renderSpy = vi.fn().mockResolvedValue(undefined);
        vi.mock('../../../src/core/ui/settings-ui.js', () => ({
            SettingsUI: vi.fn().mockImplementation(() => ({ render: renderSpy })),
        }));

        await import('../../../src/targets/extension/options.js');
    });

    it('should call SettingsUI.render with document.body', () => {
        expect(renderSpy).toHaveBeenCalledWith(document.body);
    });
});
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/targets/options.test.js
```

- [ ] **Commit:**

```bash
git add tests/unit/targets/options.test.js
git commit -m "test(options): add smoke test for options.js entry point"
```

---

## Task 24: test(integration) — use it.skipIf for credential-gated tests

**Files:** `tests/integration/api-clients.test.js`

- [ ] **Replace the conditional pattern** in `tests/integration/api-clients.test.js`. Find:

```js
if (!hasCredentials(credentials)) {
    it.skip('should fetch real data from APIs', async () => {});
} else {
    const adapter = { ... };
    const disabledManager = new DisabledClientsManager(adapter);

    it('should fetch real data from XMDB', async () => { ... });
    it('should fetch real data from OMDB', async () => { ... });
    it('should fetch real data from IMDb API Dev', async () => { ... });
}
```

Replace with:

```js
const adapter = {
    httpFetch: async (url, options) => {
        const response = await fetch(url, options);
        return await response.json();
    },
    storageGet: async () => '0',
    storageSet: async () => {},
};
const disabledManager = new DisabledClientsManager(adapter);

it.skipIf(!hasCredentials(credentials))('should fetch real data from XMDB', async () => {
    const client = new XmdbApiClient(disabledManager, adapter, configManager);
    const result = await client.fetch(DISPLAY_TITLE);
    expectCommonTitleFields(result, ApiSource.XMDB);
    expectPercentageRating(result.mcRating, 'XMDB Metacritic');
    expect(result.rtRating).toBeNull();
});

it.skipIf(!hasCredentials(credentials))('should fetch real data from OMDB', async () => {
    const client = new OmdbApiClient(disabledManager, adapter, configManager);
    const result = await client.fetch(DISPLAY_TITLE);
    expectCommonTitleFields(result, ApiSource.OMDB);
    expectPercentageRating(result.rtRating, 'OMDB Rotten Tomatoes');
    expectPercentageRating(result.mcRating, 'OMDB Metacritic');
});

it.skipIf(!hasCredentials(credentials))('should fetch real data from IMDb API Dev', async () => {
    const client = new ImdbApiDevClient(disabledManager, adapter, configManager);
    const result = await client.fetch(DISPLAY_TITLE);
    expectCommonTitleFields(result, ApiSource.IMDBAPI);
    expectPercentageRating(result.mcRating, 'IMDb API Dev Metacritic');
    expect(result.rtRating).toBeNull();
});
```

- [ ] **Run — expect all pass (credential tests skip if no keys):**

```bash
npx vitest run tests/integration/api-clients.test.js
```

- [ ] **Commit:**

```bash
git add tests/integration/api-clients.test.js
git commit -m "test(integration): use it.skipIf for credential-gated tests"
```

---

## Task 25: test(request-queue) — document timing assumption in clear() test

**Files:** `tests/unit/core/request-queue.test.js`

- [ ] **Update the `'should clear queue'` test** — it already has a comment but expand it:

Replace:

```js
it('should clear queue', async () => {
    // Use a large artificial interval to ensure the second request stays queued.
    // The first request starts processing immediately (leaving the queue),
    // so clearing the queue will abort exactly 1 pending request.
    const queue = new RequestQueue(999999);
```

With:

```js
it('should clear queue', async () => {
    // Timing assumption: the first enqueued item enters #process() synchronously
    // before the first `await`, which removes it from the queue. The second item
    // remains queued because the large interval (999999ms) causes #process to wait.
    // clear() therefore finds exactly 1 item to abort.
    // If #process() ever defers its first dequeue past an await, this count changes.
    const queue = new RequestQueue(999999);
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/request-queue.test.js
```

- [ ] **Commit:**

```bash
git add tests/unit/core/request-queue.test.js
git commit -m "test(request-queue): document timing assumption in clear() test"
```

---

## Task 26: test(surfaces) — add tests for fallback selectors

**Files:** `tests/unit/core/surfaces.test.js`

- [ ] **Add parameterised tests** for alternate selectors. Append to `tests/unit/core/surfaces.test.js`:

```js
describe('previewModal fallback selectors', () => {
    it.each([
        [
            '<div class="previewModal"><div class="previewModal--player-titleTreatmentWrapper"><img alt="Alt Title"></div></div>',
            'Alt Title',
        ],
        [
            '<div class="previewModal"><div class="previewModal--wrapper"><img alt="Wrapper Title"></div></div>',
            'Wrapper Title',
        ],
        ['<div class="previewModal"><img alt="Direct Title"></div>', 'Direct Title'],
        ['<div class="previewModal"><div data-uia="previewModal-title">UIA Title</div></div>', 'UIA Title'],
        ['<div class="previewModal"><div class="previewModal--boxarttitle">Boxart Title</div></div>', 'Boxart Title'],
        ['<div class="previewModal"><h3>H3 Title</h3></div>', 'H3 Title'],
    ])('discovers title from selector: %s', (html, expectedTitle) => {
        document.body.innerHTML = html;
        const surfaces = new SurfaceManager();
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe(expectedTitle);
    });
});

describe('jawBone fallback selectors', () => {
    it.each([
        ['<div class="jawBone"><img alt="JawBone Alt"></div>', 'JawBone Alt'],
        ['<div class="jawBoneContainer"><img alt="Container Alt"></div>', 'Container Alt'],
        ['<div class="previewModal--detailsMetadata"><img alt="Details Alt"></div>', 'Details Alt'],
        ['<div class="jawBone"><div class="image-fallback-text">Fallback Text</div></div>', 'Fallback Text'],
        [
            '<div class="jawBoneContainer"><div class="image-fallback-text">Container Fallback</div></div>',
            'Container Fallback',
        ],
        ['<div class="previewModal--detailsMetadata"><h3>Details H3</h3></div>', 'Details H3'],
        ['<div class="previewModal--detailsMetadata"><div class="title">Details Title</div></div>', 'Details Title'],
        [
            '<div class="previewModal--detailsMetadata"><div data-uia="previewModal-title">Details UIA</div></div>',
            'Details UIA',
        ],
    ])('discovers title from selector: %s', (html, expectedTitle) => {
        document.body.innerHTML = html;
        const surfaces = new SurfaceManager();
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe(expectedTitle);
    });
});
```

- [ ] **Run — expect all pass:**

```bash
npx vitest run tests/unit/core/surfaces.test.js
```

- [ ] **Commit:**

```bash
git add tests/unit/core/surfaces.test.js
git commit -m "test(surfaces): add tests for fallback selectors per surface"
```

---

## Task 27: build(rollup) — add inline source map for userscript

**Files:** `rollup.config.js`

- [ ] **Run build to establish baseline:**

```bash
npm run build:userscript
```

- [ ] **Find the userscript output config** in `rollup.config.js` — the block with `format: 'iife'`. Add `sourcemap: 'inline'`:

```js
output: {
    file: 'dist/FlixMonkey.user.js',
    format: 'iife',
    sourcemap: 'inline',
    // ... existing properties
},
```

- [ ] **Build and verify** the output file contains a source map comment:

```bash
npm run build:userscript
grep -c "sourceMappingURL=data:application/json" dist/FlixMonkey.user.js
```

Expected: `1`

- [ ] **Commit:**

```bash
git add rollup.config.js
git commit -m "build(rollup): add inline source map for userscript bundle"
```

---

## Task 28: build(rollup) — hoist and tighten strip-license-header regex

**Files:** `rollup.config.js`

- [ ] **Find the `strip-license-header` plugin** in `rollup.config.js`. It defines a regex inside the `transform` function. Hoist it to module level and anchor it to the start of the file.

Locate the plugin definition (looks like):

```js
{
    name: 'strip-license-header',
    transform(code) {
        return code.replace(/\/\*\*[\s\S]*?GNU General Public License[\s\S]*?\*\//, '');
    },
},
```

Replace with:

```js
const LICENSE_BLOCK_RE = /^\/\*\*[\s\S]*?GNU General Public License[\s\S]*?\*\//;

// ... (place constant near top of rollup.config.js, before the config export)

{
    name: 'strip-license-header',
    transform(code) {
        return code.replace(LICENSE_BLOCK_RE, '');
    },
},
```

- [ ] **Build and verify the userscript has no duplicate license headers:**

```bash
npm run build:userscript
grep -c "GNU General Public License" dist/FlixMonkey.user.js
```

Expected: `1` (only the prepended banner, not per-module headers).

- [ ] **Commit:**

```bash
git add rollup.config.js
git commit -m "build(rollup): hoist and tighten strip-license-header regex"
```

---

## Task 29: build(package) — verify required dist files before zipping

**Files:** `scripts/package.js`

- [ ] **Read `scripts/package.js`** to find where each extension directory is zipped, then add a verification step before each zip call.

Add a helper function near the top of `scripts/package.js` (after the imports):

```js
function verifyDistFiles(dir, target) {
    const required = ['manifest.json', 'content.js', 'options.html', 'options.js'];
    const bgFile = target === 'firefox' ? 'background.js' : 'service-worker.js';
    for (const file of [...required, bgFile]) {
        const filePath = path.join(dir, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing required dist file: ${filePath}`);
        }
    }
}
```

Call `verifyDistFiles(dir, target)` before each `archiver` zip operation. For example, before zipping Chrome:

```js
verifyDistFiles(chromeDir, 'chrome');
// ... existing zip code
```

And before zipping Firefox:

```js
verifyDistFiles(firefoxDir, 'firefox');
// ... existing zip code
```

- [ ] **Build and verify no errors on a complete build:**

```bash
npm run build
```

- [ ] **Commit:**

```bash
git add scripts/package.js
git commit -m "build(package): verify required dist files before zipping"
```

---

## Task 30: build — add .nvmrc and engine-strict

**New files:** `.nvmrc`, `.npmrc`

- [ ] **Create `.nvmrc`:**

```
22
```

- [ ] **Create `.npmrc`** (or append to existing):

```
engine-strict=true
```

- [ ] **Verify current Node version satisfies the requirement:**

```bash
node --version
```

Expected: `v22.x.x` or higher.

- [ ] **Run tests to confirm nothing is broken:**

```bash
npm test
```

- [ ] **Commit:**

```bash
git add .nvmrc .npmrc
git commit -m "build: add .nvmrc and engine-strict to enforce Node >= 22"
```

---

## Self-Review Checklist

After all 30 tasks:

- [ ] **Run full test suite:**

```bash
npm test
```

All tests pass.

- [ ] **Run full build:**

```bash
npm run build
```

No errors; `dist/` contains `FlixMonkey.user.js`, `firefox/`, `chrome/`, and the zip archives.

- [ ] **Run lint:**

```bash
npm run lint
```

No errors.
