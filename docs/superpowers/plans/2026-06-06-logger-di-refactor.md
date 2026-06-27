# Logger DI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the module-level `logger` singleton and two-phase init; make `Logger` a fully-injected constructor dependency consistent with all other objects in the graph.

**Architecture:** `Logger` takes the platform `adapter` directly (reads `configGet('debug')` live). Each class that currently imports the singleton instead receives a `logger` instance via constructor. The singleton persists in `logger.js` throughout Tasks 2–8 as a bridge; Task 9 removes it and wires `startApp` to create `new Logger(adapter)`. Module-level `_appStarted` / `_resetStartedForTest` are removed in Task 9 alongside the singleton cleanup.

**Tech Stack:** Vanilla ES modules, Vitest, no framework.

---

## File Map

| File                                       | Change                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `tests/mocks/logger.js`                    | **Create** — shared `createMockLogger()` test utility                                                                      |
| `src/core/logger.js`                       | **Modify** — constructor takes `adapter`; remove singleton & `setConfig`                                                   |
| `src/core/config-manager.js`               | **Modify** — add `logger` constructor param                                                                                |
| `src/core/cache.js`                        | **Modify** — add `logger` constructor param                                                                                |
| `src/core/surfaces.js`                     | **Modify** — add `logger` constructor param                                                                                |
| `src/core/api-clients.js`                  | **Modify** — add `logger` to `BaseApiClient` and concrete clients                                                          |
| `src/core/api-manager.js`                  | **Modify** — add `logger` param; remove `adapter`, `config`, optional `client`                                             |
| `src/core/app.js`                          | **Modify** — add `logger` to `FlixMonkeyApp`; extract `createApiClient`; wire `startApp`; remove singleton & `_appStarted` |
| `tests/unit/core/logger.test.js`           | **Modify** — test class directly with mock adapter; remove `setConfig` tests                                               |
| `tests/unit/core/config-manager.test.js`   | **Modify** — pass mock logger to constructor                                                                               |
| `tests/unit/core/cache.test.js`            | **Modify** — pass mock logger; use injected mock for spy                                                                   |
| `tests/unit/core/surfaces.test.js`         | **Modify** — pass mock logger; use injected mock for spy                                                                   |
| `tests/unit/core/api-clients.test.js`      | **Modify** — pass mock logger to client constructors                                                                       |
| `tests/unit/core/api-manager.test.js`      | **Modify** — update constructor call; use injected mock for spy; remove factory test                                       |
| `tests/unit/core/app.test.js`              | **Modify** — remove `_resetStartedForTest`; spy on `Logger.prototype`; add logger to constructors                          |
| `tests/integration/config-manager.test.js` | **Modify** — pass mock logger to ConfigManager; use injected mock for logger spy                                           |

---

## Task 1: Create mock logger test utility

**Files:**

- Create: `tests/mocks/logger.js`

- [x] **Step 1: Create the file**

```js
import { vi } from 'vitest';

export function createMockLogger() {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}
```

- [x] **Step 2: Run full test suite to confirm it's still green**

```bash
npm test
```

Expected: all tests pass (no source changes yet).

- [x] **Step 3: Commit**

```bash
git add tests/mocks/logger.js
git commit -m "test(mocks): add createMockLogger utility"
```

---

## Task 2: Refactor `Logger` class

**Files:**

- Modify: `src/core/logger.js`
- Modify: `tests/unit/core/logger.test.js`
- Modify: `src/core/app.js` (remove `logger.setConfig` call)

- [x] **Step 1: Write the failing test**

