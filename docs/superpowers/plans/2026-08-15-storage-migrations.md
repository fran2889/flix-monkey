# Storage Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global, ordered storage-migration system that upgrades persistent data before FlixMonkey reads it in extension and userscript targets.

**Architecture:** `src/core/migrations.js` owns the data-version key, migration registry validation, ordered execution, recovery semantics, and logging. Extension background contexts serialize execution and expose an internal message gate. Content and options wait at that gate, while the userscript invokes the same runner directly during asynchronous bootstrap.

**Tech Stack:** ES2022 modules, WebExtension MV3 APIs, userscript `GM_*` storage through `PlatformAdapter`, Vitest, jsdom, and Rollup.

## Global Constraints

- Node.js is `>= 24`; use ES modules and async/await.
- All new `src/` and `tests/` JavaScript files begin with the project GPL-3.0 license header.
- `fm_data_version` is the one global data version key. Absent, malformed, and negative values are version `0`.
- Migrations have unique, strictly ascending positive integer versions and expose `upgrade(adapter)`, not `up(adapter)`.
- A failed upgrade invokes optional `onFailure(adapter, error)`, records that version even if recovery fails, logs the outcome, and lets startup continue.
- An unexpected runner failure, such as a storage API failure while reading or recording the version, is not recoverable: the extension background reports it and content or options abort bootstrap for that load.
- Migrations may change cache, configuration, or any stored data. Do not add old-schema branches to cache or configuration consumers.
- Use ASCII-only prose and the Oxford comma. Finish with `npm run lint && npm run format:check && npm test && npm run build`.

---

## File Structure

- Create `src/core/migrations.js`: migration contracts, current version parsing, registry validation, and runner.
- Create `tests/unit/core/migrations.test.js`: runner behavior against the existing mock adapter.
- Create `src/targets/extension/migrations.js`: one background-local promise that executes core migrations.
- Modify background entry points, extension content/options bootstraps, and the userscript entry.
- Extend the matching target unit tests, plus add `tests/unit/targets/extension-migrations.test.js`.

### Task 1: Core migration runner

**Files:**

- Create: `src/core/migrations.js`
- Create: `tests/unit/core/migrations.test.js`

**Interfaces:**

- Consumes: `PlatformAdapter.storageGet(key)`, `storageSet(key, value)`, and `Logger.info/error`.
- Produces: `DATA_VERSION_KEY`, `MIGRATIONS`, and `runMigrations(adapter, logger, migrations = MIGRATIONS)`.
- `runMigrations()` returns `Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create the test file with the GPL header. Import `createMockAdapter`, `DATA_VERSION_KEY`, and `runMigrations`; use `{ info: vi.fn(), error: vi.fn() }` as logger.

Add these cases:

```js
it.each([null, 'bad', '-1', -1])('treats %j as version zero', async stored => {
    const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(stored) });
    const upgrade = vi.fn().mockResolvedValue({ transformed: 2, removed: 1 });

    await runMigrations(adapter, logger, [{ version: 1, upgrade }]);

    expect(upgrade).toHaveBeenCalledWith(adapter);
    expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 completed'), {
        transformed: 2,
        removed: 1,
    });
});

it('runs only newer migrations in ascending order', async () => {
    const calls = [];
    const migrations = [
        { version: 1, upgrade: vi.fn() },
        { version: 2, upgrade: vi.fn(async () => calls.push(2)) },
        { version: 3, upgrade: vi.fn(async () => calls.push(3)) },
    ];
    const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('1') });

    await runMigrations(adapter, logger, migrations);

    expect(calls).toEqual([2, 3]);
    expect(migrations[0].upgrade).not.toHaveBeenCalled();
    expect(adapter.storageSet).toHaveBeenNthCalledWith(1, DATA_VERSION_KEY, '2');
    expect(adapter.storageSet).toHaveBeenNthCalledWith(2, DATA_VERSION_KEY, '3');
});

it('runs recovery, logs it, and advances after upgrade failure', async () => {
    const error = new Error('bad cache entry');
    const onFailure = vi.fn().mockResolvedValue({ removed: 4 });
    const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('0') });

    await runMigrations(adapter, logger, [{ version: 1, upgrade: vi.fn().mockRejectedValue(error), onFailure }]);

    expect(onFailure).toHaveBeenCalledWith(adapter, error);
    expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Migration 1 failed'), error);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 recovery completed'), { removed: 4 });
});
```

Also test: current version produces no writes, missing `onFailure` still advances, failing recovery is logged and a later migration still runs, and duplicate, unordered, zero, non-integer, missing-`upgrade`, and non-function-`onFailure` registries reject.

- [ ] **Step 2: Run the test to prove it fails**

Run: `npx vitest run tests/unit/core/migrations.test.js`

Expected: FAIL because the migration module does not exist.

- [ ] **Step 3: Implement the public runner**

Create `src/core/migrations.js` with typedefs for `MigrationSummary` and `StorageMigration`. Start the registry empty:

```js
export const DATA_VERSION_KEY = 'fm_data_version';
export const MIGRATIONS = Object.freeze([]);

