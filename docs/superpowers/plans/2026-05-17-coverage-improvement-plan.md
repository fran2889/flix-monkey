# Implementation Plan: Improving Code Coverage

This plan addresses identified coverage gaps in `flix-monkey`, prioritizing high-risk areas first. All tests must follow the project standard: one test file per production file, with consistent naming patterns.

## Phase 1: High-Risk Background Logic

_Focus: Stabilizing the extension lifecycle._

- [x] **Commit 1: Chrome Service Worker Tests**
    - Target: `src/targets/chrome/service-worker.js`
    - Test File: `tests/unit/targets/chrome/service-worker.test.js`
- [x] **Commit 2: Firefox Background Script Tests**
    - Target: `src/targets/firefox/background.js`
    - Test File: `tests/unit/targets/firefox/background.test.js`

## Phase 2: Core Surface & Configuration

_Focus: Resolving logic gaps in UI and configuration management._

- [x] **Commit 3: Surface Logic Expansion**
    - Target: `src/core/surfaces.js`
    - Test File: `tests/unit/core/surfaces.test.js` (Extend coverage for missing branches)
- [x] **Commit 4: Configuration Manager Integration Tests**
    - Target: `src/core/config-manager.js`
    - Test File: `tests/integration/config-manager.test.js` (Increase statement/branch coverage)

## Phase 3: Critical Utility & API Resilience

_Focus: Improving robustness of the core logic._

- [x] **Commit 5: API Client Edge-Case Testing**
    - Target: `src/core/api-clients.js`
    - Test File: `tests/unit/core/api-clients.test.js` (Specifically target uncovered branching)
- [x] **Commit 6: Overlay Interaction Testing**
    - Target: `src/core/overlay.js`
    - Test File: `tests/ui/overlay.ui.test.js` (Ensure interaction states are covered)
