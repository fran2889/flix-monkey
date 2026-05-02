# Core Module Unit Testing Design

## Goal
Implement comprehensive unit test coverage for all modules in `src/core/` to ensure reliability and maintainability, strictly following the project's testing architecture.

## Architecture & Principles
- **Alignment:** Mirror `src/core/` structure in `tests/unit/core/`.
- **Environment:** Use `vitest` with `jsdom` (as per architecture).
- **API Mocking:** Use `MSW` for mocking external API dependencies for all `unit` tests.
- **Independence:** Unit tests remain isolated from real network dependencies.

## Implementation Phases

### Phase 1: Foundation
- `constants.js`
- `config.js`
- `config-fields.js`

### Phase 2: API & Data (Mocked with MSW)
- `api-clients.js`
- `api-manager.js`
- `request-queue.js`

### Phase 3: Application Logic & UI Core
- `app.js`
- `overlay.js`
- `surfaces.js`
- `title.js`
- `disabled-clients.js`

## Process
1. Create individual test files in `tests/unit/core/` for all modules in a phase.
2. Use MSW to handle network-layer mocks for any modules interacting with external APIs.
3. Run `npm run test:unit` after the full test suite for a phase is written to verify.
4. Commit the tests for each phase with the message `test: add unit tests for <Phase Name> modules`.