Replace the entire content of `tests/unit/core/logger.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../../../src/core/logger.js';

describe('core/logger', () => {
    function makeLogger(debugVal = false) {
        return new Logger({ configGet: key => (key === 'debug' ? debugVal : undefined) });
    }

    it('should log warn without crashing', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeLogger().warn('test warning');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test warning');
        spy.mockRestore();
    });

    it('should handle multiple arguments', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeLogger().warn('test', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test', { foo: 'bar' });
        spy.mockRestore();
    });

    it('should log errors', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        makeLogger().error('test error');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test error');
        spy.mockRestore();
    });

    it('should log info', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        makeLogger().info('test info');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test info');
        spy.mockRestore();
    });

    it('should log debug when adapter returns true', () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        makeLogger(true).debug('test debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test debug');
        spy.mockRestore();
    });

    it('should not log debug when adapter returns false', () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        makeLogger(false).debug('test debug');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
```

- [x] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/unit/core/logger.test.js
```

Expected: FAIL — `Logger` constructor does not accept an adapter-shaped object.

- [x] **Step 3: Update `src/core/logger.js`**

Replace the entire file:

```js
export class Logger {
    #prefix = '[FlixMonkey]';
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    debug(message, ...args) {
        if (this.#adapter.configGet('debug') === true) {
            console.debug(`${this.#prefix} ${message}`, ...args);
        }
    }

    info(message, ...args) {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}

// Temporary bridge singleton — removed in Task 9 once all classes inject logger.
export const logger = new Logger({ configGet: () => false });
```

- [x] **Step 4: Remove the dead `logger.setConfig(configManager)` call from `src/core/app.js`**

In `startApp`, delete the line:

```js
logger.setConfig(configManager);
```

- [x] **Step 5: Run the logger tests to verify they pass**

```bash
npx vitest run tests/unit/core/logger.test.js
```

Expected: all 6 tests PASS.

- [x] **Step 6: Run full suite to confirm nothing regressed**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 7: Commit**

```bash
git add src/core/logger.js tests/unit/core/logger.test.js src/core/app.js
git commit -m "refactor(logger): constructor takes adapter, removes setConfig and singleton stub"
```

---

## Task 3: Refactor `ConfigManager`

**Files:**

- Modify: `src/core/config-manager.js`
- Modify: `src/core/app.js`
- Modify: `tests/unit/core/config-manager.test.js`

- [x] **Step 1: Write the failing test**

Add this test to `tests/unit/core/config-manager.test.js` (after existing imports, add `createMockLogger` import; add the test inside the `describe` block):

```js
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../../src/core/config-fields.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

// ... existing tests unchanged, plus:

it('should call injected logger.warn when configGet throws', () => {
    const mockLogger = createMockLogger();
    const adapter = createMockAdapter({
        configGet: () => {
            throw new Error('oops');
        },
    });
    const config = new ConfigManager(adapter, mockLogger);
    config.get('someKey');
    expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigManager.get error, using fallback',
        expect.objectContaining({ key: 'someKey' })
    );
});
```

- [x] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/unit/core/config-manager.test.js
```

Expected: FAIL — `mockLogger.warn` not called (code uses module-level logger, not injected one).

- [x] **Step 3: Update `src/core/config-manager.js`**

Replace constructor and add field:

