# CI Lint Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add actionlint and web-ext lint to the existing CI jobs so both block merges through `merge-gate`.

**Architecture:** actionlint runs through the SHA-pinned `raven-actions/actionlint` action in `lint-and-audit`, with the tool version pinned by its `version` input. web-ext lint runs in `build` after the all-target build through `npx`. Warnings are reported but do not fail the build. No new workflows or required check contexts.

**Tech Stack:** GitHub Actions, raven-actions/actionlint 2.2.0, actionlint 1.7.12, web-ext 10.7.0, Node 24, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-28-ci-lint-gates-design.md`

## Preconditions

- Start from `origin/main` (`5c5161c`) on a new branch named `ci/add-lint-gates`.
- Do not commit `docs/ci-cd-review.md` or `docs/code-simplification-review.md`; they are unrelated untracked files.
- The spec file and this plan are committed with Task 3.

## Global Constraints

- `web-ext` must not enter `package.json` or `package-lock.json`; `npm run audit` must stay green.
- `raven-actions/actionlint` must be pinned to `3d39aea434753780c3b3d4a1a31c854b4dbf49d7` (v2.2.0) with `version: '1.7.12'`.
- `web-ext` version is `10.7.0`, matching the store publish workflow.
- CI owns the actionlint pin; local runs use a direct `actionlint` install.
- No new workflows, jobs, or required status check contexts.
- Prose uses no em dashes, and files stay ASCII.

## Review Focus

- A workflow with a malformed `${{ }}` expression: actionlint must fail the job. Pinned by the stdin probe in Task 1.
- A workflow with unsafe or unparseable shell: actionlint's bundled shellcheck must report it. Pinned by the stdin probe in Task 1.
- A Firefox manifest with an AMO error such as an invalid version: web-ext lint must exit non-zero. Pinned by the probe in Task 2.
- A Firefox manifest error: web-ext lint must exit non-zero. Pinned by the probe in Task 2.
- `web-ext` leaking into project dependencies: audit and a clean `package.json` diff must catch it. Pinned in Task 2 and Task 4.

---

### Task 1: Add actionlint to the lint-and-audit job

**Files:**

- Modify: `.github/workflows/ci.yml` (`lint-and-audit` job)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: a `Lint workflows` step inside `lint-and-audit`, which `merge-gate` already requires.

- [ ] **Step 1: Add the actionlint action step after checkout**

Insert this step between `actions/checkout` and `actions/setup-node` in the `lint-and-audit` job:

```yaml
- name: Lint workflows
  uses: raven-actions/actionlint@3d39aea434753780c3b3d4a1a31c854b4dbf49d7 # v2.2.0
  with:
      version: '1.7.12'
      pyflakes: false
```

The action downloads the pinned actionlint release, caches it, and fails the step on errors. Keep `version` explicit because its default is `latest`. `pyflakes` is off because the workflows contain no Python; `shellcheck` stays on.

- [ ] **Step 2: Verify actionlint passes on the repository locally**

Run a local actionlint 1.7.12 (installed separately; CI owns the pin):

```bash
actionlint
```

Expected: exit 0 and no output.

- [ ] **Step 3: Verify the gate detects a malformed workflow expression**

Run the same probe through the local actionlint 1.7.12:

```bash
printf 'name: Bad\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${{ github.event.pull_request.title\n' | actionlint -stdin-filename .github/workflows/bad.yml -
```

Expected: exit 1 with `unexpected EOF while lexing expression` and a shellcheck parse failure.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(github): lint workflows with actionlint"
```

---

### Task 2: Add web-ext lint to the build job

**Files:**

- Modify: `.github/workflows/ci.yml` (`build` job)

**Interfaces:**

- Consumes: the `build` job and `dist/firefox` produced by `npm run build`.
- Produces: a `Lint Firefox extension` step inside `build`, which `merge-gate` already requires.

- [ ] **Step 1: Add the web-ext lint step to the build job**

Append this step after `- run: npm run build` in the `build` job:

```yaml
- name: Lint Firefox extension
  # Errors fail the step; warnings are reported in the log. npx installs
  # web-ext into its cache, so the project dependency tree is untouched.
  run: npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir dist/firefox
```

