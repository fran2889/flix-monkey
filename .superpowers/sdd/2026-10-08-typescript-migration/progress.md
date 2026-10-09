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
- [x] Task 1.3: Update Rollup Configuration (commit: 634298e - typescript plugin added to sharedPlugins)
- [x] Task 1.4: Update ESLint Configuration (commits ea9a592 + 73af925)

### Phase 1: Foundation Files

- [x] Task 2.1: Migrate Constants (commit: d6bffab - constants.ts with types)
- [x] Task 2.2: Migrate Title Class (commit: 73af925 - title.ts, title.test.ts, mocks/title.ts)
- [x] Task 2.3: Migrate Utility Functions (commit: 3d3f743 - color-utils, general-utils, string-utils, url-utils, utils/index, rate-limits)

### Phase 2: Services & Managers

- [x] Task 3.1: Migrate Cache (commit: ad058dc - cache-entry.ts, cache-manager.ts, cache/index.ts, cache.test.ts, mocks/cache.ts)
- [x] Task 3.2: Migrate Config (config-fields.ts, config-manager.ts, config/index.ts done; config-manager.test.ts migrated in commit 0fe5bb7)
- [x] Task 3.3: Migrate API Manager (commit: 2cb2b2b - api-manager.ts, api-manager.test.js; updated in 18ff681)
- [x] Task 3.4: Migrate Services (commit: 18ff681 - base-streaming-service.ts, netflix-service.ts, disney-plus-service.ts, hbo-max-service.ts, service-registry.ts, services/index.ts + tests)
- [x] Task 3.5: Migrate Remaining Managers (commit: 2206bf2 - disabled-clients.ts; commit: 349f2e3 - fade-manager.ts, id-override-manager.ts, request-queue.ts; commit: 47ba18f - fade-manager.ts updated; migrations.ts, logger.ts also migrated)

### Phase 3: Core Application

- [x] Task 4.1: Migrate Surfaces (surface-manager.ts, surface-definitions/*.ts, surfaces/index.ts + types/surfaces.ts - current work)

### Phase 3: Core Application

- [ ] Task 4.1: Migrate Surfaces
- [ ] Task 4.2: Migrate Overlay
- [ ] Task 4.3: Migrate App

### Phase 4: Platform Adapters

- [x] Task 5.1: Migrate Platform Adapter Base (commit: ad058dc - adapter.ts, mocks/adapter.ts)
- [ ] Task 5.2: Migrate Platform Implementations (userscript.js, webextension.js + mocks)

### Phase 5: UI Components

- [ ] Task 6.1: Migrate UI Modules

### Phase 6: API Clients

- [x] Task 7.1: Migrate API Clients (commit: 344b9e6 - base-api-client.ts, xmdb-api-client.ts, omdb-api-client.ts, agregarr-api-client.ts, title-type-mappers.ts, api/index.ts, types/api.ts, id-override-manager.ts, request-queue.ts, tests/mocks/adapter.ts, tests/unit/core/api/title-type-mappers.test.ts)

### Phase 7: Target Entry Points

- [ ] Task 8.1: Migrate Extension Targets
- [ ] Task 8.2: Migrate Firefox Target
- [ ] Task 8.3: Migrate Chrome Target
- [ ] Task 8.4: Migrate Userscript Target

### Phase 8: Test Infrastructure

- [x] Task 9.1: Migrate Remaining Mocks (commit: ad058dc - mocks/adapter.ts, mocks/cache.ts, mocks/config.ts, mocks/logger.ts)
- [ ] Task 9.1: Migrate Remaining Mocks (platform.js, webextension.js, userscript.js, setup.js still need migration)

### Phase 9: UI Tests

- [ ] Task 10.1: Migrate UI Test Files

### Final Verification

- [ ] Task 11.1: Full Migration Verification

## Rulings

- Task 1.3: @rollup/plugin-typescript cannot be added to Rollup config yet because it fails when no TS files exist. Will add plugin to sharedPlugins() when first TS file is migrated (Task 2.1). Cost if wrong: TS files won't compile until plugin is added, but no TS files exist yet so this is safe.
- Note: Rollup typescript plugin was successfully added in commit 634298e after first TS files were created.
- Note: API Manager migration is blocked by base-api-client.js dependency. Must migrate API Clients (Task 7.1) first, as api-manager depends on BaseApiClient.

## Current Status

As of 2026-10-09:

- TypeScript infrastructure complete
- Foundation files (constants, title, utils, rate-limits) migrated
- Cache, Config, Logger, Platform Adapter migrated
- Disabled Clients migrated (source + test)
- API Clients migrated (base-api-client, xmdb-api-client, omdb-api-client, agregarr-api-client, title-type-mappers) + dependencies (id-override-manager, request-queue)
- API Manager migrated (api-manager.ts, api-manager.test.ts) - commit: 2cb2b2b
- Mocks for migrated modules migrated
- All tests passing (742 tests), type-check passing, lint passing
- Services (Task 3.4) now unblocked
- Next: Migrate Services (Task 3.4), then remaining managers

## Commands Reference

- Type check: npm run type-check
- Tests: npm test
- Build: npm run build
- Lint: npm run lint

## Final Review