```js
import { CONFIG_DEFAULTS } from './config-fields.js';

export class ConfigManager {
    #adapter;
    #logger;

    constructor(adapter, logger) {
        this.#adapter = adapter;
        this.#logger = logger;
    }

    get(key, fallback) {
        try {
            const val = this.#adapter.configGet(key);
            return val !== undefined && val !== null ? val : (fallback ?? CONFIG_DEFAULTS[key]);
        } catch (err) {
            this.#logger.warn('ConfigManager.get error, using fallback', { key, err });
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

(Remove the `import { logger } from './logger.js'` line — it no longer exists in this file.)

- [x] **Step 4: Update `src/core/app.js` — pass logger to ConfigManager**

In `startApp`, change:

```js
const configManager = new ConfigManager(adapter);
```

to:

```js
const configManager = new ConfigManager(adapter, logger);
```

(`logger` here is still the bridge singleton imported at the top of app.js.)

- [x] **Step 5: Update all `new ConfigManager(...)` calls in `tests/unit/core/config-manager.test.js`**

Each existing `new ConfigManager(createMockAdapter(...))` call becomes `new ConfigManager(createMockAdapter(...), createMockLogger())`. There are 7 such calls. Update them all.

- [x] **Step 6: Update `new ConfigManager(...)` calls in `tests/unit/core/api-manager.test.js`**

`const mockConfig = new ConfigManager(createMockAdapter());`
becomes: `const mockConfig = new ConfigManager(createMockAdapter(), createMockLogger());`

Also add `import { createMockLogger } from '../../mocks/logger.js'` to that file.

- [x] **Step 7: Update `new ConfigManager(...)` in `tests/unit/core/cache.test.js`**

`config = new ConfigManager(createMockAdapter());`
becomes: `config = new ConfigManager(createMockAdapter(), createMockLogger());`

Also add `import { createMockLogger } from '../../mocks/logger.js'` to that file.

- [x] **Step 8: Update `tests/integration/config-manager.test.js`**

This file imports the singleton `logger` and creates `ConfigManager` without logger. Update it:

```js
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../src/core/config-fields.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';
```

Update all `new ConfigManager(createMockAdapter(...))` calls to pass a mock logger as the second arg.

Update the error-spy test to use an injected mock logger instead of spying on the singleton:

```js
it('should handle errors in configGet and fall back', () => {
    const mockLogger = createMockLogger();
    const config = new ConfigManager(
        createMockAdapter({
            configGet: () => {
                throw new Error('Adapter error');
            },
        }),
        mockLogger
    );
    expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
    expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigManager.get error, using fallback',
        expect.objectContaining({ key: 'overlayCorner' })
    );
});
```

- [x] **Step 9: Run config-manager tests to verify they pass**

```bash
npx vitest run tests/unit/core/config-manager.test.js tests/integration/config-manager.test.js
```

Expected: all tests PASS.

- [x] **Step 10: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 11: Commit**

```bash
git add src/core/config-manager.js src/core/app.js tests/unit/core/config-manager.test.js tests/integration/config-manager.test.js tests/unit/core/api-manager.test.js tests/unit/core/cache.test.js
git commit -m "refactor(config-manager): inject logger via constructor"
```

---

## Task 4: Refactor `CacheManager`

**Files:**

- Modify: `src/core/cache.js`
- Modify: `src/core/app.js`
- Modify: `tests/unit/core/cache.test.js`

- [x] **Step 1: Write the failing test**

In `tests/unit/core/cache.test.js`, update the existing test "should return null and log a warning when JSON parsing fails in read" to use an injected mock logger instead of spying on the module singleton. Also update `beforeEach` to construct `CacheManager` with a logger.

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheManager } from '../../../src/core/cache.js';
import { Title } from '../../../src/core/title.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('CacheManager', () => {
    let adapter;
    let cacheManager;
    let config;
    let mockLogger;

    beforeEach(() => {
        adapter = createMockAdapter({
            storageGet: vi.fn(),
            storageSet: vi.fn(),
            storageDelete: vi.fn(),
            storageGetKeys: vi.fn(),
        });
        mockLogger = createMockLogger();
        config = new ConfigManager(createMockAdapter(), mockLogger);
        cacheManager = new CacheManager(adapter, config, mockLogger);
    });

    // ... all existing tests unchanged except the logger spy test below

    it('should return null and log a warning when JSON parsing fails in read', async () => {
        adapter.storageGet.mockResolvedValue('invalid-json{');
        const result = await cacheManager.read('Some Title');
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', {
            key: 'fmc:some_title',
        });
    });
});
```

- [x] **Step 2: Run to verify the logger spy test fails**

```bash
npx vitest run tests/unit/core/cache.test.js
```

Expected: "should return null and log a warning when JSON parsing fails in read" FAILS — `mockLogger.warn` not called (code still uses module-level logger).

- [x] **Step 3: Update `src/core/cache.js`**

