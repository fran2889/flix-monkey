# Platform Adapter Testing Design

## Goal
Establish a robust, hybrid testing strategy for the `src/platform/` layer to ensure cross-platform compatibility and structural adherence to the `PlatformAdapter` contract.

## Architecture & Principles
- **Inheritance-Based Validation:** Leverage the existing `PlatformAdapter` base class to enforce structural contracts.
- **Hybrid Testing Approach:**
    - **Contract Test Suite:** Shared tests that verify all adapters adhere to the required interface (structural).
    - **Implementation-Specific Unit Tests:** Isolated tests for platform-specific behavior (e.g., environment mocks).
- **Environment:** `vitest` with `jsdom` (or node environment, as appropriate).

## Implementation Strategy

### 1. Contract Test Suite (`tests/unit/platform/contract.test.js`)
- Test each adapter class (`UserscriptAdapter`, `WebExtensionAdapter`) against the `PlatformAdapter` contract.
- Verify presence of all abstract methods (ensure they are implemented and not throwing 'Not implemented').

### 2. Implementation-Specific Unit Tests
- `tests/unit/platform/userscript.test.js`: Mock `GM_*` globals.
- `tests/unit/platform/webextension.test.js`: Mock `webextension-polyfill`.

## Process
1. Define the shared contract test suite.
2. Implement individual platform-specific test files.
3. Integrate into `npm run test:unit`.
