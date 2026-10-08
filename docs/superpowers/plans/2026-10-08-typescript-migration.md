# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate flix-monkey codebase from JavaScript to TypeScript with strict type safety, using `null` instead of `undefined`, while maintaining 100% functional parity.

**Architecture:** Hybrid incremental migration - TypeScript and JavaScript coexist during migration. Rollup compiles `.ts` files while `.js` files pass through unchanged. Files migrated bottom-up (least to most dependent). Each commit migrates a source file + its test + corresponding mock as one unit.

**Tech Stack:** TypeScript 5.3+, Rollup, ESLint, Vitest, Prettier

**Spec:** docs/superpowers/specs/2026-10-08-typescript-migration-design.md

**Tracking:** docs/typescript-migration.md

---

## Global Constraints

- Node.js: >= 24
- Use `null`, not `undefined`
- All code paths must explicitly return
- Optional properties accept only absence, not `undefined`
- Type checking: `npm run type-check` (tsc --noEmit)
- Build: `npm run build` (rollup -c && node scripts/package.js)
- Test: `npm test` (vitest run tests/unit tests/ui)
- All tests must pass after each migration
- Build must succeed after each migration
- Lint must pass after each migration

---

## Review Focus

1. **null vs undefined**: Type errors from accidental `undefined` usage - tested by type-check and runtime tests
2. **Explicit returns**: Functions missing return on some code paths - tested by type-check with noImplicitReturns
3. **Optional properties**: Optional fields accepting `undefined` - tested by type-check with exactOptionalPropertyTypes
4. **Type assertions**: Overuse of `as` casts masking type issues - tested by code review
5. **Build output**: Bundle differences between JS and TS source - tested by build verification

---

## Phase 0: Infrastructure Setup

### Task 0.1: Create Pre-Migration Branch

**Files:**

- Create: (branch) `pre-typescript-migration`

- [ ] **Step 1: Create rollback branch**

Run: `git checkout -b pre-typescript-migration`
Expected: New branch created from current HEAD

- [ ] **Step 2: Push branch to remote**

Run: `git push origin pre-typescript-migration`
Expected: Branch available on remote

- [ ] **Step 3: Commit message verification**

Verify branch contains all pre-migration state (MSW removed, etc.)

- [ ] **Step 4: Return to main branch**

Run: `git checkout main`
Expected: Back on main branch

---

## Phase 1: Tooling Configuration

### Task 1.1: Add TypeScript Dependencies

**Files:**

- Modify: `package.json`
- Create: `tsconfig.json`

**Interfaces:**

- Produces: TypeScript compiler available for `.ts` files

- [ ] **Step 1: Add devDependencies to package.json**

Add to package.json devDependencies:

```json
"typescript": "^5.3.0",
"@types/node": "^20.10.0",
"@rollup/plugin-typescript": "^11.1.0",
"tslib": "^2.6.0",
"@typescript-eslint/eslint-plugin": "^7.0.0",
"@typescript-eslint/parser": "^7.0.0"
```

- [ ] **Step 2: Run npm install**

Run: `npm install`
Expected: All dependencies installed successfully

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add TypeScript dependencies"
```

---

### Task 1.2: Configure TypeScript

**Files:**

- Create: `tsconfig.json`

**Interfaces:**

- Produces: Strict TypeScript configuration for src/ and tests/

- [ ] **Step 1: Create tsconfig.json**

Create file with content:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noImplicitReturns": true,
        "exactOptionalPropertyTypes": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "noEmit": true,
        "outDir": "./dist-tsc"
    },
    "include": ["src/**/*", "tests/**/*"],
    "exclude": ["**/*.config.js", "scripts/**/*"]
}
```

- [ ] **Step 2: Verify tsconfig syntax**

