# Dependency Scan & Age Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add layered supply-chain defences — vulnerability scanning on PRs, cooldown periods for Dependabot updates, and npm minimum release age enforcement.

**Architecture:** Three config-only changes across CI workflows, Dependabot config, and npm config. No application code or tests — these are infrastructure guardrails that layer: Dependabot cooldown delays fresh packages, dependency-review catches vulns on PRs, and npm's min-release-age blocks young packages at install time.

**Tech Stack:** GitHub Actions, Dependabot, npm 11.x

---

## File Structure

| File                                      | Change | Responsibility                                                                      |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `.github/workflows/dependency-review.yml` | Create | Run `actions/dependency-review-action` on PRs to `main`; fail on high/critical CVEs |
| `.github/dependabot.yml`                  | Modify | Add `cooldown` blocks to both `github-actions` and `npm` ecosystem entries          |
| `.npmrc`                                  | Modify | Add `min-release-age=5` line                                                        |

---

### Task 1: Create Dependency Review Workflow

**Files:**

- Create: `.github/workflows/dependency-review.yml`

- [x] **Step 1: Create the workflow file**

This project SHA-pins all GitHub Actions with a `# vN` comment. Use the same pattern.

```yaml
name: Dependency Review

on:
    pull_request:
        branches: [main]

permissions:
    contents: read

jobs:
    dependency-review:
        runs-on: ubuntu-latest
        timeout-minutes: 5
        steps:
            - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
            - uses: actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48 # v4
              with:
                  fail-on-severity: high
```

Key choices matching existing conventions:

- 4-space YAML indentation (Prettier `tabWidth: 4`)
- `permissions: contents: read` (minimal, same as `ci.yml`)
- `timeout-minutes: 5` (this job only diffs manifests, doesn't install)
- `fail-on-severity: high` (matches `npm audit --audit-level=high` in `ci.yml`)
- `actions/checkout` pinned to same SHA as `ci.yml`

- [x] **Step 2: Verify formatting**

Run: `npx prettier --check .github/workflows/dependency-review.yml`
Expected: The file passes Prettier checks (no formatting changes needed).

If it fails, run `npx prettier --write .github/workflows/dependency-review.yml` and inspect the diff.

- [x] **Step 3: Commit**

```bash
git add .github/workflows/dependency-review.yml
git commit -m "ci: add dependency review workflow for PR vulnerability scanning"
```

---

### Task 2: Add Dependabot Cooldown

**Files:**

- Modify: `.github/dependabot.yml`

- [x] **Step 1: Add cooldown to both ecosystem entries**

The final file should be:

```yaml
version: 2
updates:
    - package-ecosystem: github-actions
      directory: /
      schedule:
          interval: weekly
      groups:
          github-actions:
              patterns:
                  - '*'
      cooldown:
          default-days: 10

    - package-ecosystem: npm
      directory: /
      schedule:
          interval: weekly
      groups:
          npm-patch:
              patterns:
                  - '*'
              update-types:
                  - patch
          npm-minor:
              patterns:
                  - '*'
              update-types:
                  - minor
          npm-major:
              patterns:
                  - '*'
              update-types:
                  - major
      cooldown:
          default-days: 10
          semver-patch-days: 5
          semver-minor-days: 10
          semver-major-days: 20
```

Changes from current file:

- `github-actions` entry: added `cooldown.default-days: 10` — no semver granularity for actions, so only `default-days` applies
- `npm` entry: added `cooldown` block with all four keys — `default-days: 10` as baseline, then semver-specific overrides (5/10/20 for patch/minor/major)

Security updates bypass cooldown automatically — this is Dependabot's built-in behaviour, no config needed.

- [x] **Step 2: Verify formatting**

Run: `npx prettier --check .github/dependabot.yml`
Expected: Passes.

- [x] **Step 3: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: add Dependabot cooldown to delay freshly published packages"
```

---

### Task 3: Add npm Minimum Release Age

**Files:**

- Modify: `.npmrc`

- [x] **Step 1: Add min-release-age to .npmrc**

The file currently contains only `engine-strict=true`. Add the new line:

```
engine-strict=true
min-release-age=5
```

`min-release-age=5` means npm refuses to install any package version published less than 5 days ago. This is a native npm 11.x feature (Node >= 24 is already required by this project's `engines` field). The value matches the Dependabot patch cooldown so local installs and Dependabot are in sync.

- [x] **Step 2: Verify npm respects the setting**

Run: `npm config list --location=project`
Expected output includes: `min-release-age = 5`

This confirms npm reads the `.npmrc` setting correctly.

- [x] **Step 3: Commit**

```bash
git add .npmrc
git commit -m "ci: add npm min-release-age to block freshly published packages"
```

---

## Verification Checklist

After all three tasks, verify the full set of changes:

- [x] `npx prettier --check .github/workflows/dependency-review.yml .github/dependabot.yml` passes
- [x] `npm run lint` passes (no JS changes, but sanity check)
- [x] `npm config list --location=project` shows `min-release-age = 5`
- [x] `git log --oneline -3` shows three clean commits with `ci:` prefix
