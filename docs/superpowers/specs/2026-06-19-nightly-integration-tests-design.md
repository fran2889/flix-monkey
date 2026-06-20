# Nightly Integration Tests with Hard Credential Enforcement

**Date:** 2026-06-19

## Problem

Integration tests in `tests/integration/` run on every push/PR via the
`test-integration` job in `ci.yml`. Because no API keys are configured in CI,
every credential-dependent assertion is silently skipped through
`it.skipIf(!hasCredentials(...))`, and the `merge-gate` still reports green.
This gives false confidence: the live-API tests never actually run, and a
broken external integration would not be caught.

Two further issues compound this:

1. The `tests/integration/` folder mixes a genuine external-system test
   (`api-clients.test.js`) with two tests that use only mocks
   (`config-manager.test.js`, `request-queue.test.js`) and make no network
   calls — they are mislabeled unit tests.
2. CI's `test-coverage` job runs `vitest run --coverage` with no path filter,
   so it implicitly runs the whole tree (unit + ui + integration) while the
   `test-unit`/`test-ui` jobs are path-scoped. This is an inconsistency that is
   currently masked only because integration tests skip.

## Goals

- Exclude integration tests from per-PR CI and from local default test runs.
- Run integration tests on a nightly schedule with real API keys.
- Make integration runs **fail loudly** when required API keys are missing,
  instead of quietly skipping.
- In CI, read API keys from environment variables (workflow secrets), not from
  a committed `.env`.
- Reclassify the mock-only "integration" tests as the unit tests they actually
  are, so `tests/integration/` contains only true external-system tests.
- Make `test:coverage` scope explicit so it matches the scoped test jobs.

## Non-Goals

- Adding new integration test cases or new external APIs.
- Changing the production source under `src/`.
- Reworking the release or build workflows.

## Design

### 1. Reclassify tests — `tests/integration/` becomes real-API-only

`tests/integration/api-clients.test.js` is the only test that makes live HTTP
requests and needs credentials. The other two use mocks:

- `config-manager.test.js` exercises `ConfigManager` with a mock adapter/logger
  (`CONFIG_DEFAULTS` round-trips, fallback handling, int/float parsing, falsy
  values). Some cases already overlap `tests/unit/core/config-manager.test.js`.
- `request-queue.test.js` enqueues concurrent requests with a `mockFetch`
  returning `{ status: 200 }` — no network call, despite its comment. It is
  largely redundant with the concurrency/priority cases already in
  `tests/unit/core/request-queue.test.js`, and contains a dead `it.skip`
  branch.

Actions:

- Fold the unique cases from `integration/config-manager.test.js` into
  `tests/unit/core/config-manager.test.js`, dropping cases already covered
  there. Delete the integration file.
- Move the meaningful concurrency assertion from
  `integration/request-queue.test.js` into
  `tests/unit/core/request-queue.test.js` (drop the `it.skip`/credential
  branch). Delete the integration file.

Result: `tests/integration/` contains only `api-clients.test.js` plus
`setup.js`.

### 2. Credential enforcement — fail-fast, env-var-driven

Rewrite `tests/integration/setup.js` as an integration **setupFile** (runs in
each test worker so the assertion fails the run and env vars reach the tests):

- Optionally load `.env` via `dotenv` for local development. `dotenv.config()`
  does not override already-set variables, so in CI the values passed through
  the workflow's `env:` block take precedence and `.env` is irrelevant (it is
  never present in CI).
- Assert that `XMDB_API_KEY` and `OMDB_API_KEY` are present in `process.env`.
  If any are missing, **throw** with a clear message listing exactly which keys
  are absent (e.g. `Integration tests require XMDB_API_KEY, OMDB_API_KEY —
missing: OMDB_API_KEY`).
- Remove the `hasCredentials` helper (no longer used).

Add `vitest.integration.config.js`:

- `include: ['tests/integration/**/*.test.js']`
- `environment: 'jsdom'` (matching the base config)
- `setupFiles: ['./tests/setup.js', './tests/integration/setup.js']` — the
  shared MSW/jest-dom setup plus the integration credential guard. MSW's
  default `onUnhandledRequest` passes real requests through, so live API calls
  still work.

Update `api-clients.test.js`:

- Replace every `it.skipIf(!hasCredentials(...))` with a plain `it`.
- Remove the `hasCredentials` import.

### 3. Explicit, consistent test scoping (package.json scripts)

Make integration opt-in everywhere by scoping the default and coverage runs
explicitly, rather than relying on a base-config `exclude`:

| Script             | Command                                      |
| ------------------ | -------------------------------------------- |
| `test`             | `vitest run tests/unit tests/ui`             |
| `test:unit`        | `vitest run tests/unit` (unchanged)          |
| `test:ui`          | `vitest run tests/ui` (unchanged)            |
| `test:coverage`    | `vitest run tests/unit tests/ui --coverage`  |
| `test:integration` | `vitest run -c vitest.integration.config.js` |

`vitest.config.js` is left unchanged (no added `exclude`). Integration tests
run only through `test:integration` / the integration config. `test:coverage`
now covers the same universe as the scoped test jobs.

### 4. CI pipeline (`ci.yml`) — drop integration

- Remove the `test-integration` job.
- Remove `test-integration` from `merge-gate.needs`.

Per-PR CI retains: `lint-and-audit`, `build`, `test-unit`, `test-ui`,
`test-coverage`, `merge-gate`.

### 5. Nightly workflow (`.github/workflows/nightly.yml`)

```yaml
name: Nightly Integration

on:
    schedule:
        - cron: '0 3 * * *' # 03:00 UTC daily
    workflow_dispatch: # allow manual runs

permissions:
    contents: read

jobs:
    test-integration:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        steps:
            - uses: actions/checkout@... # pinned, matching ci.yml
            - uses: actions/setup-node@... # pinned, matching ci.yml
              with:
                  node-version: '24.x'
                  cache: 'npm'
            - run: npm ci --ignore-scripts
            - run: npm run test:integration
              env:
                  XMDB_API_KEY: ${{ secrets.XMDB_API_KEY }}
                  OMDB_API_KEY: ${{ secrets.OMDB_API_KEY }}
```

Action pins (`actions/checkout`, `actions/setup-node`) reuse the exact SHA-
pinned versions already used in `ci.yml`.

**Repository setup required:** `XMDB_API_KEY` and `OMDB_API_KEY` must be added
as GitHub Actions secrets. Until they are, the nightly run fails at the
credential guard — which is the intended behavior (fail, do not skip).

### 6. Documentation (`AGENTS.md`)

- Update the Test Suites table: `npm test` and `npm run test:coverage` run
  unit + ui (not integration); `npm run test:integration` is the only entry
  that runs `tests/integration/**`.
- Update the Test Layout tree: `tests/integration/` contains only `setup.js`
  and `api-clients.test.js`.
- Rewrite the Integration Tests section: integration tests run nightly, require
  real API keys read from environment variables (`.env` is a local-dev
  convenience only), and **fail** when keys are absent rather than skipping via
  `hasCredentials()`. Remove the skip-gracefully guidance.

## Risks / Notes

- The nightly will fail until the two Actions secrets are configured. This is
  intended and visible.
- Moving the mock-only tests into unit may surface trivial duplicate cases;
  duplicates already covered in the unit files are dropped during the move.
- Excluding integration from `test:coverage` does not change CI coverage
  numbers: integration tests already contribute zero coverage in CI today
  (no keys → skipped).
