# UI Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement high-fidelity UI integration tests for Netflix Browse, Search, Zoomed (Hover), and Info (Modal) surfaces using HTML snapshots.

**Architecture:** Load real Netflix HTML snapshots into JSDOM, use `SurfaceManager` to discover injection points, and `OverlayRenderer` to verify correct badge injection and behavioral logic.

**Tech Stack:** Vitest, JSDOM, @testing-library/dom, Chrome DevTools MCP (for harvesting).

---

### Task 1: Fixture Harvesting

**Files:**

- Create: `tests/fixtures/netflix-browse.html`
- Create: `tests/fixtures/netflix-search.html`
- Create: `tests/fixtures/netflix-hover.html`
- Create: `tests/fixtures/netflix-modal.html`

- [x] **Step 1: Capture Browse snapshot**

Use Chrome MCP to navigate to `https://www.netflix.com/browse`, wait for titles to load, and save the `document.documentElement.outerHTML` to `tests/fixtures/netflix-browse.html`.

- [x] **Step 2: Capture Search snapshot**

Navigate to `https://www.netflix.com/search?q=action`, wait for results, and save to `tests/fixtures/netflix-search.html`.

- [x] **Step 3: Capture Hover snapshot**

On the Browse page, hover over a title card until the zoom "bob" appears. Capture the DOM and save to `tests/fixtures/netflix-hover.html`.

- [x] **Step 4: Capture Modal snapshot**

On the Browse page, click "More Info" on a title to open the preview modal. Capture the DOM and save to `tests/fixtures/netflix-modal.html`.

- [x] **Step 5: Clean fixtures (Optional but recommended)**

Manually or via script, remove personal data (usernames, profile pics) from the captured HTML files to ensure privacy.

- [x] **Step 6: Commit fixtures**

```bash
git add tests/fixtures/*.html
git commit -m "test: add high-fidelity netflix html fixtures"
```

### Task 2: Browse Surface UI Tests

**Files:**

- Create: `tests/ui/browse.ui.test.js`

- [x] **Step 1: Write the Browse UI test**
- [x] **Step 2: Run Browse UI tests**
- [x] **Step 3: Commit**

### Task 3: Search Surface UI Tests

**Files:**

- Create: `tests/ui/search.ui.test.js`

- [x] **Step 1: Write the Search UI test**
- [x] **Step 2: Run Search UI tests**
- [x] **Step 3: Commit**

### Task 4: Zoomed (Hover) Surface UI Tests

**Files:**

- Create: `tests/ui/zoomed.ui.test.js`

- [x] **Step 1: Write the Zoomed UI test**
- [x] **Step 2: Run Zoomed UI tests**
- [x] **Step 3: Commit**

### Task 5: Info (Modal) Surface UI Tests

**Files:**

- Create: `tests/ui/info.ui.test.js`

- [x] **Step 1: Write the Info UI test**
- [x] **Step 2: Run Info UI tests**
- [x] **Step 3: Commit**
