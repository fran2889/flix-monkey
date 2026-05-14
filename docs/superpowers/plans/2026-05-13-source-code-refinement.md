# Source Code Refinement Plan

## Overview
Address critical architectural leaks, global state issues, and technical debt in the source code.

## Tasks
1. **Double Cache Read**: Refactor `src/core/app.js:#decorateContainer` to avoid redundant `#cache.read()` calls.
2. **Global Namespace Protection**:
    - Remove `window.fmApi` leak or guard it behind a `process.env.NODE_ENV !== 'production'` check.
    - Remove `history._fmPatched` global mutation in favor of a module-level boolean.
3. **Configuration Migration**: Complete the migration from `CONFIG` singleton to `ConfigManager` instance usage; remove `src/core/config.js` if it's no longer used.
4. **Telemetry/Logger**: Refactor logger usage to use `info()` for non-warning messages and correct `warn()` usage.
5. **Misc Minor**:
    - Guard `injectStyles()` in `src/core/overlay.js`.
    - Consolidate platform-specific constants (e.g., `USER_AGENTS`) into platform files.
    - Extract client mapping in `api-manager.js` to a factory function.

## Verification
- Manual verification of Netflix title decorations to ensure speed/no duplicate network requests.
- Verify no global leaks in `window` or `history` objects.
- Run all unit tests to ensure no regressions in config or decoration logic.
