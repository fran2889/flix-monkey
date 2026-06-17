# Remove Year Dependency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Completely remove 'year' as a search constraint and cache key component across the application to improve reliability against Netflix's changing DOM structure.

**Architecture:** Remove `domYear` from the data pipeline starting at `surfaces.js`, through `ApiClientManager`, and finally within each `ApiClient` implementation. Simplify cache keys to depend on `displayTitle` only.

**Tech Stack:** JavaScript (ES6 Modules), Vitest.

---

### Task 1: Refactor `Title` and `Cache`

**Files:**

- Modify: `src/core/cache.js`
- Test: `tests/unit/core/cache.test.js`

- [x] **Step 1: Simplify Cache key generation**
      Modify `src/core/cache.js` to remove `year` usage in key generation. The key should rely solely on `displayTitle`.

- [x] **Step 2: Update cache tests**
      Update `tests/unit/core/cache.test.js` to reflect that `year` is no longer required for `read`/`write` operations.

- [x] **Step 3: Commit**

```bash
git add src/core/cache.js tests/unit/core/cache.test.js
git commit -m "refactor: simplify cache key to use title only"
```

### Task 2: Refactor `ApiClientManager`

**Files:**

- Modify: `src/core/api-manager.js`
- Test: `tests/unit/core/api-manager.test.js`

- [x] **Step 1: Update `getData` signature**
      Remove `domYear` from `getData(displayTitle, domYear)` and pass only `displayTitle` to `this.#cache.read`, `this.#cache.write`, and `this.#client.fetch`.

- [x] **Step 2: Update `api-manager` tests**
      Update `tests/unit/core/api-manager.test.js` to accommodate the change in the `getData` signature.

- [x] **Step 3: Commit**

```bash
git add src/core/api-manager.js tests/unit/core/api-manager.test.js
git commit -m "refactor: remove domYear from ApiClientManager.getData"
```

### Task 3: Refactor API Clients

**Files:**

- Modify: `src/core/api-clients.js`
- Test: `tests/unit/core/api-clients.test.js`

- [x] **Step 1: Simplify `BaseApiClient` and implementations**
      Update `fetch`, `search`, and `getDetails` methods across all clients (`XmdbApiClient`, `OmdbApiClient`, `ImdbApiDevClient`) to remove `domYear` (or `year`) arguments.

- [x] **Step 2: Update API client tests**
      Update `tests/unit/core/api-clients.test.js` to remove `year` arguments from `search` and `fetch` calls.

- [x] **Step 3: Commit**

```bash
git add src/core/api-clients.js tests/unit/core/api-clients.test.js
git commit -m "refactor: remove year parameter from API client search methods"
```

### Task 4: Refactor UI Surfaces

**Files:**

- Modify: `src/core/surfaces.js`

- [x] **Step 1: Remove year parsing logic**
      Remove the DOM year-parsing code in `src/core/surfaces.js`.

- [x] **Step 2: Update calls to `ApiClientManager`**
      Ensure that calls to `ApiClientManager.getData` in `surfaces.js` (or wherever used) only pass `displayTitle`.

- [x] **Step 3: Commit**

```bash
git add src/core/surfaces.js
git commit -m "refactor: stop parsing year from Netflix DOM"
```
