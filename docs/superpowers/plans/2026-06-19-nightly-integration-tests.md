# Nightly Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the live-API integration tests out of per-PR CI into a nightly workflow that fails loudly when API keys are missing, and reclassify the mock-only "integration" tests as the unit tests they actually are.

**Architecture:** `tests/integration/` is reduced to the single real-external-system test (`api-clients.test.js`), guarded by a setup file that throws when required API keys are absent. A dedicated `vitest.integration.config.js` is the only entry point that runs it. Per-PR CI drops the integration job; a new `nightly.yml` runs it on a schedule with keys from Actions secrets. Default/coverage test scripts are scoped explicitly to `tests/unit tests/ui`.

**Tech Stack:** Node 24, Vitest, dotenv, GitHub Actions.

## Global Constraints

- Node version floor: `>= 24`; CI uses `node-version: '24.x'`.
- All JS files under `src/` and `tests/` carry the GPL-3.0 license header block (enforced by `eslint-plugin-headers`). Config files (`*.config.js`) do **not** carry the header — match `vitest.config.js`.
- Required API keys for integration tests: `XMDB_API_KEY`, `OMDB_API_KEY` (imdbapi.dev is keyless).
- GitHub Actions used in workflows must be SHA-pinned with a trailing version comment, matching `ci.yml`:
    - `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6`
    - `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6`
- Run `npm run format` / `npm run lint` are pre-commit enforced via lint-staged + husky.

---

### Task 1: Reclassify ConfigManager integration tests into the unit suite

**Files:**

- Modify: `tests/unit/core/config-manager.test.js`
- Delete: `tests/integration/config-manager.test.js`

**Interfaces:**

- Consumes: existing `ConfigManager`, `CONFIG_DEFAULTS`, `createMockAdapter`, `createMockLogger` — already imported in the unit file.
- Produces: nothing consumed by later tasks.

The integration file's unique cases are: the `CONFIG_DEFAULTS` round-trip over every key, error-path with explicit fallback, null→defaults, non-string (already-numeric) values, and falsy-but-valid values (`0` / `''`). The plain null→default and logger.warn cases are already covered in the unit file and are dropped.

- [ ] **Step 1: Add the migrated cases to the unit file**

Append the following inside the existing `describe('ConfigManager', () => { ... })` block in `tests/unit/core/config-manager.test.js`, just before its closing `});` (line 77):

```js
it.each(Object.entries(CONFIG_DEFAULTS))('should return correct default for key "%s"', (key, expectedValue) => {
    const config = new ConfigManager(createMockAdapter(), createMockLogger());
    expect(config.get(key)).toBe(expectedValue);
});

it('should use explicit fallback when configGet throws', () => {
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

it('should fall back to CONFIG_DEFAULTS when configGet returns null', () => {
    const config = new ConfigManager(createMockAdapter({ configGet: () => null }), createMockLogger());
    expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
});

it('should handle non-string values from configGet', () => {
    const config = new ConfigManager(
        createMockAdapter({ configGet: key => (key === 'someInt' ? 42 : key === 'someFloat' ? 1.5 : undefined) }),
        createMockLogger()
    );
    expect(config.getInt('someInt')).toBe(42);
    expect(config.getFloat('someFloat')).toBe(1.5);
});

it('should handle falsy but valid values (0 and empty string)', () => {
    const config = new ConfigManager(
        createMockAdapter({ configGet: key => (key === 'zero' ? 0 : key === 'empty' ? '' : undefined) }),
        createMockLogger()
    );
    expect(config.get('zero')).toBe(0);
    expect(config.get('empty')).toBe('');
    expect(config.getInt('zero', 10)).toBe(0);
    expect(config.getFloat('zero', 10)).toBe(0);
});
```

- [ ] **Step 2: Delete the integration file**

```bash
git rm tests/integration/config-manager.test.js
```

- [ ] **Step 3: Run the unit suite to verify the migrated cases pass**

