# TypeScript Migration Design

**Date**: 2026-10-08  
**Author**: fran  
**Status**: Draft  
**Related**: docs/typescript-migration.md (tracking)

---

## Summary

Migrate flix-monkey from JavaScript (ES2022 modules) to TypeScript to achieve type safety and compile-time error checking while maintaining 100% functional parity across all distribution targets (userscript, Chrome Extension, Firefox Extension).

---

## Goals

1. **Type Safety**: Catch type-related bugs at compile time rather than runtime
2. **Developer Experience**: Improve IDE support, refactoring confidence, and code navigation
3. **Zero Functional Change**: Maintain identical behavior across all targets
4. **Test Coverage**: All existing tests must pass after migration

---

## Non-Goals

- Refactoring existing code structure (beyond what TypeScript requires)
- Changing external APIs or behavior
- Migrating build configuration files (rollup.config.js, etc.) to TypeScript
- Adding new features during migration

---

## Constraints

- **Node.js Version**: >= 24 (required by project)
- **Build Output**: Must remain identical for all three targets
- **Test Suite**: All tests must pass (100% pass rate maintained)
- **Linting**: All ESLint rules must pass
- **Code Style**: Must follow existing Prettier configuration
- **Type Philosophy**: Use `null`, not `undefined`

---

## Migration Strategy

### Approach: Hybrid Incremental Migration

TypeScript and JavaScript will coexist during the migration period. Rollup will compile `.ts` files while passing `.js` files through unchanged. This allows for gradual, safe migration with minimal risk.

**Why this approach:**

- Lowest risk: Can pause or rollback at any point
- Visible progress: Each file migration is a discrete, testable unit
- Minimal disruption: Existing functionality unaffected until files are migrated
- Multi-session friendly: Can be done across multiple work sessions

### Migration Order: Bottom-Up

Files are migrated from least dependent to most dependent:

1. **Phase 1 - Foundation**: Constants, utilities, pure data classes
2. **Phase 2 - Services & Managers**: API clients, cache, config, services
3. **Phase 3 - Core Application**: App class, overlay, surface management
4. **Phase 4 - Platform Adapters**: Adapter base class and implementations
5. **Phase 5 - UI Components**: Modal, settings, overlay elements
6. **Phase 6 - Target Entry Points**: Content scripts, service workers
7. **Phase 7 - Test Infrastructure**: Mock factories
8. **Phase 8 - UI Tests**: Per-service UI tests

### File Pairing

Each migration unit consists of:

- Source file: `src/.../file.js` → `file.ts`
- Test file: `tests/.../file.test.js` → `file.test.ts`
- Mock file (if exists): `tests/mocks/file.js` → `file.ts`

All three are migrated and committed together to maintain test coverage and type consistency.

---

## Architecture

### Build System Integration

**Rollup**:

- Add `@rollup/plugin-typescript` plugin
- `.ts` files are compiled; `.js` files pass through unchanged
- Output bundle format remains identical for all targets

**TypeScript Configuration** (`tsconfig.json`):

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

### Linting & Formatting

**ESLint**:

- Replace `@eslint/js` parser with `@typescript-eslint/parser`
- Add `@typescript-eslint/eslint-plugin`
- Update rules to handle TypeScript-specific syntax
- Preserve all existing JS rules

**Prettier**:

- Add TypeScript to supported file types
- Already handles TS syntax; just update file patterns

### Testing

**Vitest**:

- Works with TypeScript files out of the box
- No configuration changes needed
- Tests maintain same structure and assertions

**Test File Changes**:

- Rename `.test.js` → `.test.ts`
- Add proper type imports
- Update mock factories to preserve types

---

## Type Philosophy

### Core Principles

1. **Use `null`, not `undefined`**: All optional or missing values use `null`
2. **Explicit Returns**: All code paths must explicitly return (no implicit `undefined`)
3. **Strict Optional Properties**: Optional properties (`?`) accept only absence, not `undefined`
4. **No Type Assertions**: Minimize `as` casts; prefer proper types

### Migration Patterns

