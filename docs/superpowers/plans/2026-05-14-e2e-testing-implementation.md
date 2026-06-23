# E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified E2E testing infrastructure using Playwright and the Adapter pattern to test Greasemonkey/Extension logic across Netflix surfaces.

**Architecture:** Playwright connects to a local browser instance via CDP. A `TestAdapter` interface provides platform-agnostic methods (`navigate`, `click`, `evaluate`) and surface-specific interaction wrappers.

**Tech Stack:** Playwright, Node.js.

---

### Task 1: Initialize Playwright Infrastructure

**Files:**

- Create: `tests/e2e/playwright.config.js`
- Modify: `package.json`

- [x] **Step 1: Install Playwright**
      Run: `npm install -D @playwright/test`

- [x] **Step 2: Create basic config**

```javascript
// tests/e2e/playwright.config.js
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './',
    use: {
        connectOverCDP: 'http://localhost:9222',
    },
});
```

- [x] **Step 3: Add test script to package.json**
      Add: `"test:e2e": "playwright test tests/e2e"`

---

### Task 2: Define TestAdapter Interface

**Files:**

- Create: `tests/e2e/adapter.js`

- [x] **Step 1: Implement base interface (stubbed)**

```javascript
// tests/e2e/adapter.js
class TestAdapter {
    constructor(page) {
        this.page = page;
    }
    async navigate(url) {
        await this.page.goto(url);
    }
    async waitForElement(selector) {
        await this.page.waitForSelector(selector);
    }
    async click(selector) {
        await this.page.click(selector);
    }
    async evaluate(func) {
        return await this.page.evaluate(func);
    }
    async triggerExtensionCommand(command) {
        throw new Error('Not implemented');
    }
    async setExtensionSettings(settings) {
        throw new Error('Not implemented');
    }
}
module.exports = TestAdapter;
```

---

### Task 3: Implement Userscript Adapter

**Files:**

- Create: `tests/e2e/adapters/userscript-adapter.js`

- [x] **Step 1: Implement platform-specific logic**

```javascript
// tests/e2e/adapters/userscript-adapter.js
const TestAdapter = require('../adapter');
class UserscriptAdapter extends TestAdapter {
    async triggerExtensionCommand(command) {
        /* Logic to trigger GM command */
    }
    async setExtensionSettings(settings) {
        await this.page.evaluate(s => localStorage.setItem('flix-config', JSON.stringify(s)), settings);
    }
}
module.exports = UserscriptAdapter;
```

---

### Task 4: Create Surface-Aware Wrappers

**Files:**

- Create: `tests/e2e/surfaces/base-surface.js`
- Create: `tests/e2e/surfaces/browse-surface.js`

- [x] **Step 1: Create surface definitions**

```javascript
// tests/e2e/surfaces/browse-surface.js
class BrowseSurface {
    constructor(adapter) {
        this.adapter = adapter;
    }
    async clickPlay() {
        await this.adapter.click('.play-button');
    }
}
module.exports = BrowseSurface;
```

---

### Task 5: Migrate First UI Test

**Files:**

- Modify: `tests/e2e/browse.ui.test.js`

- [x] **Step 1: Rewrite test using Adapter**

```javascript
const { test, expect } = require('@playwright/test');
const UserscriptAdapter = require('./adapters/userscript-adapter');
const BrowseSurface = require('./surfaces/browse-surface');

test('should play video in browse view', async ({ page }) => {
    const adapter = new UserscriptAdapter(page);
    const browse = new BrowseSurface(adapter);
    await adapter.navigate('https://www.netflix.com/browse');
    await browse.clickPlay();
    // ... assertions
});
```

---

### Task 6: Implement Options UI Suite

**Files:**

- Create: `tests/e2e/options.ui.test.js`

- [x] **Step 1: Create SettingsUIAdapter and test**
      (Logic to target `options.html` and verify config persistence).