- [ ] **Step 2: Rebuild and verify the lint passes**

Run:

```bash
npm run build:firefox
npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir dist/firefox
```

Expected: exit 0 with `errors 0`; warnings are reported without failing.

- [ ] **Step 3: Verify the gate detects a manifest error**

Run:

```bash
rm -rf /tmp/fm-manifest-probe
cp -R dist/firefox /tmp/fm-manifest-probe
python3 - <<'PY'
import json
p = '/tmp/fm-manifest-probe/manifest.json'
d = json.load(open(p))
d['version'] = 'not-a-version'
json.dump(d, open(p, 'w'))
PY
npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir /tmp/fm-manifest-probe
rm -rf /tmp/fm-manifest-probe
```

Expected: exit 1 with `VERSION_FORMAT_INVALID`.

- [ ] **Step 4: Verify formatting, lint, audit, and dependency files**

Run:

```bash
npm run format:check
npm run lint
npm run audit
git diff --exit-code package.json package-lock.json
```

Expected: all pass, and the dependency files are unchanged.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(github): lint the Firefox build with web-ext"
```

---

### Task 3: Document the new gates

**Files:**

- Modify: `AGENTS.md` (Commands and GitHub sections)
- Modify: `CONTRIBUTING.md` (Run the checks section)
- Add: `docs/superpowers/specs/2026-10-28-ci-lint-gates-design.md` (already written)
- Add: `docs/superpowers/plans/2026-10-28-ci-lint-gates.md` (already written)

**Interfaces:**

- Consumes: the exact commands and job contents from Tasks 1 and 2.
- Produces: documentation only.

- [ ] **Step 1: Add the local commands to AGENTS.md**

After the full local check line in `AGENTS.md`, add:

```markdown
- Lint workflows: `actionlint` 1.7.12, installed separately; CI runs it through `raven-actions/actionlint`
- Lint the Firefox extension: `npm run build:firefox && npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir dist/firefox`
```

- [ ] **Step 2: Update the CI job description in AGENTS.md**

Replace the `CI enforces six merge-gate jobs` bullet with:

```markdown
- CI enforces six merge-gate jobs: type-check, lint-and-audit (ESLint, Prettier, audit, and actionlint), build (all targets plus web-ext lint), test-unit, test-ui, and test-coverage. Run the equivalent commands locally first.
```

- [ ] **Step 3: Add the conditional checks to CONTRIBUTING.md**

After the full local check code block in the `Run the checks` section, add:

````markdown
    If you changed the Firefox manifest, also run:

    ```bash
    npm run build:firefox
    npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir dist/firefox
    ```
````

- [ ] **Step 4: Verify documentation formatting**

Run:

```bash
npx prettier --check AGENTS.md CONTRIBUTING.md docs/superpowers/specs/2026-10-28-ci-lint-gates-design.md
```

Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CONTRIBUTING.md docs/superpowers/specs/2026-10-28-ci-lint-gates-design.md docs/superpowers/plans/2026-10-28-ci-lint-gates.md
git commit -m "docs: document CI lint gates"
```

---

### Task 4: Verify the whole change

**Files:** none.

**Interfaces:**

- Consumes: Tasks 1 through 3.
- Produces: evidence that the gates pass and the ruleset is untouched.

- [ ] **Step 1: Confirm the change set**

Run:

```bash
git diff --stat origin/main...HEAD
git status --short
```

Expected: exactly these changed files: `.github/workflows/ci.yml`, `AGENTS.md`, `CONTRIBUTING.md`, the spec, and this plan. `git status` shows only the two unrelated untracked review documents.

- [ ] **Step 2: Run both new gates**

Run:

```bash
actionlint
npm run build:firefox
npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir dist/firefox
```

Expected: actionlint exits 0 silently; web-ext reports `errors 0`.

- [ ] **Step 3: Run the existing local gates**

Run:

```bash
npm run type-check
npm run lint
npm run format:check
npm run audit
```

Expected: all pass.

- [ ] **Step 4: Confirm the ruleset is unchanged**

Run:

```bash
gh api repos/fran2889/flix-monkey/rulesets/17680934 --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'
```

Expected: `merge-gate`, `dependency-review`, and `CodeQL`, with no new context.
