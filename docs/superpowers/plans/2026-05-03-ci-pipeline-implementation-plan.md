# CI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a GitHub Actions CI pipeline that automatically runs linting and testing for the flixmonkey project.

**Architecture:** Use `.github/workflows/ci.yml` with `actions/checkout@v4`, `actions/setup-node@v4` (Node 22), and standard `npm` scripts.

**Tech Stack:** GitHub Actions, Node.js, npm, vitest, eslint, prettier.

---

### Task 1: Create Workflow Configuration

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write workflow file**

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

- [ ] **Step 2: Verify workflow file structure**
Ensure the path is exactly `.github/workflows/ci.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for linting and testing"
```
