# Testing Architecture Design - FlixMonkey

## 1. Objectives
- Enable high-confidence development through a robust, layered testing strategy.
- Achieve comprehensive unit test coverage for core business logic.
- Validate UI integration using static, high-fidelity Netflix HTML stand-ins.
- Ensure API reliability through both mocked (unit/integration) and real-world (integration) testing.

## 2. Technology Stack
- **Test Runner:** [Vitest](https://vitest.dev/) (Chosen for speed, native ESM support, and compatibility with Rollup configurations).
- **Environment:** [JSDOM](https://github.com/jsdom/jsdom) (To simulate browser DOM in a fast Node.js environment).
- **API Mocking:** [MSW (Mock Service Worker)](https://mswjs.io/) (For consistent API response mocking).

## 3. Directory Structure
```text
/tests
  /unit          # Unit tests (1:1 mirror of src/core, src/platform)
  /integration   # Real API client tests (requires real credentials)
  /ui            # UI tests against /fixtures (simulates browser interaction)
  /fixtures      # Static Netflix HTML stand-ins
  /setup.js      # Global Vitest configuration (MSW setup, JSDOM)
```

## 4. Testing Strategy
*   **Unit Tests (`tests/unit/**/*.test.js`)**: Isolated testing for core logic. Mocks external API dependencies using MSW. Uses a 1:1 directory mirroring strategy (e.g., `tests/unit/core/cache.test.js` tests `src/core/cache.js`).
*   **UI Integration Tests (`tests/ui/**/*.test.js`)**: Focuses on DOM manipulation, rendering, and event handling. Loads local HTML fixtures via JSDOM.
*   **Integration Tests (`tests/integration/**/*.test.js`)**: Validates real network connectivity and API integration. These are excluded from standard CI runs by default and must be explicitly triggered or tagged (e.g., via `@integration` tag or separate test suite).

## 5. Configuration & Setup
- **Vitest**: Configured to resolve aliases matching `rollup.config.js`.
- **Environment Variables**: Integration tests will utilize local `.env` files (ignored in git) for API credentials (e.g., `API_KEY`).
- **Global Setup**: `tests/setup.js` will handle shared configurations, such as global MSW worker initialization and JSDOM global injection.
