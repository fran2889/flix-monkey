# Real-API Integration Testing Design - FlixMonkey

## 1. Objectives
- Validate actual network connectivity and API stability with real providers (XMDB, OMDB, IMDb API Dev).
- Ensure schema compatibility between live API responses and our `Title` domain model.
- Test client resilience against live rate-limiting and service fluctuations.

## 2. Technology Stack
- **Test Runner:** Vitest.
- **Environment:** Node.js, utilizing `process.env` for sensitive API credentials.
- **Data Handling:** Real network requests via the existing adapter infrastructure.

## 3. Directory Structure
```text
/tests
  /integration
    /api-clients.test.js  # Real network tests for all clients
    /request-queue.test.js # Optional: Test actual rate limit enforcement against live APIs (use with caution)
```

## 4. Authentication & Security
- **Local Config:** Users will provide credentials via a local `.env` file.
- **Safety:** `.env` is explicitly included in `.gitignore`.
- **Documentation:** A `.env.example` file will be maintained at the project root for developers to populate.
- **Credential Check:** Each test file will include a guard clause to check for the presence of keys, skipping tests gracefully if not configured.

## 5. Execution Strategy
- **Tagging:** Integration tests will be marked with a custom `@integration` tag or conditional `runIf` block.
- **CI/CD:** Standard CI runs will exclude these tests using Vitest's test filtering (`--exclude integration/`).
- **Stability:** Use a fixed set of stable, well-known movie titles (e.g., "The Matrix", "Inception") that have historically stable metadata for reproducible testing.

## 6. Error Handling
- Gracefully log and skip tests when APIs return 4xx/5xx or when keys are missing.
- Ensure that network failures during integration tests do not crash the entire test process.
