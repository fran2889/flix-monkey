# Core Module Unit Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [ ]`) syntax for tracking.

**Goal:** Implement comprehensive unit test coverage for all core modules, strictly following the project's testing architecture and using MSW for API mocking.

**Architecture:** 1:1 test-to-source mapping (`tests/unit/core/<module>.test.js` tests `src/core/<module>.js`).

**Tech Stack:** Vitest, JSDOM, MSW.

---

### Task 1: Phase 1 - Foundation Modules

**Files:**

- Create: `tests/unit/core/constants.test.js`
- Create: `tests/unit/core/config.test.js`
- Create: `tests/unit/core/config-fields.test.js`

- [x] **Step 1: Write tests for `constants.js`**

```javascript
import { describe, it, expect } from 'vitest';
import * as constants from '@core/constants.js';

describe('constants', () => {
    it('should have required constants defined', () => {
        expect(constants).toBeDefined();
        // Add specific checks based on actual constants
    });
});
```

- [x] **Step 2: Write tests for `config.js`**

```javascript
import { describe, it, expect } from 'vitest';
import Config from '@core/config.js';

describe('Config', () => {
    it('should initialize with defaults', () => {
        const config = new Config();
        expect(config).toBeDefined();
    });
});
```

- [x] **Step 3: Write tests for `config-fields.js`**

```javascript
import { describe, it, expect } from 'vitest';
import configFields from '@core/config-fields.js';

describe('configFields', () => {
    it('should be defined', () => {
        expect(configFields).toBeDefined();
    });
});
```

- [x] **Step 4: Run tests and verify**

Run: `npm run test:unit`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add tests/unit/core/constants.test.js tests/unit/core/config.test.js tests/unit/core/config-fields.test.js
git commit -m "test: add unit tests for Foundation modules"
```

---

### Task 2: Phase 2 - API & Data Modules (MSW)

**Files:**

- Create: `tests/unit/core/api-clients.test.js`
- Create: `tests/unit/core/api-manager.test.js`
- Create: `tests/unit/core/request-queue.test.js`

- [x] **Step 1: Write tests for `api-clients.js` with MSW**

```javascript
import { describe, it, expect } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import ApiClient from '@core/api-clients.js';

const server = setupServer(http.get('*/api/data', () => HttpResponse.json({ success: true })));

describe('ApiClient', () => {
    it('should fetch data successfully', async () => {
        const client = new ApiClient();
        const data = await client.fetchData();
        expect(data.success).toBe(true);
    });
});
```

- [x] **Step 2: Write tests for `api-manager.js` with MSW**

_(Similar pattern to step 1, adapted for ApiManager)_

- [x] **Step 3: Write tests for `request-queue.js`**

_(Focus on queueing logic and MSW handling)_

- [x] **Step 4: Run tests and verify**

Run: `npm run test:unit`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add tests/unit/core/api-clients.test.js tests/unit/core/api-manager.test.js tests/unit/core/request-queue.test.js
git commit -m "test: add unit tests for API & Data modules"
```

---

### Task 3: Phase 3 - Application Logic & UI Core

**Files:**

- Create: `tests/unit/core/app.test.js`
- Create: `tests/unit/core/overlay.test.js`
- Create: `tests/unit/core/surfaces.test.js`
- Create: `tests/unit/core/title.test.js`
- Create: `tests/unit/core/disabled-clients.test.js`

- [x] **Step 1: Write tests for `app.js`**

_(Focus on state and orchestration)_

- [x] **Step 2: Write tests for `overlay.js`, `surfaces.js`, `title.js`, `disabled-clients.js`**

_(Focus on UI-related core logic and DOM interactions)_

- [x] **Step 3: Run tests and verify**

Run: `npm run test:unit`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add tests/unit/core/app.test.js tests/unit/core/overlay.test.js tests/unit/core/surfaces.test.js tests/unit/core/title.test.js tests/unit/core/disabled-clients.test.js
git commit -m "test: add unit tests for Application Logic & UI Core modules"
```