Run: `npx vitest run tests/unit/core/config-manager.test.js`
Expected: PASS — all cases green, including the new `it.each` over `CONFIG_DEFAULTS`.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/core/config-manager.test.js
git commit -m "test: move ConfigManager integration cases into unit suite"
```

---

### Task 2: Reclassify the RequestQueue integration test into the unit suite

**Files:**

- Modify: `tests/unit/core/request-queue.test.js`
- Delete: `tests/integration/request-queue.test.js`

**Interfaces:**

- Consumes: existing `RequestQueue`, `createMockAdapter` — already imported in the unit file. Uses a local `mockFetch` (no network).
- Produces: nothing consumed by later tasks.

The integration test used a `mockFetch` returning `{ status: 200 }` (no real network) and a dead `it.skip` branch. Migrate only the concurrency assertion.

- [ ] **Step 1: Add the migrated case to the unit file**

Append the following inside the existing `describe('RequestQueue', () => { ... })` block in `tests/unit/core/request-queue.test.js`, just before its closing `});` (line 107):

```js
it('should resolve multiple concurrently enqueued requests', async () => {
    const mockAdapter = createMockAdapter({ storageGet: async () => '0', storageSet: async () => {} });
    const queue = new RequestQueue(100, null, mockAdapter);
    const mockFetch = async () => ({ status: 200 });

    const results = await Promise.all([
        queue.enqueue('https://example.com/a', 0, mockFetch, 'json'),
        queue.enqueue('https://example.com/b', 0, mockFetch, 'json'),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe(200);
    expect(results[1].status).toBe(200);
});
```

- [ ] **Step 2: Delete the integration file**

```bash
git rm tests/integration/request-queue.test.js
```

- [ ] **Step 3: Run the unit suite to verify the migrated case passes**

Run: `npx vitest run tests/unit/core/request-queue.test.js`
Expected: PASS — all cases green, including `should resolve multiple concurrently enqueued requests`.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/core/request-queue.test.js
git commit -m "test: move RequestQueue concurrency case into unit suite"
```

---

### Task 3: Add fail-fast credential guard, integration config, and de-skip the API tests

**Files:**

- Modify: `tests/integration/setup.js` (rewrite)
- Create: `vitest.integration.config.js`
- Modify: `tests/integration/api-clients.test.js` (remove `hasCredentials` import + all `it.skipIf` guards)

**Interfaces:**

- Consumes: `process.env.XMDB_API_KEY`, `process.env.OMDB_API_KEY`.
- Produces: `vitest.integration.config.js` — used by Task 4's `test:integration` script and Task 6's nightly workflow.

- [ ] **Step 1: Rewrite `tests/integration/setup.js` as a fail-fast credential guard**

Replace the file body below the license header (keep the existing GPL header block, lines 1–17) with:

```js
import { config } from 'dotenv';

// Load a local .env for developer convenience. dotenv does NOT override
// variables already present in the environment, so in CI the keys supplied
// via the workflow `env:` block take precedence and .env is irrelevant
// (it is never present in CI).
config();

const REQUIRED_KEYS = ['XMDB_API_KEY', 'OMDB_API_KEY'];

const missing = REQUIRED_KEYS.filter(key => !process.env[key]);
if (missing.length > 0) {
    throw new Error(`Integration tests require ${REQUIRED_KEYS.join(', ')} — missing: ${missing.join(', ')}`);
}
```

(The `hasCredentials` export is intentionally removed; no file imports it after this task.)

- [ ] **Step 2: Create `vitest.integration.config.js`**

This config has no license header, matching `vitest.config.js`.

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/integration/**/*.test.js'],
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js', './tests/integration/setup.js'],
    },
});
```

- [ ] **Step 3: De-skip the API client tests**

In `tests/integration/api-clients.test.js`:

- Remove the import line `import { hasCredentials } from './setup';` (line 19).
- Remove the now-unused `const xmdbCreds = ['XMDB_API_KEY'];` and `const omdbCreds = ['OMDB_API_KEY'];` lines (27–28).
- Replace every `it.skipIf(!hasCredentials(xmdbCreds))(` and `it.skipIf(!hasCredentials(omdbCreds))(` with plain `it(`.

Run this to confirm no `skipIf`/`hasCredentials` references remain:

Run: `grep -n "skipIf\|hasCredentials\|xmdbCreds\|omdbCreds" tests/integration/api-clients.test.js`
Expected: no output.

- [ ] **Step 4: Verify the guard fails loudly when keys are missing**

Run (forcing both keys empty so the guard's `.env` load cannot satisfy them):

Run: `XMDB_API_KEY= OMDB_API_KEY= npx vitest run -c vitest.integration.config.js`
Expected: FAIL — error message `Integration tests require XMDB_API_KEY, OMDB_API_KEY — missing: XMDB_API_KEY, OMDB_API_KEY`.

- [ ] **Step 5: Verify the suite runs when keys are present**

If a local `.env` with real `XMDB_API_KEY` and `OMDB_API_KEY` exists:

Run: `npx vitest run -c vitest.integration.config.js`
Expected: PASS (live API). If no local keys are available, skip this step and note it — the nightly will exercise it.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/setup.js vitest.integration.config.js tests/integration/api-clients.test.js
git commit -m "test: enforce integration API keys and add integration vitest config"
```

---

### Task 4: Scope default and coverage test scripts explicitly

**Files:**

- Modify: `package.json` (scripts block)

**Interfaces:**

- Consumes: `vitest.integration.config.js` from Task 3.
- Produces: updated npm scripts used by CI jobs in Task 5.

- [ ] **Step 1: Update the scripts**

In `package.json`, change these four script lines:

```json
        "test": "vitest run tests/unit tests/ui",
        "test:unit": "vitest run tests/unit",
        "test:ui": "vitest run tests/ui",
        "test:integration": "vitest run -c vitest.integration.config.js",
        "test:coverage": "vitest run tests/unit tests/ui --coverage",
```

(`test:unit` and `test:ui` are unchanged in value; shown for placement. Only `test`, `test:integration`, and `test:coverage` change.)

- [ ] **Step 2: Verify default test run excludes integration**

Run: `npm test`
Expected: PASS — runs only `tests/unit` and `tests/ui`; no integration tests appear and no credential error is thrown.

- [ ] **Step 3: Verify coverage run excludes integration**

Run: `npm run test:coverage`
Expected: PASS — coverage report generated over unit + ui; thresholds (90% lines/functions) still met; no credential error.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "build: scope default and coverage test scripts to unit and ui"
```

---

### Task 5: Remove the integration job from per-PR CI

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Delete the `test-integration` job**

Remove this entire block from `ci.yml` (lines 52–62):

```yaml
test-integration:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
        - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
        - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
          with:
              node-version: '24.x'
              cache: 'npm'
        - run: npm ci --ignore-scripts
        - run: npm run test:integration
```

- [ ] **Step 2: Drop `test-integration` from the merge-gate needs**

Change the `merge-gate` `needs:` line from:

```yaml
needs: [lint-and-audit, build, test-unit, test-integration, test-ui, test-coverage]
```

to:

```yaml
needs: [lint-and-audit, build, test-unit, test-ui, test-coverage]
```

- [ ] **Step 3: Verify the workflow is valid YAML and no stale references remain**

Run: `grep -n "test-integration" .github/workflows/ci.yml`
Expected: no output.

Run: `node -e "require('js-yaml')" 2>/dev/null && npx --yes js-yaml .github/workflows/ci.yml >/dev/null && echo VALID || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('VALID')"`
Expected: `VALID`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: remove integration tests from per-PR pipeline"
```

---

### Task 6: Add the nightly integration workflow

**Files:**

- Create: `.github/workflows/nightly.yml`

**Interfaces:**

- Consumes: `npm run test:integration` (Task 4), `vitest.integration.config.js` (Task 3), Actions secrets `XMDB_API_KEY` / `OMDB_API_KEY`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create `.github/workflows/nightly.yml`**

```yaml
name: Nightly Integration

on:
    schedule:
        - cron: '0 3 * * *' # 03:00 UTC daily
    workflow_dispatch:

permissions:
    contents: read

jobs:
    test-integration:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        steps:
            - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
              with:
                  node-version: '24.x'
                  cache: 'npm'
            - run: npm ci --ignore-scripts
            - run: npm run test:integration
              env:
                  XMDB_API_KEY: ${{ secrets.XMDB_API_KEY }}
                  OMDB_API_KEY: ${{ secrets.OMDB_API_KEY }}
```

- [ ] **Step 2: Verify the workflow is valid YAML**

Run: `npx --yes js-yaml .github/workflows/nightly.yml >/dev/null && echo VALID || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/nightly.yml')); print('VALID')"`
Expected: `VALID`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/nightly.yml
git commit -m "ci: run integration tests as a nightly workflow"
```

- [ ] **Step 4: Manual follow-up (out of band, not a commit)**

Add repository Actions secrets `XMDB_API_KEY` and `OMDB_API_KEY` (Settings → Secrets and variables → Actions). Until added, the nightly run fails at the credential guard by design. Optionally trigger a manual run via the workflow's `workflow_dispatch` to confirm.

---

### Task 7: Update AGENTS.md documentation

**Files:**

- Modify: `AGENTS.md` (Test Suites table ~line 65, Test Layout tree ~line 96, Integration Tests section ~line 108, and the integration credentials note ~line 312)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update the Test Suites table**

Replace the table rows so they read:

```markdown
| Command                    | What it runs                          |
| -------------------------- | ------------------------------------- |
| `npm test`                 | `tests/unit/**` + `tests/ui/**`       |
| `npm run test:unit`        | `tests/unit/**`                       |
| `npm run test:ui`          | `tests/ui/**`                         |
| `npm run test:integration` | `tests/integration/**` (nightly only) |
| `npm run test:coverage`    | unit + ui with V8 coverage report     |
| `npx vitest -t "name"`     | Filter by test name                   |
```

- [ ] **Step 2: Update the Test Layout tree**

Change the `integration/` block so it lists only the two remaining files:

```
  integration/
    setup.js              # Loads .env + fails if required API keys are missing
    api-clients.test.js
```

- [ ] **Step 3: Rewrite the Integration Tests section**

Replace the paragraph under `### Integration Tests` with:

```markdown
Integration tests in `tests/integration/` make live HTTP requests to external
APIs. They run only via `npm run test:integration` (the dedicated
`vitest.integration.config.js`) and on the nightly `Nightly Integration`
workflow — never in per-PR CI. They require `XMDB_API_KEY` and `OMDB_API_KEY`
in the environment: locally via a `.env` file (loaded by
`tests/integration/setup.js` through `dotenv`), and in CI via repository Actions
secrets. If either key is missing the suite **fails fast** with a clear error
rather than skipping. Do not mock HTTP in integration tests.
```

- [ ] **Step 4: Update the integration credentials note (~line 312)**

Replace the bullet:

```markdown
- **Integration test credentials**: Tests in `tests/integration/` need real API keys (`XMDB_API_KEY`, `OMDB_API_KEY`) in the environment — a local `.env` or CI Actions secrets. Without them the suite fails fast (it does not skip). These tests run nightly, not in per-PR CI. Do not mock HTTP in integration tests.
```

- [ ] **Step 5: Verify formatting passes**

Run: `npm run format:check`
Expected: PASS (no formatting diffs in `AGENTS.md`). If it reports a diff, run `npm run format` and re-stage.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document nightly integration tests and credential enforcement"
```

---

## Final Verification

- [ ] Run `npm test` → unit + ui pass, no integration, no credential error.
- [ ] Run `npm run test:coverage` → passes, thresholds met.
- [ ] Run `XMDB_API_KEY= OMDB_API_KEY= npx vitest run -c vitest.integration.config.js` → fails with the missing-keys message.
- [ ] Run `grep -rn "test-integration" .github/workflows/ci.yml` → no output.
- [ ] Run `grep -rn "hasCredentials" tests/` → no output.
- [ ] Confirm `git status` shows only intended changes.
