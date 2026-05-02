# Testing Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Setup a robust testing infrastructure for the FlixMonkey project using Vitest, JSDOM, and MSW, mirroring the production code structure.

**Architecture:** Centralized `/tests` directory, 1:1 mirroring of `src/` modules, and clear separation between Unit (mocked), UI (JSDOM/fixtures), and Integration (real API) tests.

**Tech Stack:** Vitest, JSDOM, MSW.

---

### Task 1: Initialize Testing Dependencies

**Files:**
- Modify: `package.json`

 - [x] **Step 1: Install development dependencies**

Run: `npm install -D vitest jsdom msw @testing-library/dom @testing-library/jest-dom`

 - [x] **Step 2: Update `package.json` scripts**

Modify `package.json` to include test scripts:

```json
"scripts": {
  "test": "vitest",
  "test:unit": "vitest run tests/unit",
  "test:ui": "vitest run tests/ui",
  "test:integration": "vitest run tests/integration"
}
```

 - [x] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest and testing dependencies"
```

### Task 2: Configure Vitest and Setup

**Files:**
- Create: `vitest.config.js`
- Create: `tests/setup.js`
- Create: `tests/fixtures/.keep`

 - [x] **Step 1: Create Vitest configuration**

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    alias: {
      '@core': './src/core',
      '@platform': './src/platform',
    },
  },
});
```

 - [x] **Step 2: Create global setup file**

Create `tests/setup.js`:

```javascript
import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import '@testing-library/jest-dom/vitest';

export const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

 - [x] **Step 3: Initialize directories**

Run: `mkdir -p tests/unit tests/ui tests/integration tests/fixtures` && `touch tests/fixtures/.keep`

 - [x] **Step 4: Commit**

```bash
git add vitest.config.js tests/setup.js tests/fixtures/.keep
git commit -m "chore: initialize vitest configuration and directory structure"
```

### Task 3: Unit Test Example (Mirroring Structure)

**Files:**
- Create: `tests/unit/core/cache.test.js`

 - [x] **Step 1: Write initial unit test for `cache.js`**

Create `tests/unit/core/cache.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import Cache from '@core/cache.js';

describe('Cache', () => {
  it('should store and retrieve values', () => {
    const cache = new Cache();
    cache.set('test', 123);
    expect(cache.get('test')).toBe(123);
  });
});
```

 - [x] **Step 2: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS

 - [x] **Step 3: Commit**

```bash
git add tests/unit/core/cache.test.js
git commit -m "test: add unit test for cache module"
```
