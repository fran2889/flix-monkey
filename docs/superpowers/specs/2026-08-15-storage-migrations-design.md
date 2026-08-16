# Storage Migrations Design

## Goal

Introduce a single, versioned migration system for all persisted FlixMonkey data. It must let future releases transform or remove obsolete cache and configuration data before consumers read it, so current runtime code only supports the current model.

## Versioning Model

- `fm_data_version` is the global, linear data-model version key.
- A missing, malformed, or negative value is treated as version `0`.
- Migration versions are positive, unique integers in strictly increasing order.
- The runner executes every migration whose version is greater than the stored version, in registry order.
- A migration may change any persisted data: cache, configuration, fade overrides, disabled-client state, or future storage namespaces.
- Cache and configuration consumers do not retain compatibility branches for superseded versions. The matching migration owns all interpretation of its old data shape.

## Migration Contract

Add a core migration module containing an ordered registry and a runner. Each registry entry has this shape:

```js
{
  version: 1,
  async upgrade(adapter) {
    // Transform, rename, or delete persistent entries.
    return { transformed: 0, removed: 0 };
  },
  async onFailure(adapter, error) {
    // Optional, migration-specific recovery.
    return { removed: 0 };
  }
}
```

`upgrade(adapter)` performs the normal migration. It decides whether every legacy value can be transformed, should be removed, or should be left unchanged. `onFailure(adapter, error)` is optional and owns the fallback policy when the normal migration fails. It may clear the cache, reset selected settings, or retain sensitive settings such as API keys.

The runner depends only on the `PlatformAdapter` storage interface and a logger. It has no cache-format or configuration-key knowledge.

## Completion, Logging, and Failure Semantics

After an `upgrade()` succeeds, the runner writes that migration's version to `fm_data_version` before proceeding to the next migration. It logs successful completion, including the version and any optional result summary returned by the migration.

If `upgrade()` throws, the runner logs the failure and calls `onFailure()` when supplied. It logs successful recovery and any returned summary. Whether recovery is absent, succeeds, or itself throws, the runner writes that migration's version, logs all relevant failures, and continues startup. This intentionally prevents a corrupt legacy entry or failed recovery from creating an infinite startup loop.

Migrations should be safe when repeated where practical, but extension execution must not rely on idempotence for ordinary concurrency control.

## Startup and Extension Coordination

The extension background context is the only executor of migrations for Firefox and Chrome. It exposes one shared migration promise for its lifetime.

- `runtime.onInstalled` triggers the executor for both new installs and updates.
- Content scripts and the options page send an internal `FM_RUN_MIGRATIONS` message before reading storage or constructing `CacheManager`, `ConfigManager`, settings UI, or the app.
- Concurrent update and message triggers await the same background promise.
- After the request completes, content reads `browser.storage.local` and seeds its current mutable configuration snapshot. Therefore the snapshot observes transformed storage.
- Existing background fetch message handling remains unchanged apart from accepting the additional internal message type.

Userscript managers do not provide an equivalent update lifecycle hook. The userscript creates its adapter, awaits the shared core runner directly, then starts the app and registers the settings menu. Its settings fallback path is therefore also only reachable after migrations complete.

`startApp()` remains synchronous. The asynchronous migration work belongs to target bootstrap code, not application construction.

## Testing

Add unit tests for the core runner without Netflix fixtures:

- missing, malformed, and negative versions begin at `0`;
- migrations run once, in ascending order, and completed migrations are skipped;
- each successful migration persists its own version and logs success;
- an `upgrade()` failure invokes `onFailure()` and still advances the version;
- a failing recovery is logged and still advances the version;
- duplicate, unordered, or invalid registry versions fail validation;
- returned migration summaries appear in log calls.

Extend target tests to verify:

- install and update events trigger background migration execution;
- background migration requests share a single in-flight execution;
- content and options await `FM_RUN_MIGRATIONS` before reading or using persistent data;
- the userscript awaits the runner before application startup.

No fixture-based UI tests are required because migration behavior does not depend on Netflix DOM.

## Non-Goals

- Automatic rollback or downgrades for users returning to an older extension release.
- Per-subsystem version keys.
- Read-repair compatibility paths in cache or configuration consumers.
- A generic transaction layer over browser or userscript storage.
