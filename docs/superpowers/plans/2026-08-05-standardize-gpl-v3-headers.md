# Standardize GPL v3 Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use concise SPDX notices and make all FlixMonkey project metadata declare GPL-3.0-only.

**Architecture:** `LICENSE_HEADER.template` remains the canonical notice consumed by ESLint. The package license field remains the canonical source for build-time userscript metadata. Repository documents repeat the same SPDX identifier, and static test fixtures contain no per-file notice.

**Tech Stack:** JavaScript, HTML, JSON, Markdown, ESLint, Prettier.

## Global Constraints

- Use the SPDX identifier `GPL-3.0-only`, never `GPL-3.0-or-later`, for FlixMonkey-owned files and metadata.
- Preserve the root `LICENSE` file, which already contains GPL version 3.
- Keep copyright years in JavaScript source and test headers.
- Do not alter third-party dependency license entries in `package-lock.json`.
- Use ASCII-only prose and the Oxford comma.

---

### Task 1: Migrate notices, metadata, and public license copy

**Files:**

- Modify: `LICENSE_HEADER.template`
- Modify: `src/**/*.js`
- Modify: `tests/**/*.js`
- Modify: `tests/fixtures/*.html`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/store-description.txt`

**Interfaces:**

- Consumes: ESLint's `headers/header-format` rule, which reads `LICENSE_HEADER.template` with the `year` placeholder.
- Produces: a consistent JavaScript header and `package.json` license string used by userscript build metadata.

- [ ] **Step 1: Replace the canonical header template**

Replace the long GPL notice in `LICENSE_HEADER.template` with:

```text
SPDX-FileCopyrightText: (year) Fran

SPDX-License-Identifier: GPL-3.0-only
```

- [ ] **Step 2: Migrate all JavaScript headers and remove fixture notices**

Replace each existing top-of-file long GPL comment in the 75 JavaScript files
under `src/` and `tests/` with:

```js
/**
 * SPDX-FileCopyrightText: <existing year> Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
```

Delete only the opening license comment from all eight `tests/fixtures/*.html`
files, leaving fixture markup unchanged.

- [ ] **Step 3: Change project metadata and public copy**

Set the root package license in both package manifests to `GPL-3.0-only`.
Update the README badge image, its badge label, and the License-section link
text to `GPL-3.0-only`. Replace the contributing and store-description license
sentences with explicit `GPL-3.0-only` wording.

- [ ] **Step 4: Format changed text files**

Run:

```bash
npm run format
```

Expected: Prettier writes only repository formatting adjustments.

- [ ] **Step 5: Commit the migration**

```bash
git add LICENSE_HEADER.template src tests package.json package-lock.json README.md CONTRIBUTING.md docs/store-description.txt
git commit -m "chore: standardize GPL v3 license notices"
```

### Task 2: Verify header enforcement and remove obsolete FlixMonkey identifiers

**Files:**

- Verify: `LICENSE_HEADER.template`, `src/**/*.js`, `tests/**/*.js`, `tests/fixtures/*.html`, `package.json`, `package-lock.json`, `README.md`, `CONTRIBUTING.md`, `docs/store-description.txt`

**Interfaces:**

- Consumes: the migrated files from Task 1.
- Produces: verified lint and formatting compliance with no old FlixMonkey GPL designation.

- [ ] **Step 1: Run format and lint checks**

Run:

```bash
npm run format:check && npm run lint
```

Expected: both commands exit successfully. ESLint confirms every enforced
JavaScript header matches `LICENSE_HEADER.template`.

- [ ] **Step 2: Search for obsolete FlixMonkey license wording**

Run:

```bash
rg -n 'GPL-3\\.0-or-later|either version 3|GPLv3|GNU General Public License v3\\.0' \
  LICENSE_HEADER.template package.json package-lock.json README.md CONTRIBUTING.md docs/store-description.txt src tests
```

Expected: no matches. Dependency license records outside the package-lock root
entry are not part of this check.

- [ ] **Step 3: Confirm fixture headers are absent**

Run:

```bash
rg -n 'SPDX|Copyright|GNU General Public License' tests/fixtures
```

Expected: no matches.
