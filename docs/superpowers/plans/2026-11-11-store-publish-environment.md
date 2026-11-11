# Store Publish Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the store publishing workflows deploy through the existing `store-publish` GitHub environment and document that the store credentials live there.

**Architecture:** Add a job-level `environment: store-publish` to the two publish jobs and to the AMO description job, then rewrite the secrets documentation. GitHub resolves the environment secrets only for those jobs and enforces the `main` + `v*` deployment branch policy before any step runs.

**Tech Stack:** GitHub Actions, Markdown, `actionlint`, Prettier.

**Spec:** [`docs/superpowers/specs/2026-11-11-store-publish-environment-design.md`](../specs/2026-11-11-store-publish-environment-design.md)

## Global Constraints

- Environment name is exactly `store-publish`.
- Environment secrets: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`, `AMO_ADDON_ID`.
- `GREASYFORK_SCRIPT_ID` stays a repository variable.
- Do not change environment protection settings. The branch policies `main` and `v*`, the absent required reviewers, and the disabled self-review prevention already satisfy the issue.
- Do not change action pins, step order, or any publish command.
- `publish-greasyfork` must not declare the environment.
- Both workflows must pass `actionlint` 1.7.12.
- Docs prose: no em-dashes, use a colon, a semicolon, or two sentences. Use the Oxford comma. ASCII only.
- Conventional Commits: `ci(github): ...` for workflows, `docs: ...` for documentation.
- Preserve unrelated working-tree changes. `docs/reviews/` is untracked and must not be staged.

## Review Focus

- A publish job without `environment`: it silently reads repository secrets, so the branch policy and environment secrets do not apply. Task 1 checks the exact count and position of the declaration.
- `update-firefox-description` without `environment`: after the repository secrets are deleted, AMO authentication fails on the next description update. Task 1 checks that file too.
- `publish-greasyfork` receiving the environment: it needs no store credentials and would become subject to the store policy for no reason. Task 1 asserts the publish workflow has exactly two declarations.
- A run from a non-`main`, non-`v*` ref: it must fail at the environment gate before checkout or publishing. This is operational, documented in Task 3's PR checklist, and cannot be tested locally.
- Docs claiming the credentials have already been migrated: the docs must describe the environment and the migration order without asserting the administrator step is done. Task 2 reads the changed prose against this rule.

---

### Task 1: Declare the environment in the workflows

**Files:**

- Modify: `.github/workflows/publish-to-stores.yml:15-17`, `.github/workflows/publish-to-stores.yml:51-53`
- Modify: `.github/workflows/update-store-description.yml:13-15`

**Interfaces:**

- Consumes: the existing `store-publish` environment and its branch policies.
- Produces: three jobs that resolve environment-scoped secrets: `publish-chrome`, `publish-firefox`, `update-firefox-description`.

- [x] **Step 1: Create the branch**

```bash
git switch -c ci/store-publish-environment
```

Run: `git branch --show-current`
Expected: `ci/store-publish-environment`

- [x] **Step 2: Add the environment to `publish-chrome`**

In `.github/workflows/publish-to-stores.yml`, change:

```yaml
publish-chrome:
    runs-on: ubuntu-latest
    timeout-minutes: 10
```

to:

```yaml
publish-chrome:
    runs-on: ubuntu-latest
    environment: store-publish
    timeout-minutes: 10
```

- [x] **Step 3: Add the environment to `publish-firefox`**

In the same file, change:

```yaml
publish-firefox:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

to:

```yaml
publish-firefox:
    runs-on: ubuntu-latest
    environment: store-publish
    timeout-minutes: 15
```

- [x] **Step 4: Add the environment to `update-firefox-description`**

In `.github/workflows/update-store-description.yml`, change:

```yaml
update-firefox-description:
    runs-on: ubuntu-latest
    timeout-minutes: 5
```

to:

```yaml
update-firefox-description:
    runs-on: ubuntu-latest
    environment: store-publish
    timeout-minutes: 5
```

- [x] **Step 5: Verify the declarations**

Run:

```bash
grep -n -B1 -A1 'environment: store-publish' .github/workflows/publish-to-stores.yml .github/workflows/update-store-description.yml
```

Expected: two matches in `publish-to-stores.yml`, each immediately after a `runs-on` line for `publish-chrome` and `publish-firefox`, and one match in `update-store-description.yml` for `update-firefox-description`.

Run:

```bash
test "$(grep -c 'environment: store-publish' .github/workflows/publish-to-stores.yml)" -eq 2 && echo "publish jobs: ok"
test "$(grep -c 'environment: store-publish' .github/workflows/update-store-description.yml)" -eq 1 && echo "description job: ok"
```

Expected: both lines print.

- [x] **Step 6: Lint the workflows**

Install the pinned linter if it is not on `PATH`:

```bash
go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
```

Run:

```bash
"$(go env GOPATH)/bin/actionlint" .github/workflows/publish-to-stores.yml .github/workflows/update-store-description.yml
```

Expected: no output and exit code 0.

- [x] **Step 7: Commit**

```bash
git add .github/workflows/publish-to-stores.yml .github/workflows/update-store-description.yml
git commit -m "ci(github): scope store publishing to the store-publish environment"
```

---

### Task 2: Document the environment and its secrets

**Files:**

- Modify: `docs/STORE_PUBLISHING.md:20-80`, `docs/STORE_PUBLISHING.md:134-192`

**Interfaces:**

