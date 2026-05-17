# Refactoring `registerMenuCommand` Design

## Overview

Currently, `PlatformAdapter` includes `registerMenuCommand`, which is a userscript-specific feature. This violates the interface segregation principle, forcing non-userscript adapters (like `WebExtensionAdapter`) to implement it as a no-op.

## Proposed Changes

1.  **`src/platform/adapter.js`**: Remove the abstract `registerMenuCommand` method from the `PlatformAdapter` base class.
2.  **`src/platform/webextension.js`**: Remove the `registerMenuCommand` no-op implementation from `WebExtensionAdapter`.
3.  **`src/platform/userscript.js`**: Maintain `registerMenuCommand` as a specific method of `UserscriptAdapter`.
4.  **Targets**: Update `src/targets/userscript/entry.js` imports or type definitions if needed (no code changes expected as `UserscriptAdapter` already exposes this).
5.  **Tests**: Update `tests/unit/platform/adapter.test.js` and `tests/unit/platform/webextension.test.js` to remove tests checking for the existence of `registerMenuCommand`.

## Impact

- **Positive**: Cleaner interface for `PlatformAdapter`. Removes noise from `WebExtensionAdapter`.
- **Negative**: None expected. The code correctly handles this as `entry.js` already explicitly instantiates `UserscriptAdapter`.
