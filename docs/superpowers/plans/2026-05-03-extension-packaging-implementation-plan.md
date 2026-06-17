# Extension Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement an automated post-build packaging workflow to create `.zip` (Chrome) and `.xpi` (Firefox) artifacts.

**Architecture:** A Node.js post-build script using `archiver` will read the current package version and compress the `dist/` subdirectories into versioned artifacts in the same root `dist/` directory.

**Tech Stack:** Node.js, `archiver` library.

---

### Task 1: Setup Dependencies

- [x] **Step 1: Install `archiver`**

Run: `npm install archiver --save-dev`
Expected: `archiver` listed in `devDependencies` in `package.json`.

### Task 2: Implement Packaging Script

- [x] **Step 1: Create `scripts/package.js`**

Create: `scripts/package.js`

```javascript
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const { version } = pkg;

function zipDirectory(sourceDir, outPath) {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => console.log(`Created ${outPath} (${archive.pointer()} total bytes)`));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
}

const chromeDir = path.join('dist', 'chrome');
const firefoxDir = path.join('dist', 'firefox');

if (fs.existsSync(chromeDir)) {
    zipDirectory(chromeDir, path.join('dist', `FlixMonkey-v${version}-chrome.zip`));
} else {
    console.error('Chrome dist directory missing');
}

if (fs.existsSync(firefoxDir)) {
    zipDirectory(firefoxDir, path.join('dist', `FlixMonkey-v${version}-firefox.xpi`));
} else {
    console.error('Firefox dist directory missing');
}
```

- [x] **Step 2: Update `package.json`**

Modify: `package.json` to update the `build` script:

```json
"scripts": {
  "build": "rollup -c && node scripts/package.js"
}
```

- [x] **Step 3: Run Build**

Run: `npm run build`
Expected: `dist/FlixMonkey-v<version>-chrome.zip` and `dist/FlixMonkey-v<version>-firefox.xpi` created in `dist/`.

### Task 3: Cleanup and Commit

- [x] **Step 1: Commit**

Run:

```bash
git add package.json scripts/package.js
git commit -m "feat: add post-build packaging step for extension artifacts"
```
