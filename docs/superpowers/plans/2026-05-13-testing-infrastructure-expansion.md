# Testing Infrastructure Expansion Plan

## Overview
Significantly expand test coverage, particularly for critical logic, and enforce quality through thresholds.

## Tasks
1. **Title Class**: Expand `tests/unit/core/title.test.js` to cover rating normalization, `isBetterThan` logic, and `fromJSON` serialization.
2. **Coverage Enforcement**: Add `thresholds` to `vitest.config.js`.
3. **Concurrency/Critical Path**:
    - Implement `inFlight` deduplication test in `app.test.js`.
    - Implement SPA navigation test for `history` patching.
4. **Maintenance**:
    - Fix dead imports in `tests/unit/core/cache.test.js`.
    - Consolidate redundant mocks in `tests/mocks/`.

## Verification
- Run `npm run test:coverage` and confirm coverage meets the new thresholds.
- Verify title unit tests cover all logic branches.
- Verify concurrency and navigation tests pass.
