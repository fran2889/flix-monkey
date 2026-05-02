# Platform Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (` - [x]`) syntax for tracking.

**Goal:** Implement the hybrid platform testing strategy as defined in the platform testing design.

**Architecture:** 
1. Shared contract test suite for structural validation.
2. Isolated behavioral unit tests for platform adapters.

**Tech Stack:** Vitest, MSW, Node.js

---

### Task 1: Create Contract Test Suite

**Files:**
- Create: `tests/unit/platform/contract.test.js`

 - [x] **Step 1: Write structural contract tests**

```javascript
import { describe, it, expect } from 'vitest';
import { PlatformAdapter } from '../../../src/platform/adapter.js';
import { UserscriptAdapter } from '../../../src/platform/userscript.js';
import { WebExtensionAdapter } from '../../../src/platform/webextension.js';

describe('PlatformAdapter Contract', () => {
    const adapters = [new UserscriptAdapter(), new WebExtensionAdapter()];

    adapters.forEach(adapter => {
        it(`${adapter.constructor.name} should implement storageGet`, async () => {
            expect(typeof adapter.storageGet).toBe('function');
        });

        it(`${adapter.constructor.name} should implement storageSet`, async () => {
            expect(typeof adapter.storageSet).toBe('function');
        });

        it(`${adapter.constructor.name} should implement httpFetch`, async () => {
            expect(typeof adapter.httpFetch).toBe('function');
        });

        it(`${adapter.constructor.name} should implement registerMenuCommand`, async () => {
            expect(typeof adapter.registerMenuCommand).toBe('function');
        });
    });
});
```

 - [x] **Step 2: Verify Contract Tests**

Run: `npx vitest tests/unit/platform/contract.test.js`
Expected: PASS

 - [x] **Step 3: Commit**

```bash
git add tests/unit/platform/contract.test.js
git commit -m "test: add platform contract test suite"
```

### Task 2: Implement UserscriptAdapter Unit Tests

**Files:**
- Create: `tests/unit/platform/userscript.test.js`

 - [x] **Step 1: Write behavioral tests for UserscriptAdapter**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserscriptAdapter } from '../../../src/platform/userscript.js';

describe('UserscriptAdapter', () => {
    let adapter;

    beforeEach(() => {
        vi.stubGlobal('GM_getValue', vi.fn());
        vi.stubGlobal('GM_setValue', vi.fn());
        vi.stubGlobal('GM_xmlhttpRequest', vi.fn());
        vi.stubGlobal('GM_registerMenuCommand', vi.fn());
        adapter = new UserscriptAdapter();
    });

    it('storageGet should call GM_getValue', async () => {
        await adapter.storageGet('key');
        expect(GM_getValue).toHaveBeenCalledWith('key');
    });

    it('storageSet should call GM_setValue', async () => {
        await adapter.storageSet('key', 'value');
        expect(GM_setValue).toHaveBeenCalledWith('key', 'value');
    });
});
```

 - [x] **Step 2: Verify Tests**

Run: `npx vitest tests/unit/platform/userscript.test.js`
Expected: PASS

 - [x] **Step 3: Commit**

```bash
git add tests/unit/platform/userscript.test.js
git commit -m "test: add userscript adapter unit tests"
```

### Task 3: Implement WebExtensionAdapter Unit Tests

**Files:**
- Create: `tests/unit/platform/webextension.test.js`

 - [x] **Step 1: Write behavioral tests for WebExtensionAdapter**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebExtensionAdapter } from '../../../src/platform/webextension.js';
import browser from 'webextension-polyfill';

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: { local: { get: vi.fn(), set: vi.fn() } },
        runtime: { sendMessage: vi.fn() }
    }
}));

describe('WebExtensionAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new WebExtensionAdapter();
    });

    it('storageGet should call storage.local.get', async () => {
        browser.storage.local.get.mockResolvedValue({ key: 'value' });
        const result = await adapter.storageGet('key');
        expect(browser.storage.local.get).toHaveBeenCalledWith('key');
        expect(result).toBe('value');
    });

    it('storageSet should call storage.local.set', async () => {
        await adapter.storageSet('key', 'value');
        expect(browser.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
    });
});
```

 - [x] **Step 2: Verify Tests**

Run: `npx vitest tests/unit/platform/webextension.test.js`
Expected: PASS

 - [x] **Step 3: Commit**

```bash
git add tests/unit/platform/webextension.test.js
git commit -m "test: add webextension adapter unit tests"
```
