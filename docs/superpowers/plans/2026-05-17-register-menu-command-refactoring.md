# `registerMenuCommand` Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `registerMenuCommand` from `PlatformAdapter` and `WebExtensionAdapter` to improve architectural cleanliness.

**Architecture:** Remove `registerMenuCommand` from the base class `PlatformAdapter`. Consumers in `src/targets/userscript/entry.js` already explicitly use `UserscriptAdapter`, which will maintain the implementation.

**Tech Stack:** JavaScript, Vitest.

---

### Task 1: Remove `registerMenuCommand` from `PlatformAdapter`

**Files:**

- Modify: `src/platform/adapter.js`

- [ ] **Step 1: Remove abstract method**

```javascript
// src/platform/adapter.js
// Remove this:
    /** @abstract */
    registerMenuCommand(_label, _fn) {
        throw new FlixMonkeyError('PlatformAdapter: registerMenuCommand() must be implemented by subclass');
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/platform/adapter.js
git commit -m "refactor: remove registerMenuCommand from PlatformAdapter"
```

### Task 2: Remove `registerMenuCommand` from `WebExtensionAdapter`

**Files:**

- Modify: `src/platform/webextension.js`

- [ ] **Step 1: Remove no-op implementation**

```javascript
// src/platform/webextension.js
// Remove this:
    registerMenuCommand(_label, _fn) {
        // No-op for web extensions
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/platform/webextension.js
git commit -m "refactor: remove registerMenuCommand from WebExtensionAdapter"
```

### Task 3: Update and Clean Up Tests

**Files:**

- Modify: `tests/unit/platform/adapter.test.js`
- Modify: `tests/unit/platform/webextension.test.js`

- [ ] **Step 1: Remove tests for `registerMenuCommand`**

In `tests/unit/platform/adapter.test.js`: remove the test block verifying `registerMenuCommand` throws an error.

In `tests/unit/platform/webextension.test.js`: remove the test block verifying `registerMenuCommand` is a function/no-op.

- [ ] **Step 2: Run remaining tests**

Run: `npm test`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/platform/adapter.test.js tests/unit/platform/webextension.test.js
git commit -m "test: remove registerMenuCommand tests from platform adapters"
```