Add `#logger` field and update constructor. Replace the import and constructor:

```js
import { DAYS_TO_MS } from './constants.js';
import { Title } from './title.js';

export class CacheManager {
    #prefix = 'fmc:';
    #adapter;
    #config;
    #logger;

    constructor(adapter, config, logger) {
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }
    // ... rest of methods unchanged, but replace all `logger.` with `this.#logger.`
```

Replace all uses of `logger.warn(...)` and `logger.debug(...)` in the file body with `this.#logger.warn(...)` and `this.#logger.debug(...)`.

Remove the `import { logger } from './logger.js';` line.

- [x] **Step 4: Update `src/core/app.js` — pass logger to CacheManager**

```js
const cache = new CacheManager(adapter, configManager, logger);
```

- [x] **Step 5: Run cache tests to verify they pass**

```bash
npx vitest run tests/unit/core/cache.test.js
```

Expected: all tests PASS.

- [x] **Step 6: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 7: Commit**

```bash
git add src/core/cache.js src/core/app.js tests/unit/core/cache.test.js
git commit -m "refactor(cache): inject logger via constructor"
```

---

## Task 5: Refactor `SurfaceManager`

**Files:**

- Modify: `src/core/surfaces.js`
- Modify: `src/core/app.js`
- Modify: `tests/unit/core/surfaces.test.js`

- [x] **Step 1: Write the failing test**

In `tests/unit/core/surfaces.test.js`, update the fallback test to use an injected mock logger. Change the import and the affected test:

```js
import { describe, it, expect, vi } from 'vitest';
import { SurfaceManager } from '../../../src/core/surfaces.js';
import { createMockLogger } from '../../mocks/logger.js';

// All tests that construct SurfaceManager with no args get a mock logger:
// new SurfaceManager() → new SurfaceManager(createMockLogger())

// The fallback test becomes:
it('should fall back to parent element if container selector not found', () => {
    const mockLogger = createMockLogger();
    const surfaces = new SurfaceManager(mockLogger);
    document.body.innerHTML = `
        <div class="not-a-container">
            <div class="bob-title">Orphan Title</div>
        </div>
    `;
    const results = surfaces.discover(document.body);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Orphan Title');
    expect(results[0].container.className).toBe('not-a-container');
    expect(mockLogger.debug).toHaveBeenCalledWith('Surface container selector failed, falling back to parentElement', {
        selector: '.bob-container',
    });
});
```

Remove `import { logger } from '../../../src/core/logger.js'` from the test file.

- [x] **Step 2: Run to verify the fallback test fails**

```bash
npx vitest run tests/unit/core/surfaces.test.js
```

Expected: fallback test FAILS — `mockLogger.debug` not called.

- [x] **Step 3: Update `src/core/surfaces.js`**

Add `#logger` field and update constructor:

```js
export class SurfaceManager {
    #SURFACES = [ /* unchanged */ ];
    #logger;

    constructor(logger) {
        this.#logger = logger;
    }
    // ... rest unchanged, but replace `logger.debug(...)` with `this.#logger.debug(...)`
