# Logger DI Refactor — Design Spec

**Date:** 2026-06-06
**Scope:** Eliminate module-level mutable state and two-phase initialisation; make `Logger` a fully-injected dependency consistent with all other deps in the object graph.

---

## Problem

Three code smells exist in the current wiring:

1. **`logger` two-phase init** — `logger.js` exports a module-level singleton initialised with a stub config (`{ get: () => false }`), then `startApp` calls `logger.setConfig(configManager)` after construction. The logger is live before it is properly configured.
2. **Module-level singleton guards** — `app.js` has a `_appStarted` boolean and an exported `_resetStartedForTest()` escape hatch. This is test-only state leaking into production code.
3. **`ApiClientManager` optional `client` param** — `constructor(..., client = null)` with internal factory logic is a hidden DI override for tests. Inconsistent with how all other dependencies are handled.

---

## Design

### Logger

`Logger` is refactored to take `adapter` in its constructor instead of a config object. It calls `adapter.configGet('debug')` live on every `debug()` call — preserving runtime toggling with no baked boolean.

```js
export class Logger {
    #adapter;
    constructor(adapter) {
        this.#adapter = adapter;
    }
    debug(message, ...args) {
        if (this.#adapter.configGet('debug') === true) console.debug(`[FlixMonkey] ${message}`, ...args);
    }
    // info / warn / error unchanged (no config dependency)
}
```

The module-level singleton (`export const logger = new Logger(...)`) is removed. Only the class is exported. `setConfig()` is removed entirely.

### ConfigManager

Gains a `logger` constructor param. The existing `logger.warn` call in the error catch is unchanged — now uses the injected instance.

```js
constructor(adapter, logger) { ... }
```

This resolves the circular dependency: `Logger` roots from `adapter`, `ConfigManager` roots from `adapter` + `logger`. No cycle.

### Module-level state removal

`_appStarted` and `_resetStartedForTest()` are deleted from `app.js`. No module-level mutable state remains.

`FlixMonkeyApp.#initialised` is retained — it correctly guards against calling `init()` twice on the same instance.

Tests that called `_resetStartedForTest()` no longer need it. They construct individual classes directly, not via `startApp`.

### Injection points

All six classes that currently import `logger` as a module singleton drop that import and receive it via constructor:

| Class                                                | New constructor signature (changed params only) |
| ---------------------------------------------------- | ----------------------------------------------- |
| `ConfigManager`                                      | `(adapter, logger)`                             |
| `CacheManager`                                       | `(adapter, configManager, logger)`              |
| `SurfaceManager`                                     | `(logger)`                                      |
| `ApiClientManager`                                   | `(cache, disabledManager, client, logger)`      |
| `FlixMonkeyApp`                                      | `(cache, api, renderer, surfaces, logger)`      |
| `XmdbApiClient`, `OmdbApiClient`, `ImdbApiDevClient` | existing params + `logger`                      |

`DisabledClientsManager` does not use logger — no change.

### ApiClientManager client wiring

The optional `client = null` param and `static #createClientFromConfig` are removed from `ApiClientManager`. Client creation moves to a private `createApiClient` function in `app.js`:

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

`ApiClientManager` takes a required `client` — no optional param, no factory logic inside the class. Tests pass a mock client directly as the `client` argument.

### startApp wiring order

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
    return { ... };
}
```

Strictly top-down. No late mutations, no module-level state, every object fully wired at construction.

---

## Out of scope

- `OverlayRenderer` — does not currently use logger; no change.
- `DisabledClientsManager` — does not currently use logger; no change.
- Any changes to the `PlatformAdapter` interface.
- Changes to extension entry points (`content.js`, `options.js`) beyond what the `startApp` signature change requires.

---

## Testing impact

- Tests constructing `ApiClientManager` with a mock via the optional fifth param switch to passing the mock as the required `client` arg (third positional after `cache` and `disabledManager`).
- Tests that called `_resetStartedForTest()` remove that call.
- Tests constructing any of the six affected classes add a mock logger (a simple `{ debug: ()=>{}, info: ()=>{}, warn: ()=>{}, error: ()=>{} }` stub is sufficient).
