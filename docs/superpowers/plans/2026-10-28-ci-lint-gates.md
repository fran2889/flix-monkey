# CI Lint Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add actionlint and web-ext lint to the existing CI jobs so both block merges through `merge-gate`.

**Architecture:** actionlint runs from a digest-pinned Docker image in `lint-and-audit`. web-ext lint runs in `build` after the all-target build, installing `web-ext` ad hoc. The Firefox manifest declares Android 142 so `--warnings-as-errors` passes. No new workflows or required check contexts.

**Tech Stack:** GitHub Actions, Docker, actionlint 1.7.12, web-ext 10.7.0, Node 24, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-28-ci-lint-gates-design.md`

## Preconditions

- Start from `origin/main` (`5c5161c`) on a new branch named `ci/add-lint-gates`.
- Do not commit `docs/ci-cd-review.md` or `docs/code-simplification-review.md`; they are unrelated untracked files.
- The spec file and this plan are committed with Task 3.

## Global Constraints

- `web-ext` must not enter `package.json` or `package-lock.json`; `npm run audit` must stay green.
- actionlint must use `rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`.
- `web-ext` version is `10.7.0`, matching the store publish workflow.
- Desktop Firefox minimum stays `140.0`; only `gecko_android` gets `142.0`.
- No new workflows, jobs, or required status check contexts.
- Prose uses no em dashes, and files stay ASCII.

## Review Focus

- A workflow with a malformed `${{ }}` expression: actionlint must fail the job. Pinned by the stdin probe in Task 1.
- A workflow with unsafe or unparseable shell: actionlint's bundled shellcheck must report it. Pinned by the stdin probe in Task 1.
- A Firefox manifest with an AMO error such as an invalid version: web-ext lint must exit non-zero. Pinned by the probe in Task 2.
- A Firefox manifest warning: `--warnings-as-errors` must fail until the Android floor is declared. Pinned by the baseline run in Task 2.
- `web-ext` leaking into project dependencies: audit and a clean `package.json` diff must catch it. Pinned in Task 2 and Task 4.

---

### Task 1: Add actionlint to the lint-and-audit job

**Files:**

- Modify: `.github/workflows/ci.yml` (`lint-and-audit` job)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: a `Lint workflows` step inside `lint-and-audit`, which `merge-gate` already requires.

- [ ] **Step 1: Add the actionlint step after checkout**

Insert this step between `actions/checkout` and `actions/setup-node` in the `lint-and-audit` job:

```yaml
- name: Lint workflows
  run: docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
```

- [ ] **Step 2: Verify actionlint passes on the repository**

Run:

```bash
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
```

Expected: exit 0 and no output.

- [ ] **Step 3: Verify the gate detects a malformed workflow expression**

Run:

```bash
printf 'name: Bad\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${{ github.event.pull_request.title\n' | docker run --rm -i -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -stdin-filename .github/workflows/bad.yml -
```

Expected: exit 1 with `unexpected EOF while lexing expression` and a shellcheck parse failure.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(github): lint workflows with actionlint"
```

---

### Task 2: Add web-ext lint and the Android manifest floor

**Files:**

- Modify: `src/targets/firefox/manifest.json`
- Modify: `.github/workflows/ci.yml` (`build` job)

**Interfaces:**

- Consumes: the `build` job and `dist/firefox` produced by `npm run build`.
- Produces: `Install web-ext` and `Lint Firefox extension` steps inside `build`, which `merge-gate` already requires.

- [ ] **Step 1: Confirm the current warning fails a strict gate**

Run:

```bash
npm run build:firefox
npx --yes web-ext@10.7.0 lint --source-dir dist/firefox --warnings-as-errors
```

Expected: exit 1 with `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`.

- [ ] **Step 2: Add the Android minimum to the Firefox manifest**

Change `browser_specific_settings` in `src/targets/firefox/manifest.json` to:

```json
    "browser_specific_settings": {
        "gecko": {
            "id": "flixmonkey@fran",
            "strict_min_version": "140.0",
            "data_collection_permissions": {
                "required": ["none"],
                "optional": []
            }
        },
        "gecko_android": {
            "strict_min_version": "142.0"
        }
    }
```

- [ ] **Step 3: Add the web-ext steps to the build job**

Append these steps after `- run: npm run build` in the `build` job:

```yaml
- name: Install web-ext
  # web-ext is not a devDependency because its advisories would keep the audit
  # gate red. Install it outside the project tree so it cannot disturb the
  # locked dependency tree.
  run: npm install --prefix "$RUNNER_TEMP/web-ext" --no-save --no-package-lock --no-audit --no-fund --ignore-scripts web-ext@10.7.0
- name: Lint Firefox extension
  run: |
      "$RUNNER_TEMP/web-ext/node_modules/.bin/web-ext" lint --source-dir dist/firefox --warnings-as-errors
```

- [ ] **Step 4: Rebuild and verify the strict lint passes**

Run:

```bash
npm run build:firefox
npx --yes web-ext@10.7.0 lint --source-dir dist/firefox --warnings-as-errors
```

Expected: `errors 0`, `warnings 0`, exit 0.

- [ ] **Step 5: Verify the gate detects a manifest error**

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
npx --yes web-ext@10.7.0 lint --source-dir /tmp/fm-manifest-probe --warnings-as-errors
rm -rf /tmp/fm-manifest-probe
```

Expected: exit 1 with `VERSION_FORMAT_INVALID`.

- [ ] **Step 6: Verify formatting, lint, audit, and dependency files**

Run:

```bash
npx prettier --write src/targets/firefox/manifest.json
npm run format:check
npm run lint
npm run audit
git diff --exit-code package.json package-lock.json
```

Expected: all pass. The manifest write produces no unrelated formatting changes, and the dependency files are unchanged.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml src/targets/firefox/manifest.json
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
- Lint workflows: `docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`
- Lint the Firefox extension: `npm run build:firefox && npx --yes web-ext@10.7.0 lint --source-dir dist/firefox --warnings-as-errors`
```

- [ ] **Step 2: Update the CI job description in AGENTS.md**

Replace the `CI enforces six merge-gate jobs` bullet with:

```markdown
- CI enforces six merge-gate jobs: type-check, lint-and-audit (ESLint, Prettier, audit, and actionlint), build (all targets plus web-ext lint), test-unit, test-ui, and test-coverage. Run the equivalent commands locally first.
```

- [ ] **Step 3: Add the conditional checks to CONTRIBUTING.md**

After the full local check code block in the `Run the checks` section, add:

````markdown
    If you changed workflows or the Firefox manifest, also run:

    ```bash
    docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
    npm run build:firefox
    npx --yes web-ext@10.7.0 lint --source-dir dist/firefox --warnings-as-errors
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

Expected: exactly these changed files: `.github/workflows/ci.yml`, `src/targets/firefox/manifest.json`, `AGENTS.md`, `CONTRIBUTING.md`, the spec, and this plan. `git status` shows only the two unrelated untracked review documents.

- [ ] **Step 2: Run both new gates**

Run:

```bash
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
npm run build:firefox
npx --yes web-ext@10.7.0 lint --source-dir dist/firefox --warnings-as-errors
```

Expected: actionlint exits 0 silently; web-ext reports `errors 0` and `warnings 0`.

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