```

Remove `import { logger } from './logger.js';`.

- [x] **Step 4: Update `src/core/app.js` — pass logger to SurfaceManager**

```js
const surfaces = new SurfaceManager(logger);
```

- [x] **Step 5: Update `app.test.js` line 72 — `SurfaceManager` constructed directly in a test**

```js
import { createMockLogger } from '../../mocks/logger.js';
// ...
const surfaces = new SurfaceManager(createMockLogger());
```

- [x] **Step 6: Run surfaces tests**

```bash
npx vitest run tests/unit/core/surfaces.test.js
```

Expected: all tests PASS.

- [x] **Step 7: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 8: Commit**

```bash
git add src/core/surfaces.js src/core/app.js tests/unit/core/surfaces.test.js tests/unit/core/app.test.js
git commit -m "refactor(surfaces): inject logger via constructor"
```

---

## Task 6: Refactor API clients

**Files:**

- Modify: `src/core/api-clients.js`
- Modify: `tests/unit/core/api-clients.test.js`

(startApp doesn't call client constructors directly yet — that happens in Task 7.)

- [x] **Step 1: Write the failing test**

In `tests/unit/core/api-clients.test.js`, add `createMockLogger` import and update constructor calls to pass a logger as the final argument:

```js
import { describe, it, expect, vi } from 'vitest';
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from '../../../src/core/api-clients.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';
```

For every `new XmdbApiClient(mockDisabledManager, mockAdapter, config)` call, add logger as the 4th arg:
`new XmdbApiClient(mockDisabledManager, mockAdapter, config, createMockLogger())`

- [x] **Step 2: Run to verify tests still pass (logger is optional until implementation)**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

Expected: tests PASS (extra arg is currently ignored — confirm this). If they fail for another reason, investigate before proceeding.

- [x] **Step 3: Update `src/core/api-clients.js` — add logger to BaseApiClient**

Add `#logger` to `BaseApiClient`. Update its constructor:

```js
export class BaseApiClient {
    #queue;
    #source;
    #disabledManager;
    #adapter;
    #config;
    #logger;

    constructor(queue, source, disabledManager, adapter, config, logger) {
        this.#queue = queue;
        this.#source = source;
        this.#disabledManager = disabledManager;
        this.#adapter = adapter;
        this.#config = config;
        this.#logger = logger;
    }

    get logger() {
        return this.#logger;
    }
    // ... rest of existing getters and methods unchanged
```

Replace every `logger.debug(...)`, `logger.warn(...)` in the class body with `this.#logger.debug(...)`, `this.#logger.warn(...)`.

Update each concrete client constructor to accept and forward `logger`:

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
    // ... search/getDetails: replace logger.debug/logger.warn with this.logger.debug/this.logger.warn
}

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
    // ... getDetails: replace logger.debug with this.logger.debug
}

export class ImdbApiDevClient extends BaseApiClient {
    constructor(disabledManager, adapter, config, logger) {
        super(
            new RequestQueue(RATE_LIMITS[ApiSource.IMDBAPI], null, adapter),
            ApiSource.IMDBAPI,
            disabledManager,
            adapter,
            config,
            logger
        );
    }
    // ... search/getDetails: replace logger.debug with this.logger.debug
}
```

Remove `import { logger } from './logger.js';` from the file.

- [x] **Step 4: Run api-clients tests**

```bash
npx vitest run tests/unit/core/api-clients.test.js
```

Expected: all tests PASS.

- [x] **Step 5: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 6: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "refactor(api-clients): inject logger via constructor"
```

---

## Task 7: Refactor `ApiClientManager` + extract `createApiClient`

**Files:**

- Modify: `src/core/api-manager.js`
- Modify: `src/core/app.js`
- Modify: `tests/unit/core/api-manager.test.js`

- [x] **Step 1: Write the failing tests**

Replace `tests/unit/core/api-manager.test.js` with the updated version. Key changes:

- Remove `import { logger }`
- New constructor signature: `new ApiClientManager(cache, disabledManager, client, logger)` — 4 params
- Use `mockLogger.debug` spy instead of `vi.spyOn(logger, 'debug')`
- Remove the "should only initialize the single selected client" test (factory moves to app.js)