export async function runMigrations(adapter, logger, migrations = MIGRATIONS) {
    validateMigrations(migrations);
    const currentVersion = parseStoredVersion(await adapter.storageGet(DATA_VERSION_KEY));
    for (const migration of migrations) {
        if (migration.version <= currentVersion) continue;
        try {
            const summary = await migration.upgrade(adapter);
            logger.info(`Migration ${migration.version} completed`, summary);
        } catch (error) {
            logger.error(`Migration ${migration.version} failed`, error);
            if (migration.onFailure) {
                try {
                    const summary = await migration.onFailure(adapter, error);
                    logger.info(`Migration ${migration.version} recovery completed`, summary);
                } catch (recoveryError) {
                    logger.error(`Migration ${migration.version} recovery failed`, recoveryError);
                }
            }
        }
        await adapter.storageSet(DATA_VERSION_KEY, String(migration.version));
    }
}
```

Implement `parseStoredVersion` so only safe integer numbers greater than or equal to zero survive. Implement `validateMigrations` so versions are positive safe integers in strictly increasing order, `upgrade` is a function, and an included `onFailure` is a function. Document that runner failure handling deliberately advances data version to avoid startup loops. Do not create a speculative real migration.

- [ ] **Step 4: Verify focused behavior**

Run: `npx vitest run tests/unit/core/migrations.test.js && npm run lint`

Expected: PASS and exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add src/core/migrations.js tests/unit/core/migrations.test.js
git commit -m "feat(storage): add migration runner"
```

### Task 2: Serialize extension migrations in the background

**Files:**

- Create: `src/targets/extension/migrations.js`
- Create: `tests/unit/targets/extension-migrations.test.js`
- Modify: `src/targets/chrome/service-worker.js`
- Modify: `src/targets/firefox/background.js`
- Modify: `tests/unit/targets/chrome/service-worker.test.js`
- Modify: `tests/unit/targets/firefox/background.test.js`

**Interfaces:**

- Consumes: `runMigrations`, `Logger`, `WebExtensionAdapter`, and runtime messages.
- Produces: `createExtensionMigrationExecutor(): () => Promise<void>`.
- Both background scripts accept authenticated `{ type: 'FM_RUN_MIGRATIONS' }` requests.

- [ ] **Step 1: Write failing executor and background tests**

Mock the new shared module in both background tests so `createExtensionMigrationExecutor` returns `executeMigrations`. Extend the runtime stub to capture `runtime.onInstalled.addListener`.

Test that both `{ reason: 'install' }` and `{ reason: 'update' }` invoke the executor, authenticated `FM_RUN_MIGRATIONS` invokes it, and foreign senders do not. Preserve all existing fetch relay tests.

In the new executor test, mock `runMigrations`, `Logger`, and `WebExtensionAdapter`. Make `runMigrations` deferred, call `executeMigrations()` twice before resolving, and assert both callers receive the same completion while `runMigrations` is called once.

- [ ] **Step 2: Run tests to prove they fail**

Run: `npx vitest run tests/unit/targets/chrome/service-worker.test.js tests/unit/targets/firefox/background.test.js tests/unit/targets/extension-migrations.test.js`

Expected: FAIL because no shared executor or installed listeners exist.

- [ ] **Step 3: Implement executor and hooks**

Create the shared module:

```js
import { Logger } from '../../core/logger.js';
import { runMigrations } from '../../core/migrations.js';
import { WebExtensionAdapter } from '../../platform/webextension.js';

export function createExtensionMigrationExecutor() {
    let migrationPromise = null;
    return () => {
        if (!migrationPromise) {
            const adapter = new WebExtensionAdapter();
            migrationPromise = runMigrations(adapter, new Logger(adapter));
        }
        return migrationPromise;
    };
}
```

Each background entry creates one executor. Add `runtime.onInstalled` that calls it and logs unexpected rejection with `console.error`. In Chrome, handle the migration message after the same-extension sender check, call `executeMigrations().then(() => sendResponse({}), error => sendResponse({ error: error.message }))`, and return `true`. In Firefox's async listener, await execution and return `{}`; let an unexpected rejection reject the message. Preserve current `FM_FETCH` behavior and the sender check.

- [ ] **Step 4: Verify focused behavior**

Run: `npx vitest run tests/unit/targets/chrome/service-worker.test.js tests/unit/targets/firefox/background.test.js tests/unit/targets/extension-migrations.test.js`

Expected: PASS, including every pre-existing fetch test.

- [ ] **Step 5: Commit**

```bash
git add src/targets/extension/migrations.js src/targets/chrome/service-worker.js src/targets/firefox/background.js \
  tests/unit/targets/extension-migrations.test.js tests/unit/targets/chrome/service-worker.test.js \
  tests/unit/targets/firefox/background.test.js
git commit -m "feat(storage): run migrations on extension updates"
```

