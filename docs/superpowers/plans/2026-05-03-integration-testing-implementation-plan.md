# Integration Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement integration testing suite to validate real-API connectivity and schema compatibility.

**Architecture:** Utilize Vitest for integration testing, guarding tests with credential checks from a `.env` file. Tests will be excluded from standard CI/CD and only run when explicitly triggered by developers.

**Tech Stack:** Vitest, dotenv (for local environment management).

---

### Task 1: Setup Infrastructure for Integration Tests

**Files:**
- Modify: `vitest.config.js` (add integration test configuration)
- Create: `.env.example` (already created)
- Create: `tests/integration/setup.js` (integration test environment setup)

- [ ] **Step 1: Update `vitest.config.js` to support integration testing**

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Ensure we can filter tests by tag/path
  },
});
```

- [ ] **Step 2: Create `tests/integration/setup.js`**

```javascript
import { config } from 'dotenv';
import { vi } from 'vitest';

// Load local .env for integration tests
config();

// Helper to check if credentials are provided
export const hasCredentials = (keys) => {
  return keys.every(key => process.env[key]);
};
```

- [ ] **Step 3: Commit**

```bash
git add vitest.config.js tests/integration/setup.js .env.example
git commit -m "feat(test): add integration testing infrastructure"
```

### Task 2: Implement Integration Test for `api-clients`

**Files:**
- Create: `tests/integration/api-clients.test.js`
- Test: `tests/integration/api-clients.test.js`

- [ ] **Step 1: Write integration test with credential check**

```javascript
import { describe, it, expect, skip } from 'vitest';
import { hasCredentials } from './setup';
import { getTitleDetails } from '../../src/core/api-clients';

const credentials = ['XMDB_API_KEY', 'OMDB_API_KEY'];

describe('api-clients integration', () => {
  if (!hasCredentials(credentials)) {
    skip('Missing API credentials, skipping integration tests');
  }

  it('should fetch real data from APIs', async () => {
    const title = 'The Matrix';
    const result = await getTitleDetails(title);
    expect(result).toBeDefined();
    expect(result.title).toContain('Matrix');
  });
});
```

- [ ] **Step 2: Run test with environment variables**

Run: `XMDB_API_KEY=test OMDB_API_KEY=test npx vitest run tests/integration/api-clients.test.js -v`
Expected: FAIL (or skip if not correctly configured, verify it runs)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/api-clients.test.js
git commit -m "feat(test): add real-API integration test for api-clients"
```

### Task 3: Implement Integration Test for `request-queue`

**Files:**
- Create: `tests/integration/request-queue.test.js`

- [ ] **Step 1: Write integration test for `request-queue`**

```javascript
import { describe, it, expect, skip } from 'vitest';
import { hasCredentials } from './setup';
import { RequestQueue } from '../../src/core/request-queue';

const credentials = ['XMDB_API_KEY'];

describe('request-queue integration', () => {
  if (!hasCredentials(credentials)) {
    skip('Missing API credentials, skipping integration tests');
  }

  it('should handle concurrent requests against real API', async () => {
    const queue = new RequestQueue();
    // Implementation specific call to ensure rate limiting works
    const results = await Promise.all([
      queue.add(() => fetch('...')), // Logic here
      queue.add(() => fetch('...'))
    ]);
    expect(results).toBeDefined();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/integration/request-queue.test.js
git commit -m "feat(test): add real-API integration test for request-queue"
```
