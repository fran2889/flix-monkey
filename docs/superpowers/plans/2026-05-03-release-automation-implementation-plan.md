# Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate versioning and release management using Release Please.

**Architecture:** Integrate `googleapis/release-please-action` into GitHub Actions, replacing manual versioning.

**Tech Stack:** GitHub Actions, Release Please, Conventional Commits.

---

### Task 1: Initialize Configuration

**Files:**
- Create: `release-please-config.json`

- [ ] **Step 1: Write `release-please-config.json`**

```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "flixmonkey"
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add release-please-config.json
git commit -m "chore: add release-please config"
```

### Task 2: Create Release Workflow

**Files:**
- Create: `.github/workflows/release-please.yml`

- [ ] **Step 1: Write workflow file**

```yaml
on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          config-file: release-please-config.json
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release-please.yml
git commit -m "chore: add release-please workflow"
```

### Task 3: Final Verification

- [ ] **Step 1: Run build and tests to ensure existing pipeline integrity**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 2: Final Commit**

```bash
git commit -m "chore: finalize release automation setup"
```
---

Plan complete and saved to `docs/superpowers/plans/2026-05-03-release-automation-implementation-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?