**Before (JavaScript):**

```javascript
function findTitle(id) {
    const title = cache.get(id);
    if (!title) return undefined;
    return title;
}

class Config {
    debug = true;
}
```

**After (TypeScript):**

```typescript
function findTitle(id: string): Title | null {
    const title = cache.get(id);
    if (!title) return null;
    return title;
}

class Config {
    debug: boolean = true;
}
```

### Handling Edge Cases

**Dynamic Imports:**

- Use type predicates or proper type guards
- Avoid `any` type

**Third-party Libraries:**

- Add to `types` array in tsconfig if types available
- Create ambient declarations for untyped libraries
- Use `// @ts-expect-error` sparingly for known issues

**DOM Types:**

- Use jsdom types provided by Vitest
- Cast DOM elements to specific types when needed

---

## Build Integration

**Type Check Script**:

```json
// package.json
"scripts": {
  "type-check": "tsc --noEmit",
  "build": "rollup -c && node scripts/package.js",
  "test": "vitest run tests/unit tests/ui"
}
```

Type checking runs as a separate script for local development and as an explicit step in CI workflows. CI runs `npm run type-check`, `npm run build`, and `npm run test` as independent steps. This ensures:

- Fast feedback during development (`npm run type-check`)
- Clear visibility: Type errors appear as a distinct CI failure
- Independent steps: Can run type-check without building or testing
- Separation of concerns: type-check ≠ build ≠ test

---

## Dependencies

### New Dev Dependencies

```json
{
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@rollup/plugin-typescript": "^11.1.0",
    "tslib": "^2.6.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
}
```

### Removed Dependencies

- `msw` (removed as part of pre-migration cleanup - was unused)

---

## Rollback Plan

### Per-File Rollback

Each migration is a separate commit. To rollback a specific file:

```bash
git checkout HEAD~1 -- src/path/to/file.ts tests/path/to/file.test.ts
```

### Full Rollback

A pre-migration branch (`pre-typescript-migration`) will be created before starting. To fully rollback:

```bash
git checkout pre-typescript-migration
```

This reverts all changes including:

- TypeScript configuration files
- Package.json updates
- All migrated source files

### Verification on Rollback

After any rollback:

- `npm run build` must succeed
- `npm test` must pass
- `npm run lint` must pass

---

## Migration Tracking

A tracking document at `docs/typescript-migration.md` contains:

- Phase-by-phase checklist of all files to migrate
- Current status of each file
- Migration instructions
- TypeScript configuration reference

This document is updated with each migration commit.

---

## Verification

### Build Verification

```bash
npm run build
```

- All three targets (userscript, chrome, firefox) must build successfully
- Bundle output must be functionally identical to JavaScript version

### Test Verification

```bash
npm test
```

- All unit tests must pass (100% pass rate)
- All UI tests must pass
- Type checking must pass for all `.ts` files

### Lint Verification

```bash
npm run lint
```

- All ESLint rules must pass for both JS and TS files

### Type Check Verification

```bash
npx tsc --noEmit
```

- No type errors in any `.ts` file
- Warnings are acceptable; errors are not

---

## Success Criteria

1. All source files in `src/` are TypeScript (`.ts`)
2. All test files in `tests/` are TypeScript (`.test.ts` or `.ts`)
3. All build, test, and lint commands pass
4. All distribution targets build successfully
5. Type checking passes with strict settings
6. No `undefined` values in codebase (use `null` instead)
7. All code paths have explicit returns

---

## Open Questions

1. ~~Should we add a `npm run type-check` script to package.json?~~ **Decided: Yes, added as separate script integrated into CI**
2. Do we need to update any GitHub Actions workflows for TypeScript?
3. ~~Should we add type checking to the CI pipeline?~~ **Decided: Yes, integrated into CI via the type-check script**

---

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Rollup TypeScript Plugin](https://github.com/rollup/plugins/tree/master/packages/typescript)
- [ESLint TypeScript Support](https://typescript-eslint.io/)
- [Migration Tracking Document](../typescript-migration.md)