### Task 3: Gate extension content and options startup

**Files:**

- Modify: `src/targets/extension/content.js`
- Modify: `src/targets/extension/options.js`
- Modify: `tests/unit/targets/content.test.js`
- Modify: `tests/unit/targets/options.test.js`

**Interfaces:**

- Consumes: `browser.runtime.sendMessage({ type: 'FM_RUN_MIGRATIONS' })`.
- Produces: no extension storage read, configuration snapshot, app creation, or options UI rendering before that promise resolves.

- [ ] **Step 1: Write failing ordering tests**

In each webextension-polyfill mock, make `sendMessage` return a deferred promise. Import the entry, assert initial storage access and UI/app creation have not happened, resolve the deferred promise, then await its asynchronous bootstrap.

For content, assert:

```js
expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'FM_RUN_MIGRATIONS' });
expect(browser.storage.local.get).toHaveBeenCalledAfter(browser.runtime.sendMessage);
expect(startAppSpy).toHaveBeenCalledAfter(browser.storage.local.get);
```

For options, assert `SettingsUI.render(document.body)` waits for migration completion and retain the existing tab reload test.

- [ ] **Step 2: Run tests to prove they fail**

Run: `npx vitest run tests/unit/targets/content.test.js tests/unit/targets/options.test.js`

Expected: FAIL because content reads first and options constructs immediately.

- [ ] **Step 3: Add startup gates**

At the start of the existing content async IIFE, reject an error response before any storage read:

```js
const migrationResponse = await browser.runtime.sendMessage({ type: 'FM_RUN_MIGRATIONS' });
if (migrationResponse?.error) throw new Error(migrationResponse.error);
const stored = await browser.storage.local.get(null);
```

Keep the remaining snapshot/listener/app sequence unchanged.

Refactor options into an async IIFE. Construct the adapter, await the same message, and throw if the response contains `error`; then construct `Logger`, `ConfigManager`, `CacheManager`, `DisabledClientsManager`, and `SettingsUI`. Keep the exact save/reload URL patterns and call `ui.render(document.body)` last.

- [ ] **Step 4: Verify focused behavior**

Run: `npx vitest run tests/unit/targets/content.test.js tests/unit/targets/options.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/targets/extension/content.js src/targets/extension/options.js \
  tests/unit/targets/content.test.js tests/unit/targets/options.test.js
git commit -m "feat(storage): gate extension startup on migrations"
```

### Task 4: Gate userscript startup

**Files:**

- Modify: `src/targets/userscript/entry.js`
- Modify: `tests/unit/targets/userscript/entry.test.js`

**Interfaces:**

- Consumes: `runMigrations(adapter, logger)`.
- Produces: application startup and menu registration only after migrations resolve.

- [ ] **Step 1: Write the failing bootstrap test**

Mock `src/core/migrations.js` to return a deferred promise. Import `entry.js` without resolving it and assert neither `startApp` nor `registerMenuCommand` has run. Resolve, await bootstrap, then assert the runner received the adapter and logger, followed by `startApp`, then menu registration. Update existing menu tests to await bootstrap before retrieving the callback.

- [ ] **Step 2: Run test to prove it fails**

Run: `npx vitest run tests/unit/targets/userscript/entry.test.js`

Expected: FAIL because startup is currently synchronous and does not invoke migrations.

- [ ] **Step 3: Implement asynchronous bootstrap**

Import `runMigrations`. Keep one adapter and one bootstrap logger, make `app` mutable, and use:

```js
const adapter = new UserscriptAdapter();
const logger = new Logger(adapter);
let app = null;

void (async () => {
    await runMigrations(adapter, logger);
    app = startApp(adapter);
    adapter.registerMenuCommand('FlixMonkey Settings', openSettings);
})();
```

Extract the existing callback to `openSettings()`. In the fallback dependency path, reuse the bootstrap logger rather than constructing another one. Retain use of `app.cacheManager` and `app.disabledManager` when an app exists.

- [ ] **Step 4: Verify focused behavior**

Run: `npx vitest run tests/unit/targets/userscript/entry.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/targets/userscript/entry.js tests/unit/targets/userscript/entry.test.js
git commit -m "feat(storage): migrate userscript data before startup"
```

### Task 5: Final verification

**Files:**

- Verify: all Task 1-4 files.

- [ ] **Step 1: Run the complete quality suite**

Run: `npm run lint && npm run format:check && npm test && npm run build`

Expected: every command exits `0`; all three distributable targets build and extension ZIP packaging completes.

- [ ] **Step 2: Inspect final state**

Run: `git status --short && git log -4 --oneline`

Expected: a clean worktree and the four implementation commits described above.

- [ ] **Step 3: Commit verification-only formatting if needed**

If formatter or lint tools changed files:

```bash
git add <explicit-file-paths>
git commit -m "style: format migration changes"
```

If the worktree is clean, do not create an empty commit.
