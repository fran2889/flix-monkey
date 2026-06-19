# Dependency Scan & Age Gate Design

**Date:** 2026-06-17
**Status:** Approved

## Goal

Add layered supply-chain defences: catch newly introduced vulnerabilities on every PR, and prevent freshly published packages from landing in the project before the ecosystem has had time to detect malicious releases.

## Scope

Three targeted changes across three files. No new dependencies, no changes to application code.

## Changes

### 1. Dependency Review Action (`.github/workflows/dependency-review.yml`)

New workflow that runs `actions/dependency-review-action` on every PR targeting `main`. It diffs the dependency manifest between base and head and fails the PR if any newly introduced package version has a known high or critical CVE.

- Trigger: `pull_request` to `main`
- Fails on: `high` severity and above (consistent with the existing `npm audit --audit-level=high` in `ci.yml`)
- Complements `npm audit`: audit catches vulns already in the tree; dependency review catches vulns introduced by the PR

### 2. Dependabot Cooldown (`.github/dependabot.yml`)

Add a `cooldown` block to the `npm` ecosystem entry. Dependabot will not open a PR for a new package version until the version has been published for at least the configured number of days.

| Update type | Key                 | Days |
| ----------- | ------------------- | ---- |
| Patch       | `semver-patch-days` | 5    |
| Minor       | `semver-minor-days` | 10   |
| Major       | `semver-major-days` | 20   |

**Security updates bypass the cooldown** — Dependabot still opens CVE-driven PRs immediately regardless of package age. Cooldown only applies to version updates.

A `default-days: 10` cooldown is also added to the `github-actions` ecosystem entry. SHA pinning prevents silent tag drift but does not protect against a compromised action commit being proposed by Dependabot — the cooldown gives the community time to detect a supply-chain attack before it auto-lands. Actions have no semver granularity so `default-days` is the only applicable key.

### 3. npm Minimum Release Age (`.npmrc`)

Add `min-release-age=5` to the existing `.npmrc`. This is a native npm 11.x feature (available since Node >= 24 is already required).

Value matches the Dependabot patch cooldown (5 days) so local installs and Dependabot are in sync.

- Protects `npm install` locally: npm refuses to install a package version published less than 5 days ago
- Protects `npm ci` in CI: the age gate is enforced against lockfile-resolved versions

## How the Layers Interact

```
New package version published
        │
        ▼
Dependabot cooldown: skip until 5/10/21 days old
        │
        ▼
Dependabot opens PR → Dependency Review Action: fail if vuln introduced
        │
        ▼
Auto-merge (patches only, after CI passes)
        │
        ▼
npm ci in CI: min-release-age=5 enforced on lockfile versions
```

For manual `npm install` by a developer, the `min-release-age=5` in `.npmrc` is the only gate — Dependabot is not involved.

Security updates skip the cooldown step and go straight to PR creation.

## Files Changed

| File                                      | Change                                |
| ----------------------------------------- | ------------------------------------- |
| `.github/workflows/dependency-review.yml` | New file                              |
| `.github/dependabot.yml`                  | Add `cooldown` to npm ecosystem entry |
| `.npmrc`                                  | Add `min-release-age=5`               |
