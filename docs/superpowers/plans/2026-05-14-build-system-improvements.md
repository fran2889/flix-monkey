# Build System Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address build system inefficiencies, specifically sourcemap generation, dependency management, and packaging stability.

**Architecture:**

- Enable sourcemaps in Rollup for web extension targets.
- Refactor the packaging script to use Promises for reliable asynchronous execution and error reporting.
- Standardize dependency grouping and specify the supported Node.js version in `package.json`.

**Tech Stack:** Node.js, Rollup, Archiver.

---

### Task 1: Enable Sourcemaps in Rollup

**Files:**

- Modify: `rollup.config.js`

- [ ] **Step 1: Enable sourcemaps for non-userscript targets**
      Add `sourcemap: true` to the `output` property of all extension configurations (firefox and chrome).

```javascript
// Example for one target
{
    _target: 'firefox',
    input: 'src/targets/extension/content.js',
    output: { file: 'dist/firefox/content.js', format: 'iife', sourcemap: true },
    // ...
}
```

- [ ] **Step 2: Verify sourcemap generation**
      Run: `npm run build:chrome`
      Expected: `dist/chrome/content.js.map` should exist.

- [ ] **Step 3: Commit**

```bash
git add rollup.config.js
git commit -m "build: enable sourcemaps for extension targets"
```

### Task 2: Refactor Packaging Script for Robustness

**Files:**

- Modify: `scripts/package.js`

- [ ] **Step 1: Promisify `zipDirectory`**
      Wrap the `archiver` logic in a Promise. Resolve on `output.on('close')`, reject on `output.on('error')` and `archive.on('error')`.

- [ ] **Step 2: Update main execution logic**
      Use `async/await` to run the zip operations and handle errors with `try/catch`. Call `process.exit(1)` on error.

- [ ] **Step 3: Verify packaging success**
      Run: `npm run build`
      Expected: Zipped files in `dist/` and "Created ..." log messages.

- [ ] **Step 4: Verify packaging failure (forced)**
      Temporarily modify the script to try zipping a non-existent directory and verify it exits with code 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/package.js
git commit -m "build: promisify packaging script and improve error handling"
```

### Task 3: Dependency Management Updates

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Move `dotenv` to `devDependencies`**
      Move `"dotenv": "^17.4.2"` from `dependencies` to `devDependencies`.

- [ ] **Step 2: Add `engines` field**
      Add `"engines": { "node": ">= 22" }` to `package.json`.

- [ ] **Step 3: Run `npm install` to update lockfile**
      Run: `npm install`
      Expected: Success, `package-lock.json` updated.

- [ ] **Step 4: Verify `package.json` changes**
      Check that `dotenv` is in `devDependencies` and `engines` is present.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: update dependencies and engines in package.json"
```

### Task 4: Final Verification

- [ ] **Step 1: Full build and lint check**
      Run: `npm run lint && npm run build`
      Expected: PASS. Verify all outputs (dist files, maps, zips) are present.
