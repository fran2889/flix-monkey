# SDD ledger — plan: docs/superpowers/plans/2026-10-08-typescript-migration.md

## Pre-flight Scan

- Task 1.1 (dependencies) → Task 1.2 (tsconfig): Task 1.2 consumes TS compiler from Task 1.1 — OK, sequential
- Task 1.1 (dependencies) → Task 1.3 (Rollup): Task 1.3 consumes @rollup/plugin-typescript from Task 1.1 — OK, sequential
- Task 1.1 (dependencies) → Task 1.4 (ESLint): Task 1.4 consumes ESLint TS plugins from Task 1.1 — OK, sequential
- Task 1.2 (tsconfig) → All migration tasks: All consume tsconfig.json — OK, Task 1.2 runs first
- Task 1.3 (Rollup) → All migration tasks: All consume Rollup TS plugin — OK, Task 1.3 runs first
- Task 1.4 (ESLint) → All migration tasks: All consume ESLint TS parser — OK, Task 1.4 runs first
- All migration tasks are ordered bottom-up by dependency — OK

Pre-flight: No conflicts found. All interface dependencies are sequential.

## Tasks

### Phase 0: Infrastructure Setup

- [x] Task 0.1: Create Pre-Migration Branch (commits 208da1c..2654d62)

### Phase 1: Tooling Configuration

- [x] Task 1.1: Add TypeScript Dependencies (commits 2654d62..f0d4132)
- [x] Task 1.2: Configure TypeScript (commits f0d4132..6199be9)
- [x] Task 1.3: Update Rollup Configuration (commit: 634298e)
- [x] Task 1.4: Update ESLint Configuration (commits ea9a592 + 73af925)

### Phase 1: Foundation Files

- [x] Task 2.1: Migrate Constants (commit: d6bffab)
- [x] Task 2.2: Migrate Title Class (commit: 73af925)
- [x] Task 2.3: Migrate Utility Functions (commit: 3d3f743)

### Phase 2: Services & Managers

- [x] Task 3.1: Migrate Cache (commit: ad058dc)
- [x] Task 3.2: Migrate Config (config-fields.ts, config-manager.ts, config/index.ts; config-manager.test.ts in 0fe5bb7)
- [x] Task 3.3: Migrate API Manager (commit: 2cb2b2b, updated in 18ff681)
- [x] Task 3.4: Migrate Services (commit: 18ff681)
- [x] Task 3.5: Migrate Remaining Managers (disabled-clients in 2206bf2; fade-manager, id-override-manager, request-queue in 344b9e6; migrations, logger in ad058dc)

### Phase 2.5: Type Definitions

- [x] Task: Migrate Types (commit: 18ff681 - services.ts, overlay.ts, extension.ts, index.ts, migrations.ts, platform.ts, surfaces.ts, title.ts)

### Phase 3: Core Application

- [x] Task 4.1: Migrate Surfaces (commit: e7f28f3)
- [x] Task 4.2: Migrate Overlay (commit: 1f76b22)
- [x] Task 4.3: Migrate App (app.ts in 516168e; app.test.ts in 476908a, commit: 476908a)

### Phase 4: Platform Adapters

- [x] Task 5.1: Migrate Platform Adapter Base (commit: ad058dc)
- [x] Task 5.2: Migrate Platform Implementations (userscript.ts, webextension.ts + mocks, commit: f2cc712)

### Phase 5: UI Components

- [ ] Task 6.1: Migrate UI Modules (modal.js, settings-ui.js, settings-view.js, overlay-elements.js, overlay-styles.js, styles.js + tests)

### Phase 6: API Clients

- [x] Task 7.1: Migrate API Clients (commit: 344b9e6 - base-api-client.ts, xmdb-api-client.ts, omdb-api-client.ts, agregarr-api-client.ts, title-type-mappers.ts, api/index.ts, types/api.ts)

### Phase 7: Target Entry Points

- [ ] Task 8.1: Migrate Extension Targets (content.js, options.js, fetch-proxy.js, domains.js)
- [ ] Task 8.2: Migrate Firefox Target (background.js)
- [ ] Task 8.3: Migrate Chrome Target (service-worker.js)
- [ ] Task 8.4: Migrate Userscript Target (entry.js, metadata.js)

### Phase 8: Test Infrastructure

- [x] Task 9.1: Migrate Mocks (adapter.ts, cache.ts, config.ts, logger.ts in ad058dc)
- [ ] Task 9.1: Migrate Remaining Mocks (chrome.js, platform.js, webextension.js, userscript.js, setup.js)

### Phase 9: UI Tests

- [ ] Task 10.1: Migrate UI Test Files (netflix.ui.test.js, hbomax.ui.test.js, disneyplus.ui.test.ts)

### Final Verification

- [ ] Task 11.1: Full Migration Verification

## Rulings

- Task 1.3: @rollup/plugin-typescript cannot be added to Rollup config yet because it fails when no TS files exist. Will add plugin to sharedPlugins() when first TS file is migrated (Task 2.1). Cost if wrong: TS files won't compile until plugin is added, but no TS files exist yet so this is safe.
- Note: Rollup typescript plugin was successfully added in commit 634298e after first TS files were created.
- Note: API Manager migration was initially blocked by base-api-client.js dependency. Must migrate API Clients (Task 7.1) first, as api-manager depends on BaseApiClient. This was resolved by migrating API Clients in commit 344b9e6, then API Manager in 2cb2b2b.

## Current Status

As of 2026-10-09:

- TypeScript infrastructure complete
- Foundation files (constants, title, utils, rate-limits) migrated
- Cache, Config, Logger, Platform Adapter migrated
- Disabled Clients, Fade Manager, ID Override Manager, Request Queue, Migrations migrated
- API Clients (base-api-client, xmdb, omdb, agregarr, title-type-mappers) + dependencies migrated
- API Manager migrated
- Surfaces, Overlay, App (source + test) migrated
- Platform Implementations (userscript, webextension + mocks) migrated
- Type definitions migrated
- All tests passing (869 tests), type-check passing, lint passing, build passing

## Task Completion Summary

### Task 4.3: Migrate App - COMPLETE

- **BASE commit:** b8223f836323391ccbb03fd03bfb33d92beee595
- **Implementation commit:** 476908ad16734da929c85c0fffc08daf81d1e98f
- **Status:** DONE
- **Report:** .superpowers/sdd/2026-10-08-typescript-migration/task-4.3-report.md
- **Files changed:** tests/unit/core/app.test.js → tests/unit/core/app.test.ts (232 lines changed, 145 insertions, 87 deletions)
- **Verification:** All checks passed (type-check, tests, build, lint)
- **Test results:** 869 tests passed

### Task 5.2: Migrate Platform Implementations - COMPLETE

- **BASE commit:** 1632525fc738f4ccac8dbe15aaf49ea70b6c85d0
- **Implementation commit:** f2cc712
- **Status:** DONE
- **Report:** .superpowers/sdd/2026-10-08-typescript-migration/task-5.2-report.md
- **Files changed:** 18 files changed, 414 insertions(+), 314 deletions(-)
- **Verification:** All checks passed (type-check, tests, build, lint)
- **Test results:** 869 tests passed

## Commands Reference

- Type check: npm run type-check
- Tests: npm test
- Build: npm run build
- Lint: npm run lint

## Next Task

**Task 6.1: Migrate UI Modules**

- Files: src/core/ui/modal.js, settings-ui.js, settings-view.js, overlay-elements.js, overlay-styles.js, styles.js + tests
- Dependencies: All core dependencies are TypeScript, Platform Adapter is complete
