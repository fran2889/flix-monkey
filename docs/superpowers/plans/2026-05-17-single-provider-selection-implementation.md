# Single Provider Selection Implementation Plan

**Goal:** Implement single-provider selection for ratings, defaulting to IMDb API.

**Architecture:** Update `ApiClientManager` to hold one client based on `apiClient` config. Remove fallback logic.

---

### Task 1: Update Configuration and Manager
- Modify `src/core/config-fields.js`: Change `apiClients` to `apiClient` as a dropdown.
- Modify `src/core/api-manager.js`: Change `#clients` (array) to `#client` (instance).
- Modify `tests/unit/core/api-manager.test.js`: Update tests to reflect single client behavior.
- Modify `tests/unit/core/config-manager.test.js`: Verify default provider is `imdbapi`.