```js
import { describe, it, expect, vi } from 'vitest';
import { ApiClientManager } from '../../../src/core/api-manager.js';
import { Title } from '../../../src/core/title.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('ApiClientManager', () => {
    it('should return cached data if available', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue({ apiTitle: 'Cached Movie' }), write: vi.fn() };
        const manager = new ApiClientManager(mockCache, {}, {}, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Cached Movie');
        expect(mockCache.read).toHaveBeenCalled();
    });

    it('should fetch and return result from client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const mockClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(new Title({ apiTitle: 'Fetched Movie' })),
        };
        const manager = new ApiClientManager(mockCache, {}, mockClient, createMockLogger());
        const result = await manager.getData('Some Title');
        expect(result.apiTitle).toBe('Fetched Movie');
    });

    it('should handle fail if client returns null', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
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

    it('should cache "Not Found" result if client fails', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const client = {
            getStatus: vi.fn().mockResolvedValue({ healthy: true }),
            fetch: vi.fn().mockResolvedValue(null),
        };
        const manager = new ApiClientManager(mockCache, {}, client, createMockLogger());
        const result = await manager.getData('Unknown Movie');
        expect(result.hasRating).toBe(false);
        expect(mockCache.write).toHaveBeenCalledWith(
            'Unknown Movie',
            expect.objectContaining({ apiTitle: null, rating: null })
        );
    });

    it('should skip unhealthy client', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const unhealthyClient = {
            getStatus: vi.fn().mockResolvedValue({ healthy: false }),
            fetch: vi.fn(),
        };
        const manager = new ApiClientManager(mockCache, {}, unhealthyClient, createMockLogger());
        const result = await manager.getData('Test Movie');
        expect(result.hasRating).toBe(false);
        expect(unhealthyClient.fetch).not.toHaveBeenCalled();
    });

    it('should reset all disabled clients and return the list of re-enabled ones', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue(['xmdb', 'omdb']) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, createMockLogger());
        const reenabled = await manager.resetDisabledClients();
        expect(mockDisabledManager.resetAll).toHaveBeenCalled();
        expect(reenabled).toEqual(['xmdb', 'omdb']);
    });

    it('should handle resetDisabledClients when no clients are re-enabled', async () => {
        const mockDisabledManager = { resetAll: vi.fn().mockResolvedValue([]) };
        const manager = new ApiClientManager({}, mockDisabledManager, {}, createMockLogger());
        const reenabled = await manager.resetDisabledClients();
        expect(reenabled).toEqual([]);
    });

    it('should log on successful data retrieval', async () => {
        const mockCache = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
        const title = new Title({ apiTitle: 'Logged Movie' });
        title.source = 'test-source';
        const mockClient = {
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
});
```

- [x] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/unit/core/api-manager.test.js
```

Expected: FAIL — constructor signature mismatch.

- [x] **Step 3: Update `src/core/api-manager.js`**

Remove the `static #createClientFromConfig`, `adapter`, `config` fields; simplify to `(cache, disabledManager, client, logger)`:

```js
import { Title } from './title.js';

export class ApiClientManager {
    #cache;
    #client;
    #disabledManager;
    #logger;

    constructor(cache, disabledManager, client, logger) {
        this.#cache = cache;
        this.#disabledManager = disabledManager;
        this.#client = client;
        this.#logger = logger;
    }

    getClient() {
        return this.#client;
    }

    async resetDisabledClients() {
        const reenabled = await this.#disabledManager.resetAll();
        if (reenabled.length > 0) {
            this.#logger.info(`Re-enabled API clients: ${reenabled.join(', ')}`);
        } else {
            this.#logger.info('No disabled API clients found to re-enable.');
        }
        return reenabled;
    }

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
}
```

- [x] **Step 4: Add `createApiClient` function and update `startApp` in `src/core/app.js`**

Add the following imports at the top of `app.js` (alongside existing ones):

```js
import { XmdbApiClient, OmdbApiClient, ImdbApiDevClient } from './api-clients.js';
import { ApiSource } from './constants.js';
```

Add this private function before `startApp`:

```js
function createApiClient(config, disabledManager, adapter, logger) {
    const provider = (config.get('apiClient') ?? 'imdbapi').trim().toLowerCase();
    const clientMap = {
        [ApiSource.XMDB]: XmdbApiClient,
        [ApiSource.OMDB]: OmdbApiClient,
        [ApiSource.IMDBAPI]: ImdbApiDevClient,
    };
    const ClientClass = clientMap[provider] ?? ImdbApiDevClient;
    return new ClientClass(disabledManager, adapter, config, logger);
}
```

