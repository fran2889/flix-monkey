# Improvement Plan: Architectural Refinements for FlixMonkey

## Objective
Enhance the robustness, testability, and resilience of the `flix-monkey` codebase by formalizing error handling, decoupling configuration, and improving API orchestration.

## Key Files & Context
- `src/core/config.js` (Current configuration management)
- `src/core/api-manager.js` (Orchestration logic)
- `src/core/api-clients.js` (Client base and implementations)
- New file: `src/core/logger.js` (Centralized logging/error reporting)
- New file: `src/core/config-manager.js` (Dependency-injected configuration)

## Implementation Steps

### Phase 1: Logging and Error Reporting
- **Task:** Create `src/core/logger.js` to centralize `console` operations.
- **Task:** Update `BaseApiClient` and `FlixMonkeyApp` to use the new logger, removing direct `console` calls from domain logic.
- **Verification:** Ensure log consistency across all modules.

### Phase 2: Decoupled Configuration
- **Task:** Implement `ConfigManager` to encapsulate `CONFIG` access.
- **Task:** Update `ApiClientManager` and API clients to accept `ConfigManager` as a constructor dependency.
- **Verification:** Unit test `ConfigManager` and verify no regressions in API initialization.

### Phase 3: API Resilience
- **Task:** Introduce a health-check/status interface to `BaseApiClient`.
- **Task:** Update `ApiClientManager` to preferentially use healthy clients and implement a basic retry or fall-through mechanism for degraded services.
- **Verification:** Simulate API failure scenarios in unit tests.

## Verification & Testing
- Add unit tests for the new `ConfigManager`.
- Update existing `api-manager.test.js` to mock the new dependencies and verify correct behavior.
- Ensure all CI tests pass.