Run: `npx tsc --noEmit`
Expected: No errors (though will fail on JS files, that's OK for now)

- [ ] **Step 3: Add type-check script to package.json**

Add to package.json scripts:

```json
"type-check": "tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json package.json
git commit -m "chore: add TypeScript configuration"
```

---

### Task 1.3: Update Rollup Configuration

**Files:**

- Modify: `rollup.config.js`

**Interfaces:**

- Consumes: `@rollup/plugin-typescript` from Task 1.1
- Produces: Rollup can compile `.ts` files

- [ ] **Step 1: Import typescript plugin**

Add to imports at top of rollup.config.js:

```javascript
import typescript from '@rollup/plugin-typescript';
```

- [ ] **Step 2: Add typescript plugin to sharedPlugins**

Update sharedPlugins function to include typescript():

```javascript
const sharedPlugins = () => [resolve(), commonjs(), typescript()];
```

- [ ] **Step 3: Verify Rollup handles TypeScript**

Run: `npm run build:userscript`
Expected: Build succeeds (no TS files yet, but no errors)

- [ ] **Step 4: Commit**

```bash
git add rollup.config.js
git commit -m "chore: add TypeScript support to Rollup"
```

---

### Task 1.4: Update ESLint Configuration

**Files:**

- Modify: `eslint.config.js`

**Interfaces:**

- Consumes: `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` from Task 1.1
- Produces: ESLint can lint TypeScript files

- [ ] **Step 1: Update ESLint config**

Replace @eslint/js import with @typescript-eslint/parser and add plugin:

```javascript
import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

// In the config export, update the languageOptions:
languageOptions: {
  parser: typescriptParser,
  // ... other options
},

// Add to plugins array:
plugins: {
  '@typescript-eslint': typescriptPlugin,
  // ... other plugins
}
```

- [ ] **Step 2: Update file patterns**

Add `**/*.ts` to file patterns in the config

- [ ] **Step 3: Run ESLint to verify**

Run: `npm run lint`
Expected: Passes (no TS files yet, but no errors)

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "chore: add TypeScript support to ESLint"
```

---

## Phase 1: Foundation Files

### Task 2.1: Migrate Constants

**Files:**

- Modify: `src/core/constants.js` → `src/core/constants.ts`
- Modify: `tests/unit/core/constants.test.js` → `tests/unit/core/constants.test.ts` (if exists)

**Interfaces:**

- Produces: Typed constants module
- Consumes: No dependencies (leaf module)

- [ ] **Step 1: Rename file**

Run: `mv src/core/constants.js src/core/constants.ts`

- [ ] **Step 2: Add TypeScript types**

Convert JSDoc types to TypeScript types. Example:

```typescript
// Before: JSDoc
/** @typedef {Object} ApiSource */
/** @property {string} XMDB */

// After: TypeScript
export const ApiSource = {
    XMDB: 'xmdb',
    OMDB: 'omdb',
    AGREGARR: 'agregarr',
} as const;

export type ApiSourceType = (typeof ApiSource)[keyof typeof ApiSource];
```

- [ ] **Step 3: Migrate test file**

Rename and update imports:

```typescript
import { ApiSource, DAYS_TO_MS } from '../../../src/core/constants.js';
// →
import { ApiSource, DAYS_TO_MS } from '../../../src/core/constants';
```

- [ ] **Step 4: Run type-check**

Run: `npm run type-check`
Expected: No errors for constants.ts

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/core/constants.ts tests/unit/core/constants.test.ts
git commit -m "feat(ts-migration): migrate constants to TypeScript"
```

---

### Task 2.2: Migrate Title Class

**Files:**

- Modify: `src/core/title.js` → `src/core/title.ts`
- Modify: `tests/unit/core/title.test.js` → `tests/unit/core/title.test.ts`

**Interfaces:**

- Produces: Typed Title class
- Consumes: No external dependencies

- [ ] **Step 1: Rename file**

Run: `mv src/core/title.js src/core/title.ts`

- [ ] **Step 2: Convert class to TypeScript**

Add type annotations to all properties and methods:

```typescript
export class Title {
    #imdbRating: number | null = null;

    constructor(data: { imdbId: string; displayTitle: string; imdbRating?: number }) {
        // ...
    }

    get rating(): number | null {
        return this.#imdbRating;
    }
}
```

- [ ] **Step 3: Update test file**

Rename and ensure all assertions work with typed methods

- [ ] **Step 4: Run type-check**

Run: `npm run type-check`
Expected: No errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/core/title.ts tests/unit/core/title.test.ts
git commit -m "feat(ts-migration): migrate Title class to TypeScript"
```

---

### Task 2.3: Migrate Utility Functions

**Files:**

- Modify: `src/core/utils/string-utils.js` → `src/core/utils/string-utils.ts`
- Modify: `tests/unit/core/utils/string-utils.test.js` → `tests/unit/core/utils/string-utils.test.ts`
- Modify: `src/core/utils/general-utils.js` → `src/core/utils/general-utils.ts`
- Modify: `tests/unit/core/utils/general-utils.test.js` → `tests/unit/core/utils/general-utils.test.ts`
- Modify: `src/core/utils/url-utils.js` → `src/core/utils/url-utils.ts`
- Modify: `tests/unit/core/utils/url-utils.test.js` → `tests/unit/core/utils/url-utils.test.ts`
- Modify: `src/core/utils/color-utils.js` → `src/core/utils/color-utils.ts`
- Modify: `tests/unit/core/utils/color-utils.test.js` → `tests/unit/core/utils/color-utils.test.ts`
- Modify: `src/core/utils/index.js` → `src/core/utils/index.ts`
- Modify: `src/core/rate-limits.js` → `src/core/rate-limits.ts`

**Interfaces:**

- Produces: Typed utility modules
- Consumes: No dependencies on other src files (or minimal)

- [ ] **Step 1: Migrate each utility file**

For each file:

1. Rename `.js` → `.ts`
2. Add type annotations to all function parameters and return types
3. Use `null` instead of `undefined`
4. Ensure all code paths return explicitly

- [ ] **Step 2: Update barrel index**

Update `src/core/utils/index.ts` to use TypeScript exports

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: No errors

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/core/utils/*.ts tests/unit/core/utils/*.test.ts
git commit -m "feat(ts-migration): migrate utility functions to TypeScript"
```

---

## Phase 2: Services & Managers

### Task 3.1: Migrate Cache

**Files:**

- Modify: `src/core/cache/cache-entry.js` → `src/core/cache/cache-entry.ts`
- Modify: `tests/unit/core/cache/cache-entry.test.js` → `tests/unit/core/cache/cache-entry.test.ts`
- Modify: `src/core/cache/cache-manager.js` → `src/core/cache/cache-manager.ts`
- Modify: `tests/unit/core/cache/cache-manager.test.js` → `tests/unit/core/cache/cache-manager.test.ts`
- Modify: `src/core/cache/index.js` → `src/core/cache/index.ts`

**Interfaces:**

- Produces: Typed cache modules
- Consumes: May depend on constants from Phase 1

- [ ] **Step 1: Migrate cache-entry.ts**

Rename and add types for cache entry data structure

- [ ] **Step 2: Migrate cache-manager.ts**

Add types for CacheManager class methods

- [ ] **Step 3: Update barrel index**

- [ ] **Step 4: Run type-check, tests, build**

- [ ] **Step 5: Commit**

```bash
git add src/core/cache/*.ts tests/unit/core/cache/*.test.ts
git commit -m "feat(ts-migration): migrate cache to TypeScript"
```

---

### Task 3.2: Migrate Config

**Files:**

- Modify: `src/core/config/config-fields.js` → `src/core/config/config-fields.ts`
- Modify: `src/core/config/config-manager.js` → `src/core/config/config-manager.ts`
- Modify: `tests/unit/core/config/config-manager.test.js` → `tests/unit/core/config/config-manager.test.ts`
- Modify: `src/core/config/index.js` → `src/core/config/index.ts`

**Interfaces:**

- Produces: Typed config modules
- Consumes: May use constants from Phase 1

- [ ] **Step 1: Migrate config-fields.ts**

Add proper types for CONFIG_FIELDS array

- [ ] **Step 2: Migrate config-manager.ts**

Add types for ConfigManager class and reactive config object

- [ ] **Step 3: Update barrel index**

- [ ] **Step 4: Run type-check, tests, build**

- [ ] **Step 5: Commit**

```bash
git add src/core/config/*.ts tests/unit/core/config/*.test.ts
git commit -m "feat(ts-migration): migrate config to TypeScript"
```

---

### Task 3.3: Migrate API Manager

**Files:**

- Modify: `src/core/api-manager.js` → `src/core/api-manager.ts`
- Modify: `tests/unit/core/api-manager.test.js` → `tests/unit/core/api-manager.test.ts`

**Interfaces:**

- Produces: Typed API manager
- Consumes: Depends on config from Task 3.2

- [ ] **Step 1: Migrate api-manager.ts**

Add types for ApiClientManager class

- [ ] **Step 2: Migrate test file**

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/core/api-manager.ts tests/unit/core/api-manager.test.ts
git commit -m "feat(ts-migration): migrate API manager to TypeScript"
```

---

### Task 3.4: Migrate Services

**Files:**

- Modify: `src/core/services/base-streaming-service.js` → `base-streaming-service.ts`
- Modify: `src/core/services/netflix-service.js` → `netflix-service.ts`
- Modify: `src/core/services/disney-plus-service.js` → `disney-plus-service.ts`
- Modify: `src/core/services/hbo-max-service.js` → `hbo-max-service.ts`
- Modify: `src/core/services/service-registry.js` → `service-registry.ts`
- Modify: `src/core/services/index.js` → `index.ts`
- Modify: All corresponding test files

**Interfaces:**

- Produces: Typed service classes
- Consumes: Depends on config from Task 3.2, constants from Phase 1

- [ ] **Step 1: Migrate base class first**

- [ ] **Step 2: Migrate each service implementation**

- [ ] **Step 3: Update service-registry.ts**

- [ ] **Step 4: Update barrel index**

- [ ] **Step 5: Run type-check, tests, build**

- [ ] **Step 6: Commit**

```bash
git add src/core/services/*.ts tests/unit/core/services/*.test.ts
git commit -m "feat(ts-migration): migrate services to TypeScript"
```

---

## Phase 2: Managers (Continued)

### Task 3.5: Migrate Remaining Managers

**Files:**

- Modify: `src/core/disabled-clients.js` → `disabled-clients.ts`
- Modify: `src/core/fade-manager.js` → `fade-manager.ts`
- Modify: `src/core/id-override-manager.js` → `id-override-manager.ts`
- Modify: `src/core/request-queue.js` → `request-queue.ts`
- Modify: `src/core/logger.js` → `logger.ts`
- Modify: `src/core/migrations.js` → `migrations.ts`
- Modify: All corresponding test files

**Interfaces:**

- Produces: Typed manager classes
- Consumes: May depend on config, cache, constants

- [ ] **Step 1: Migrate each manager file**

- [ ] **Step 2: Run type-check, tests, build after each**

- [ ] **Step 3: Commit all together**

```bash
git add src/core/disabled-clients.ts src/core/fade-manager.ts src/core/id-override-manager.ts src/core/request-queue.ts src/core/logger.ts src/core/migrations.ts tests/unit/core/*-manager.test.ts tests/unit/core/request-queue.test.ts tests/unit/core/logger.test.js tests/unit/core/migrations.test.js
git commit -m "feat(ts-migration): migrate managers to TypeScript"
```

---

## Phase 3: Core Application

### Task 4.1: Migrate Surfaces

**Files:**

- Modify: All files in `src/core/surfaces/` → `.ts`
- Modify: All corresponding test files

**Interfaces:**

- Produces: Typed surface discovery modules
- Consumes: Depends on config, utils from earlier phases

- [ ] **Step 1: Migrate surface-manager.ts first**

- [ ] **Step 2: Migrate each surface definition**

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/core/surfaces/*.ts tests/unit/core/surfaces/*.test.ts
git commit -m "feat(ts-migration): migrate surfaces to TypeScript"
```

---

### Task 4.2: Migrate Overlay

**Files:**

- Modify: `src/core/overlay.js` → `overlay.ts`
- Modify: `tests/unit/core/overlay.test.js` → `overlay.test.ts`

**Interfaces:**

- Produces: Typed overlay renderer
- Consumes: Depends on surfaces, config, utils

- [ ] **Step 1: Migrate overlay.ts**

Add types for OverlayRenderer class and DOM manipulation

- [ ] **Step 2: Migrate test file**

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/core/overlay.ts tests/unit/core/overlay.test.ts
git commit -m "feat(ts-migration): migrate overlay to TypeScript"
```

---

### Task 4.3: Migrate App

**Files:**

- Modify: `src/core/app.js` → `app.ts`
- Modify: `tests/unit/core/app.test.js` → `app.test.ts`

**Interfaces:**

- Produces: Typed main application class
- Consumes: Depends on all previous phases

- [ ] **Step 1: Migrate app.ts**

This is a critical file - take extra care with types

- [ ] **Step 2: Migrate test file**

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/core/app.ts tests/unit/core/app.test.ts
git commit -m "feat(ts-migration): migrate app to TypeScript"
```

---

## Phase 4: Platform Adapters

### Task 5.1: Migrate Platform Adapter Base

**Files:**

- Modify: `src/platform/adapter.js` → `adapter.ts`
- Modify: `tests/mocks/adapter.js` → `adapter.ts`

**Interfaces:**

- Produces: Typed PlatformAdapter base class
- Consumes: No dependencies on other src files

- [ ] **Step 1: Migrate adapter.ts**

Abstract class with typed abstract methods

- [ ] **Step 2: Migrate mock adapter**

Mock must extend real adapter with proper types

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/platform/adapter.ts tests/mocks/adapter.ts
git commit -m "feat(ts-migration): migrate platform adapter base to TypeScript"
```

---

### Task 5.2: Migrate Platform Implementations

**Files:**

- Modify: `src/platform/userscript.js` → `userscript.ts`
- Modify: `src/platform/webextension.js` → `webextension.ts`
- Modify: `tests/mocks/userscript.js` → `userscript.ts`
- Modify: `tests/mocks/webextension.js` → `webextension.ts`

**Interfaces:**

- Produces: Typed platform implementations
- Consumes: Extends adapter from Task 5.1

- [ ] **Step 1: Migrate each implementation**

- [ ] **Step 2: Migrate corresponding mocks**

- [ ] **Step 3: Run type-check, tests, build**

- [ ] **Step 4: Commit**

```bash
git add src/platform/*.ts tests/mocks/userscript.ts tests/mocks/webextension.ts
git commit -m "feat(ts-migration): migrate platform implementations to TypeScript"
```

---

## Phase 5: UI Components

### Task 6.1: Migrate UI Modules

**Files:**

- Modify: `src/core/ui/modal.js` → `modal.ts`
- Modify: `src/core/ui/settings-ui.js` → `settings-ui.ts`
- Modify: `src/core/ui/settings-view.js` → `settings-view.ts`
- Modify: `src/core/ui/overlay-elements.js` → `overlay-elements.ts`
- Modify: `src/core/ui/overlay-styles.js` → `overlay-styles.ts`
- Modify: `src/core/ui/styles.js` → `styles.ts`
- Modify: All corresponding test files

**Interfaces:**

- Produces: Typed UI components
- Consumes: May depend on config, constants

- [ ] **Step 1: Migrate each UI file**

- [ ] **Step 2: Run type-check, tests, build**

- [ ] **Step 3: Commit**

```bash
git add src/core/ui/*.ts tests/unit/core/ui/*.test.ts
git commit -m "feat(ts-migration): migrate UI components to TypeScript"
```

---

## Phase 6: API Clients

### Task 7.1: Migrate API Clients

**Files:**

- Modify: All files in `src/core/api/` → `.ts`
- Modify: All corresponding test files

**Interfaces:**

- Produces: Typed API client classes
- Consumes: Depends on services, config

- [ ] **Step 1: Migrate base-api-client.ts first**

- [ ] **Step 2: Migrate each API client**

- [ ] **Step 3: Update barrel index**

- [ ] **Step 4: Run type-check, tests, build**

- [ ] **Step 5: Commit**

```bash
git add src/core/api/*.ts tests/unit/core/api/*.test.ts
git commit -m "feat(ts-migration): migrate API clients to TypeScript"
```

---

## Phase 7: Target Entry Points

### Task 8.1: Migrate Extension Targets

**Files:**

- Modify: `src/targets/extension/content.js` → `content.ts`
- Modify: `src/targets/extension/options.js` → `options.ts`
- Modify: `src/targets/extension/fetch-proxy.js` → `fetch-proxy.ts`
- Modify: `src/targets/extension/domains.js` → `domains.ts`

**Interfaces:**

- Produces: Typed entry points
- Consumes: Depends on all core modules

- [ ] **Step 1: Migrate each extension file**

- [ ] **Step 2: Run type-check, tests, build**

- [ ] **Step 3: Commit**

```bash
git add src/targets/extension/*.ts
git commit -m "feat(ts-migration): migrate extension entry points to TypeScript"
```

---

### Task 8.2: Migrate Firefox Target

**Files:**

- Modify: `src/targets/firefox/background.js` → `background.ts`

**Interfaces:**

- Produces: Typed Firefox background script

- [ ] **Step 1: Migrate background.ts**

- [ ] **Step 2: Run type-check, build**

- [ ] **Step 3: Commit**

```bash
git add src/targets/firefox/background.ts
git commit -m "feat(ts-migration): migrate Firefox target to TypeScript"
```

---

### Task 8.3: Migrate Chrome Target

**Files:**

- Modify: `src/targets/chrome/service-worker.js` → `service-worker.ts`

**Interfaces:**

- Produces: Typed Chrome service worker

- [ ] **Step 1: Migrate service-worker.ts**

- [ ] **Step 2: Run type-check, build**

- [ ] **Step 3: Commit**

```bash
git add src/targets/chrome/service-worker.ts
git commit -m "feat(ts-migration): migrate Chrome target to TypeScript"
```

---

### Task 8.4: Migrate Userscript Target

**Files:**

- Modify: `src/targets/userscript/entry.js` → `entry.ts`
- Modify: `src/targets/userscript/metadata.js` → `metadata.ts`

**Interfaces:**

- Produces: Typed userscript entry

- [ ] **Step 1: Migrate entry.ts**

- [ ] **Step 2: Migrate metadata.ts**

- [ ] **Step 3: Run type-check, build**

- [ ] **Step 4: Commit**

```bash
git add src/targets/userscript/*.ts
git commit -m "feat(ts-migration): migrate userscript target to TypeScript"
```

---

## Phase 8: Test Infrastructure

### Task 9.1: Migrate Remaining Mocks

**Files:**

- Modify: `tests/mocks/chrome.js` → `chrome.ts`
- Modify: `tests/mocks/config.js` → `config.ts`
- Modify: `tests/mocks/logger.js` → `logger.ts`
- Modify: `tests/mocks/platform.js` → `platform.ts`
- Modify: `tests/setup.js` → `setup.ts`

**Interfaces:**

- Produces: Typed mock factories
- Consumes: Depends on all real classes being typed

- [ ] **Step 1: Migrate each mock file**

Ensure mocks have same type signatures as real classes

- [ ] **Step 2: Migrate setup.ts**

- [ ] **Step 3: Run type-check, tests**

- [ ] **Step 4: Commit**

```bash
git add tests/mocks/*.ts tests/setup.ts
git commit -m "feat(ts-migration): migrate test infrastructure to TypeScript"
```

---

## Phase 9: UI Tests

### Task 10.1: Migrate UI Test Files

**Files:**

- Modify: `tests/ui/netflix.ui.test.js` → `netflix.ui.test.ts`
- Modify: `tests/ui/hbomax.ui.test.js` → `hbomax.ui.test.ts`
- Modify: `tests/ui/disneyplus.ui.test.ts` → `disneyplus.ui.test.ts`

**Interfaces:**

- Produces: Typed UI tests
- Consumes: Depends on all core and UI modules being typed

- [ ] **Step 1: Migrate each UI test file**

- [ ] **Step 2: Run type-check, tests**

- [ ] **Step 3: Commit**

```bash
git add tests/ui/*.test.ts
git commit -m "feat(ts-migration): migrate UI tests to TypeScript"
```

---

## Final Verification

### Task 11.1: Full Migration Verification

**Files:** All TypeScript files

- [ ] **Step 1: Run type-check**

Run: `npm run type-check`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Build all targets**

Run: `npm run build`
Expected: All three targets build successfully

- [ ] **Step 5: Verify no JS files remain in src/ and tests/**

Run: `find src tests -name "*.js" | grep -v node_modules`
Expected: No results (all files are .ts)

- [ ] **Step 6: Create migration complete tag**

Run: `git tag typescript-migration-complete`

- [ ] **Step 7: Push all changes**

Run: `git push origin typescript-migration-prep --tags`