Update `startApp` to use the new constructor:

```js
const client = createApiClient(configManager, disabledManager, adapter, logger);
const api = new ApiClientManager(cache, disabledManager, client, logger);
```

Remove the old `const api = new ApiClientManager(cache, disabledManager, adapter, configManager);` line.

- [x] **Step 5: Run api-manager tests**

```bash
npx vitest run tests/unit/core/api-manager.test.js
```

Expected: all tests PASS.

- [x] **Step 6: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 7: Commit**

```bash
git add src/core/api-manager.js src/core/app.js tests/unit/core/api-manager.test.js
git commit -m "refactor(api-manager): inject logger and client via constructor, extract createApiClient"
```

---

## Task 8: Refactor `FlixMonkeyApp`

**Files:**

- Modify: `src/core/app.js` (`FlixMonkeyApp` class only)
- Modify: `tests/unit/core/app.test.js`

- [x] **Step 1: Write the failing test**

In `tests/unit/core/app.test.js`, update the direct `FlixMonkeyApp` constructor call to pass logger:

```js
// Add import at the top:
import { createMockLogger } from '../../mocks/logger.js';

// Line ~282 — update:
const app = new FlixMonkeyApp({}, {}, mockRenderer, mockSurfaces, createMockLogger());
```

- [x] **Step 2: Run to verify the test fails**

```bash
npx vitest run tests/unit/core/app.test.js -t "should throw if init"
```

Expected: FAIL — constructor still has 4 params.

- [x] **Step 3: Update `FlixMonkeyApp` constructor in `src/core/app.js`**

Add `#logger` private field and update constructor:

```js
export class FlixMonkeyApp {
    #api;
    #cache;
    #renderer;
    #surfaces;
    #logger;
    #inFlight = new Map();
    #pendingRoots = new Set();
    #debouncedDecorate;
    #observer = null;
    #initialised = false;
    #boundDisconnect = null;
    #navigationPatched = false;
    #originalPushState = null;
    #originalReplaceState = null;
    #popstateHandler = null;

    constructor(cache, api, renderer, surfaces, logger) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
        this.#logger = logger;
        this.#debouncedDecorate = debounce(() => {
            const roots = this.#pendingRoots.size > 0 ? [...this.#pendingRoots] : [document];
            this.#pendingRoots.clear();
            runIdle(() => roots.forEach(root => this.decorateRoot(root)));
        }, DECORATION_DEBOUNCE_MS);
    }
```

Replace all `logger.error(...)` and `logger.debug(...)` calls inside `FlixMonkeyApp` methods with `this.#logger.error(...)` and `this.#logger.debug(...)`.

- [x] **Step 4: Update `startApp` to pass logger to `FlixMonkeyApp`**

```js
const app = new FlixMonkeyApp(cache, api, renderer, surfaces, logger);
```

- [x] **Step 5: Run app tests**

```bash
npx vitest run tests/unit/core/app.test.js
```

Expected: all tests PASS.

- [x] **Step 6: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 7: Commit**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "refactor(app): inject logger into FlixMonkeyApp via constructor"
```

---

## Task 9: Wire `startApp` with real logger, remove singleton and `_appStarted`

This task removes all remaining module-level mutable state. After this task, no file in `src/` imports the logger singleton.

**Files:**

- Modify: `src/core/logger.js` — remove singleton export
- Modify: `src/core/app.js` — create `new Logger(adapter)`, remove `import { logger }`, remove `_appStarted` / `_resetStartedForTest`
- Modify: `tests/unit/core/app.test.js` — remove `_resetStartedForTest`; update logger spy to `Logger.prototype`

- [x] **Step 1: Write the failing tests**

In `tests/unit/core/app.test.js`:

1. Add `import { Logger } from '../../../src/core/logger.js';`
2. Remove `import { logger } from '../../../src/core/logger.js'`
3. Remove `import { _resetStartedForTest }` from the `app.js` import line
4. Remove `_resetStartedForTest()` from `afterEach`
5. Replace `vi.spyOn(logger, 'error')` with `vi.spyOn(Logger.prototype, 'error')` (3 occurrences)
6. Remove the test `"should throw if startApp is called twice"` entirely

```js
// Updated import line:
import { startApp, FlixMonkeyApp } from '../../../src/core/app.js';

