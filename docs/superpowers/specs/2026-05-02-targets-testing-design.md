# Testing Design: Targets and Platform-Specific Mocking

## 1. Overview
The goal is to implement robust testing for the `src/targets/` layer, ensuring contract validation for platform-specific entry points and correct behavioral initialization of core application logic.

## 2. Mocking Strategy: Platform-Specific Mocks
We will implement dedicated mock sets in `tests/mocks/` to simulate platform-specific environments (Chrome Extension, Firefox Extension, Userscript). This avoids over-abstracting the interfaces and ensures tests accurately reflect the environment in which the targets run.

- **Mock Registry:**
  - `tests/mocks/chrome.js`: Exposes `chrome.*` API simulations.
  - `tests/mocks/userscript.js`: Exposes `GM_*` API simulations.
  - `tests/mocks/webextension.js`: Shared mocks for generic web extension APIs (e.g., `browser.*`).

## 3. Testing Scope
- **Contract Tests:** Validate that each platform's entry point satisfies its specific environment requirements (e.g., manifest schema, global variable existence).
- **Initialization Tests:** Verify that each target correctly invokes the `src/core/app.js` entry point with the appropriate configurations and environment context.

## 4. Implementation Details
- **Environment Setup:** Use `tests/setup.js` to manage global mock injection using `vi.stubGlobal`.
- **Test Organization:** Tests will reside in `tests/unit/targets/` (e.g., `tests/unit/targets/userscript.test.js`), mirroring the structure of `src/targets/`.
- **Isolation:** Use `beforeEach` in individual test files to reset mock states and ensure test independence.

## 5. Risks & Mitigation
- **Mock Drift:** If platform APIs change, mocks must be updated. *Mitigation:* Document API assumptions in the mock files.
- **Complexity:** Managing multiple mock sets can increase maintenance. *Mitigation:* Keep mocks strictly focused on the specific APIs consumed by the `targets/` entry points.
