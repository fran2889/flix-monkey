# Consolidated Configuration UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the settings UI for both extension and userscript targets into a single shared engine with validation support.

**Architecture:** A shared `SettingsUI` class in `src/core/ui` will handle rendering and validation logic, consuming metadata from `config-fields.js`. It will interact with the platform via the `PlatformAdapter`. Userscripts will wrap this UI in a custom `Modal` component.

**Tech Stack:** Vanilla JavaScript (ES6+), CSS, Platform-specific storage APIs (Chrome/WebExt Storage, GM_getValue/Set).

---

### Task 1: Update Configuration Metadata & Platform Adapter

**Files:**

- Modify: `src/core/config-fields.js`
- Modify: `src/platform/adapter.js`
- Modify: `src/platform/userscript.js`
- Modify: `src/platform/webextension.js`

- [x] **Step 1: Add validation functions to `CONFIG_FIELDS`**

Modify `src/core/config-fields.js` to add `validate` functions to relevant fields (API keys, threshold, cache TTLs).

```javascript
// Example modification for fadeRatingThreshold
{
    key: 'fadeRatingThreshold',
    label: 'Fade Threshold (IMDb)',
    type: 'text',
    default: '6.0',
    validate: (val) => {
        const n = parseFloat(val);
        return (isNaN(n) || n < 0 || n > 10) ? 'Value must be between 0.0 and 10.0' : null;
    },
    title: 'Titles with IMDb rating below this value will be faded.',
},
```

- [x] **Step 2: Add abstract storage methods to `PlatformAdapter`**

Modify `src/platform/adapter.js` to add `storageGetAll` and `storageSetMany`.

```javascript
/** @abstract */
async storageGetAll() {
    throw new FlixMonkeyError('PlatformAdapter: storageGetAll() must be implemented by subclass');
}

/** @abstract */
async storageSetMany(_values) {
    throw new FlixMonkeyError('PlatformAdapter: storageSetMany() must be implemented by subclass');
}
```

- [x] **Step 3: Implement storage methods in `UserscriptAdapter`**

Modify `src/platform/userscript.js`.

```javascript
async storageGetAll() {
    const keys = GM_listValues();
    const result = {};
    keys.forEach(k => result[k] = GM_getValue(k));
    return result;
}

async storageSetMany(values) {
    for (const [k, v] of Object.entries(values)) {
        GM_setValue(k, v);
    }
}
```

- [x] **Step 4: Implement storage methods in `WebExtensionAdapter`**

Modify `src/platform/webextension.js`.

```javascript
async storageGetAll() {
    return await browser.storage.local.get(null);
}

async storageSetMany(values) {
    await browser.storage.local.set(values);
}
```

- [x] **Step 5: Commit changes**

```bash
git add src/core/config-fields.js src/platform/adapter.js src/platform/userscript.js src/platform/webextension.js
git commit -m "refactor: prepare config fields and adapters for unified UI"
```

---

### Task 2: Implement Shared UI Engine (Rendering)

**Files:**

- Create: `src/core/ui/styles.js`
- Create: `src/core/ui/settings-ui.js`
- Create: `tests/unit/core/ui/settings-ui.test.js`

- [x] **Step 1: Create shared CSS**

Create `src/core/ui/styles.js` containing the "Netflix-dark" theme as a template literal.

- [x] **Step 2: Write failing test for basic rendering**

Create `tests/unit/core/ui/settings-ui.test.js`.

```javascript
import { SettingsUI } from '../../../src/core/ui/settings-ui.js';
import { expect, it, describe, vi } from 'vitest';

describe('SettingsUI Rendering', () => {
    it('should render all fields from config-fields', async () => {
        const container = document.createElement('div');
        const adapter = { storageGetAll: vi.fn().mockResolvedValue({}) };
        const ui = new SettingsUI(adapter);
        await ui.render(container);
        expect(container.querySelectorAll('.field').length).toBeGreaterThan(0);
    });
});
```

- [x] **Step 3: Implement basic `SettingsUI.render`**

Create `src/core/ui/settings-ui.js`. Implement the `render` method that builds labels and inputs based on `CONFIG_FIELDS`.

- [x] **Step 4: Run tests and verify PASS**

- [x] **Step 5: Commit**

```bash
git add src/core/ui/styles.js src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
git commit -m "feat(core): implement basic settings UI rendering"
```

---

### Task 3: Implement Validation and Saving in `SettingsUI`

**Files:**

- Modify: `src/core/ui/settings-ui.js`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

- [x] **Step 1: Write failing test for validation**

Add a test case to `tests/unit/core/ui/settings-ui.test.js` that mock-fails a `validate` function and checks for an error message in the DOM.

- [x] **Step 2: Implement validation logic in `save()`**

Update `SettingsUI` to iterate over inputs, call `validate()`, and stop/show errors if any fail.

- [x] **Step 3: Implement `storageSetMany` call on success**

- [x] **Step 4: Run tests and verify PASS**

- [x] **Step 5: Commit**

```bash
git add src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
git commit -m "feat(core): add validation and saving to SettingsUI"
```

---

### Task 4: Implement Custom Modal for Userscripts

**Files:**

- Create: `src/core/ui/modal.js`
- Create: `tests/unit/core/ui/modal.test.js`

- [x] **Step 1: Write failing test for Modal**

Create `tests/unit/core/ui/modal.test.js`. Verify it creates an overlay and can be closed.

- [x] **Step 2: Implement `Modal` class**

Create `src/core/ui/modal.js`. It should create a fixed overlay with a title and a close button. It should have a `getContentContainer()` method.

- [x] **Step 3: Run tests and verify PASS**

- [x] **Step 4: Commit**

```bash
git add src/core/ui/modal.js tests/unit/core/ui/modal.test.js
git commit -m "feat(core): implement shared modal utility"
```

---

### Task 5: Migrate Targets to Unified UI

**Files:**

- Modify: `src/targets/extension/options.js`
- Modify: `src/targets/extension/options.html`
- Modify: `src/targets/userscript/entry.js`

- [x] **Step 1: Update Extension options**

Modify `src/targets/extension/options.js` to use `SettingsUI`.
Modify `src/targets/extension/options.html` to be a minimal container.

- [x] **Step 2: Update Userscript entry point**

Modify `src/targets/userscript/entry.js`.

- Remove `GM_config` integration.
- Replace `GM_config.open()` with `new Modal(...)` + `new SettingsUI(...)`.
- Update menu commands.

- [x] **Step 3: Perform manual smoke tests**

- [x] **Step 4: Commit**

```bash
git add src/targets/extension/ src/targets/userscript/entry.js
git commit -m "refactor: migrate all targets to unified configuration UI"
```