// Updated afterEach (remove _resetStartedForTest call):
afterEach(() => {
    appRef?.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    global.MutationObserver = ActualMutationObserver;
});

// Example updated spy (apply to all 3 occurrences):
const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
```

- [x] **Step 2: Run to verify failing tests**

```bash
npx vitest run tests/unit/core/app.test.js
```

Expected: several FAIL — `_resetStartedForTest` not found, `logger` singleton import fails.

- [x] **Step 3: Update `src/core/logger.js` — remove singleton**

Replace the entire file (singleton export line removed):

```js
export class Logger {
    #prefix = '[FlixMonkey]';
    #adapter;

    constructor(adapter) {
        this.#adapter = adapter;
    }

    debug(message, ...args) {
        if (this.#adapter.configGet('debug') === true) {
            console.debug(`${this.#prefix} ${message}`, ...args);
        }
    }

    info(message, ...args) {
        console.info(`${this.#prefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`${this.#prefix} ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`${this.#prefix} ${message}`, ...args);
    }
}
```

- [x] **Step 4: Update `src/core/app.js` — wire logger from adapter, remove singleton import and module state**

Replace `import { logger } from './logger.js'` with `import { Logger } from './logger.js'`.

Remove these two exports from app.js:

```js
let _appStarted = false;
// and
export function _resetStartedForTest() {
    _appStarted = false;
}
```

Update `startApp`:

```js
export function startApp(adapter) {
    const logger = new Logger(adapter);
    const configManager = new ConfigManager(adapter, logger);
    const cache = new CacheManager(adapter, configManager, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const client = createApiClient(configManager, disabledManager, adapter, logger);
    const api = new ApiClientManager(cache, disabledManager, client, logger);
    const renderer = new OverlayRenderer(configManager);
    const surfaces = new SurfaceManager(logger);
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces, logger);
    app.init();
    return {
        clearCache: () => app.clearCache(),
        resetDisabledClients: () => app.resetDisabledClients(),
        disconnect: () => app.disconnect(),
        refreshStyles: () => renderer.injectStyles(),
        cacheManager: cache,
        disabledManager: disabledManager,
    };
}
```

(Remove the old `if (_appStarted) throw ...` guard and the `_appStarted = true` line.)

- [x] **Step 5: Run app tests**

```bash
npx vitest run tests/unit/core/app.test.js
```

Expected: all tests PASS.

- [x] **Step 6: Run full suite**

```bash
npm test
```

Expected: all tests pass. Confirm no file in `src/` imports `logger` singleton:

```bash
grep -r "from './logger.js'" src/ && grep -r "from '../core/logger.js'" src/
```

Expected: only `import { Logger }` lines appear — no `import { logger }` (lowercase).

- [x] **Step 7: Commit**

```bash
git add src/core/logger.js src/core/app.js tests/unit/core/app.test.js
git commit -m "refactor(app): wire Logger from adapter in startApp, remove singleton and _appStarted"
```

---

## Self-Check

- [x] Run `npm test` one final time; confirm all tests pass with no skips.
- [x] Confirm no `setConfig` references remain: `grep -r "setConfig" src/`
- [x] Confirm no `_appStarted` or `_resetStartedForTest` references remain: `grep -r "_appStarted\|_resetStartedForTest" src/ tests/`
- [x] Confirm no lowercase `logger` singleton imports remain in `src/`: `grep -rn "import { logger" src/`