- Consumes: the environment name and job wiring from Task 1.
- Produces: documentation that names `store-publish`, says the credentials are environment secrets, and describes the migration order without claiming it is complete.

- [x] **Step 1: Add the environment section**

In `docs/STORE_PUBLISHING.md`, after the `## Overview` section and before `## Required Repository Secrets`, insert:

```markdown
## Publishing Environment

The Chrome upload, Firefox upload, and Firefox description jobs run in the
`store-publish` GitHub environment. Deployments to that environment are allowed
only from `main` and `v*` tags, and it has no required reviewers. A workflow
dispatched from any other branch or tag fails at the environment gate before it
can read the credentials.

The store credentials are environment secrets on `store-publish`, not
repository secrets. To migrate existing repository secrets, create each one on
the environment first, merge the workflow change, confirm a run resolves them,
then delete the repository copies. Environment secrets take precedence over
same-named repository secrets, so leaving both makes it unclear which value is
live.
```

- [x] **Step 2: Rename the secrets heading and explain the scope**

Change:

```markdown
## Required Repository Secrets
```

to:

```markdown
## Required Environment Secrets

Store these as secrets on the `store-publish` environment.
```

- [x] **Step 3: Update the description-workflow link**

Change:

```markdown
Uses the AMO credentials documented in
[Required Repository Secrets](#required-repository-secrets).
```

to:

```markdown
Uses the AMO credentials documented in
[Required Environment Secrets](#required-environment-secrets).
```

- [x] **Step 4: Update the publishing steps**

At the end of the `## Publishing New Versions` section, after the sentence about parallel uploads and the Greasy Fork check, add:

```markdown
The run deploys to the `store-publish` environment. There are no required
reviewers, so it starts as soon as it is dispatched.
```

- [x] **Step 5: Update failure handling**

At the start of the `## Failure Handling` bullet list, add:

```markdown
- A job that fails before its first step with an environment protection error
  was not dispatched from `main` or a `v*` tag. Dispatch it from `main`.
- An empty store credential fails the store command. Confirm the secret exists
  on the `store-publish` environment and not only at repository level.
```

- [x] **Step 6: Verify the documentation**

Run:

```bash
grep -n 'Required Repository Secrets\|Required Environment Secrets\|store-publish' docs/STORE_PUBLISHING.md
npx --no-install prettier --check docs/STORE_PUBLISHING.md
```

Expected: no `Required Repository Secrets` match; at least one `Required Environment Secrets` and several `store-publish` matches; Prettier reports the file is formatted.

- [x] **Step 7: Commit**

```bash
git add docs/STORE_PUBLISHING.md
git commit -m "docs: document the store-publish environment"
```

---

### Task 3: Record the design, run the full check, and open the PR

**Files:**

- Add: `docs/superpowers/specs/2026-11-11-store-publish-environment-design.md`
- Add: `docs/superpowers/plans/2026-11-11-store-publish-environment.md`

**Interfaces:**

- Consumes: the workflow and documentation changes from Tasks 1 and 2.
- Produces: a branch with two implementation commits, one design commit, a passing local check, and a PR that lists the administrator steps.

- [x] **Step 1: Commit the design and plan**

```bash
git add docs/superpowers/specs/2026-11-11-store-publish-environment-design.md docs/superpowers/plans/2026-11-11-store-publish-environment.md
git commit -m "docs: add store-publish environment design and plan"
```

- [ ] **Step 2: Run the repository checks that apply**

```bash
"$(go env GOPATH)/bin/actionlint" .github/workflows/publish-to-stores.yml .github/workflows/update-store-description.yml
npx --no-install prettier --check docs/STORE_PUBLISHING.md docs/superpowers/specs/2026-11-11-store-publish-environment-design.md docs/superpowers/plans/2026-11-11-store-publish-environment.md
```

Expected: no output from `actionlint`; Prettier reports all files formatted.

No TypeScript, build, or Vitest run is needed because no source file changes.

- [ ] **Step 3: Review the diff**

Run:

```bash
git diff main...HEAD --stat
git diff main...HEAD -- .github/workflows docs/STORE_PUBLISHING.md
```

Expected: only the two workflow files and `docs/STORE_PUBLISHING.md` change, plus the two added design files. No `dist/`, `src/`, or `tests/` changes. No `publish-greasyfork` environment.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin ci/store-publish-environment
```

Expected: the branch is pushed and tracks `origin/ci/store-publish-environment`.

- [ ] **Step 5: Open the PR with the administrator checklist**

Write a body from `.github/PULL_REQUEST_TEMPLATE.md` that includes:

```markdown
## Administrator steps (before deleting repository secrets)

- [ ] Create the following secrets on the `store-publish` environment: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`, `AMO_ADDON_ID`.
- [ ] Confirm the environment allows only `main` and `v*` and has no required reviewers.
- [ ] Dispatch from a feature branch and confirm both publish jobs fail at the environment gate.
- [ ] Dispatch from `main` for a release and confirm both publish jobs resolve the credentials.
- [ ] Delete the migrated repository secrets.

## Verification

- [ ] `actionlint` passes on both workflows.
- [ ] Prettier passes on the changed Markdown.
- [ ] `publish-greasyfork` does not declare the environment.
```

Create the PR with:

```bash
gh pr create --base main --head ci/store-publish-environment --title "ci(github): scope store publishing to the store-publish environment" --body-file /tmp/store-publish-pr.md
```

Expected: a PR URL. If the token cannot create the PR (`403`), report the branch name and the prepared body file for the maintainer to use.
