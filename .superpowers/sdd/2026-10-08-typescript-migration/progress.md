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

- [x] Task 0.1: Create Pre-Migration Branch (commits 208da1c..2654d62, branch created)
- [x] Task 1.1: Add TypeScript Dependencies (commits 2654d62..f0d4132, npm install succeeded)
- [x] Task 1.2: Configure TypeScript (commits f0d4132..6199be9, tsconfig.json created)
- [ ] Task 1.3: Update Rollup Configuration
- [ ] Task 1.2: Configure TypeScript
- [ ] Task 1.3: Update Rollup Configuration
- [ ] Task 1.4: Update ESLint Configuration
- [ ] Task 2.1: Migrate Constants
- [ ] Task 2.2: Migrate Title Class
- [ ] Task 2.3: Migrate Utility Functions
- [ ] Task 3.1: Migrate Cache
- [ ] Task 3.2: Migrate Config
- [ ] Task 3.3: Migrate API Manager
- [ ] Task 3.4: Migrate Services
- [ ] Task 3.5: Migrate Remaining Managers
- [ ] Task 4.1: Migrate Surfaces
- [ ] Task 4.2: Migrate Overlay
- [ ] Task 4.3: Migrate App
- [ ] Task 5.1: Migrate Platform Adapter Base
- [ ] Task 5.2: Migrate Platform Implementations
- [ ] Task 6.1: Migrate UI Modules
- [ ] Task 7.1: Migrate API Clients
- [ ] Task 8.1: Migrate Extension Targets
- [ ] Task 8.2: Migrate Firefox Target
- [ ] Task 8.3: Migrate Chrome Target
- [ ] Task 8.4: Migrate Userscript Target
- [ ] Task 9.1: Migrate Remaining Mocks
- [ ] Task 10.1: Migrate UI Test Files
- [ ] Task 11.1: Full Migration Verification

## Rulings

- Task 1.3: @rollup/plugin-typescript cannot be added to Rollup config yet because it fails when no TS files exist. Will add plugin to sharedPlugins() when first TS file is migrated (Task 2.1). Cost if wrong: TS files won't compile until plugin is added, but no TS files exist yet so this is safe.

## Final Review
