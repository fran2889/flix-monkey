# Targets Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [ ]`) syntax for tracking.

**Goal:** Implement a testing framework for `src/targets/` entry points using platform-specific mocks.

**Architecture:** Create mock sets in `tests/mocks/` for Chrome, Userscript, and WebExtension APIs, and use them to test initialization and contract satisfaction in `tests/unit/targets/`.

**Tech Stack:** Vitest, JSDOM.

---

### Task 1: Create Platform Mocks

**Files:**

- Create: `tests/mocks/chrome.js`
- Create: `tests/mocks/userscript.js`
- Create: `tests/mocks/webextension.js`

- [x] **Step 1: Create Chrome API mock**

```javascript
// tests/mocks/chrome.js
export const chrome = {
    runtime: {
        getManifest: vi.fn(),
        onInstalled: { addListener: vi.fn() },
    },
};
```

- [x] **Step 2: Create Userscript API mock**

```javascript
// tests/mocks/userscript.js
export const GM_info = {};
export const GM_xmlhttpRequest = vi.fn();
```

- [x] **Step 3: Create WebExtension API mock**

```javascript
// tests/mocks/webextension.js
export const browser = {
    runtime: {
        getManifest: vi.fn(),
    },
};
```

- [x] **Step 4: Commit**

```bash
git add tests/mocks/chrome.js tests/mocks/userscript.js tests/mocks/webextension.js
git commit -m "test: add platform-specific mocks"
```

### Task 2: Implement Userscript Entry Point Test

**Files:**

- Modify: `tests/unit/platform/userscript.test.js` (or create `tests/unit/targets/userscript.test.js`)
- Test: `tests/unit/targets/userscript.test.js`

- [x] **Step 1: Create the failing test**

```javascript
// tests/unit/targets/userscript.test.js
import { vi, describe, it, expect } from 'vitest';
import '../../mocks/userscript.js';

describe('Userscript Entry Point', () => {
    it('should initialize the app', () => {
        // Assuming entry.js exposes an init function
        const { init } = require('../../../src/targets/userscript/entry.js');
        init();
        expect(init).toBeDefined();
    });
});
```

- [x] **Step 2: Run test to verify it fails**
      Run: `npx vitest run tests/unit/targets/userscript.test.js`
      Expected: FAIL (module not found or init not defined)

- [x] **Step 3: Implement minimal entry point** (if not already existing)

- [x] **Step 4: Run test to verify it passes**

- [x] **Step 5: Commit**

```bash
git add tests/unit/targets/userscript.test.js
git commit -m "test: add userscript entry point tests"
```

### Task 3: Implement WebExtension Entry Point Test

**Files:**

- Test: `tests/unit/targets/extension.test.js`

- [x] **Step 1: Create the test**

```javascript
// tests/unit/targets/extension.test.js
import { vi, describe, it, expect } from 'vitest';
import '../../mocks/webextension.js';

describe('WebExtension Entry Point', () => {
    it('should verify manifest structure', () => {
        const manifest = require('../../../src/targets/chrome/manifest.json');
        expect(manifest.manifest_version).toBe(3);
    });
});
```

- [x] **Step 2: Run test**
      Run: `npx vitest run tests/unit/targets/extension.test.js`

- [x] **Step 3: Commit**

```bash
git add tests/unit/targets/extension.test.js
git commit -m "test: add webextension manifest tests"
```
