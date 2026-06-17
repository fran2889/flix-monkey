# Project Setup, Build, and CI Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Refactor build configuration, optimize CI pipeline, enhance test scoping, and unify linting/formatting.

**Architecture:**

- Modularize rollup configuration into target-specific definitions using a factory pattern.
- Decouple lint/audit and build/test jobs in GitHub Actions.
- Explicitly split test runs (unit, integration, ui) into parallel jobs in CI.

**Tech Stack:** Rollup, Vitest, GitHub Actions, ESLint, Prettier.

---

### Task 1: Refactor Rollup Configuration

- Create: `rollup.config.mjs` (renaming for modern module support, modularizing targets)
- Modify: `package.json` (update build scripts if needed)

- [x] **Step 1: Create modular rollup base**
- [x] **Step 2: Define specific configs**
- [x] **Step 3: Update `package.json` build scripts**

### Task 2: Optimize CI Pipeline

- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Parallelize lint/audit**

```yaml
jobs:
    lint-and-audit:
        runs-on: ubuntu-latest
        steps:
            - run: npm run lint
            - run: npm run audit
    test:
        runs-on: ubuntu-latest
        # ...
```

- [x] **Step 2: Add parallel test jobs**

```yaml
test-unit:
    runs-on: ubuntu-latest
    steps:
        - run: npm run test:unit
test-integration:
    runs-on: ubuntu-latest
    steps:
        - run: npm run test:integration
test-ui:
    runs-on: ubuntu-latest
    steps:
        - run: npm run test:ui
```

### Task 3: Unify Linting and Formatting

- Modify: `.eslintrc.js` (if needed to ensure full coverage), `package.json`

- [x] **Step 1: Ensure `lint` covers all target directories**
- [x] **Step 2: Add `format:check` to CI to enforce prettier**

### Verification & Testing

- [x] **Step 1: Run local build**
- [x] **Step 2: Run all tests locally**
- [x] **Step 3: Push to branch and check CI status**
