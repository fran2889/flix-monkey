# Automated Store Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically publish each FlixMonkey release to the Chrome Web Store and Firefox Add-ons (AMO) after release-please cuts a release.

**Architecture:** A new `publish-stores.yml` workflow is triggered via a `workflow_run` handshake off the existing "Release Please" workflow (because the built-in `GITHUB_TOKEN` cannot cascade a `release` event). release-please uploads a small `release-info` artifact when it cuts a release; the publish workflow reads it to learn the tag, then runs two parallel jobs that check out the tag, rebuild the target, and push to each store using official, version-pinned CLIs.

**Tech Stack:** GitHub Actions, Node.js 24, npm, `chrome-webstore-upload-cli`, Mozilla `web-ext`, `git archive`.

## Global Constraints

- **Node.js:** `>= 24`. Workflows pin `node-version: '24'`.
- **Pinned actions:** every third-party GitHub Action is pinned to a commit SHA with a trailing `# vN` comment. Reuse the SHAs already in the repo:
    - `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6`
    - `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6`
    - `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7`
- **Conventional Commits:** commit messages use `type(scope)?: description`, imperative mood, lowercase, no trailing period. Allowed types include `ci`, `build`, `docs`, `chore`.
- **Prose style:** no em-dashes (use a colon, a semicolon, or two sentences); use the Oxford comma.
- **Formatting:** Prettier formats `*.{json,md,yml,html}`. Run `npm run format` before committing; the Husky pre-commit hook also runs `lint-staged`.
- **License headers:** required only for files under `src/` and `tests/`. None of the files in this plan are under those paths, so no GPL header is needed.
- **Fully automatic publish:** both stores upload and submit for review with no manual gate. AMO listed channel does not wait for human approval (`--approval-timeout 0`).

---

## File Structure

- `package.json` (modify): add three npm scripts (`publish:chrome`, `publish:firefox`, `package:source`) and two pinned devDependencies.
- `.gitignore` (modify): ignore `web-ext-artifacts/`.
- `docs/STORE_PUBLISHING.md` (create): credential setup and AMO reviewer build instructions.
- `.github/workflows/release-please.yml` (modify): emit the `release-info` artifact when a release is created.
- `.github/workflows/publish-stores.yml` (create): the publish workflow.

The Firefox add-on already sets `browser_specific_settings.gecko.id` (`flixmonkey@fran`) in `src/targets/firefox/manifest.json`, so no manifest change is needed.

---

## Task 1: Tooling dependencies, npm scripts, and reviewer docs

**Files:**

- Modify: `package.json` (devDependencies + scripts)
- Modify: `.gitignore`
- Create: `docs/STORE_PUBLISHING.md`

**Interfaces:**

- Produces: npm scripts `publish:chrome`, `package:source`, `publish:firefox` used by `publish-stores.yml` in Task 3.
    - `publish:chrome` runs `chrome-webstore-upload --source dist/chrome` (reads `EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `PUBLISHER_ID` from env).
    - `package:source` runs `git archive --format=zip --output dist/FlixMonkey-source.zip HEAD` and writes `dist/FlixMonkey-source.zip`.
    - `publish:firefox` runs `web-ext sign --source-dir dist/firefox --channel listed --upload-source-code dist/FlixMonkey-source.zip --approval-timeout 0` (reads `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET` from env).

- [ ] **Step 1: Install the pinned CLIs as devDependencies**

Run:

```bash
npm install --save-dev chrome-webstore-upload-cli@^4.0.1 web-ext@^10.4.0
```

Expected: `package.json` gains both entries under `devDependencies` and `package-lock.json` is updated.

- [ ] **Step 2: Add the three npm scripts**

In `package.json`, add these keys to the `"scripts"` object (place them after `"build"` so build/publish scripts sit together):

```json
"package:source": "git archive --format=zip --output dist/FlixMonkey-source.zip HEAD",
"publish:chrome": "chrome-webstore-upload --source dist/chrome",
"publish:firefox": "web-ext sign --source-dir dist/firefox --channel listed --upload-source-code dist/FlixMonkey-source.zip --approval-timeout 0",
```

- [ ] **Step 3: Ignore web-ext's artifact directory**

In `.gitignore`, under the `# Node.js` group (after the `dist/` line), add:

```
web-ext-artifacts/
```

- [ ] **Step 4: Create the reviewer/credentials doc**

Create `docs/STORE_PUBLISHING.md` with this content:

````markdown
# Store Publishing

FlixMonkey is published automatically to the Chrome Web Store and Firefox
Add-ons (AMO) by the `Publish to Stores` GitHub Actions workflow
(`.github/workflows/publish-stores.yml`) after release-please cuts a release.

This document covers the one-time credential setup and the AMO source-code
build instructions.

## Build instructions (for AMO reviewers)

The submitted code is bundled by Rollup, so AMO requires the human-readable
source. To reproduce `dist/firefox/` from the accompanying source archive:

```bash
npm ci            # Node.js >= 24
npm run build:firefox
```

The built extension is written to `dist/firefox/`.

## Required repository secrets

### Chrome Web Store

| Secret                 | Where to get it                                          |
| ---------------------- | -------------------------------------------------------- |
| `CHROME_EXTENSION_ID`  | The item ID on the Chrome Web Store Developer Dashboard. |
| `CHROME_PUBLISHER_ID`  | The publisher ID in the dashboard account settings.      |
| `CHROME_CLIENT_ID`     | OAuth2 client ID (see below).                            |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret (see below).                        |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token (see below).                        |

To obtain the OAuth2 credentials:

1. In the Google Cloud Console, create or reuse a project and enable the
   **Chrome Web Store API**.
2. Configure the OAuth consent screen, then create an OAuth2 client of type
   **Desktop app**. Record the client ID and secret.
3. Mint a refresh token by completing the consent flow once. The simplest
   path is the helper documented by `chrome-webstore-upload`:
   <https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md>

### Firefox AMO

| Secret           | Where to get it                                  |
| ---------------- | ------------------------------------------------ |
| `AMO_JWT_ISSUER` | API key (JWT issuer) from addons.mozilla.org.    |
| `AMO_JWT_SECRET` | API secret (JWT secret) from addons.mozilla.org. |

Generate both at <https://addons.mozilla.org/developers/addon/api/key/>
(Manage API Keys). The add-on's stable ID is already set in
`src/targets/firefox/manifest.json` as `browser_specific_settings.gecko.id`
(`flixmonkey@fran`); AMO uses it to match version updates to the listing.
````

- [ ] **Step 5: Verify the scripts resolve and the source archive builds**

Run:

```bash
npx chrome-webstore-upload --version
npx web-ext --version
npm run build:firefox
npm run package:source
unzip -l dist/FlixMonkey-source.zip | grep -E "src/|package.json" | head
```

Expected: both `--version` calls print a version; `dist/FlixMonkey-source.zip` is created and its listing includes `package.json` and files under `src/`.

- [ ] **Step 6: Format and commit**

Run:

```bash
npm run format
git add package.json package-lock.json .gitignore docs/STORE_PUBLISHING.md
git commit -m "build: add store-publishing CLIs, scripts, and docs"
```

---

## Task 2: Emit a release-info artifact from release-please

**Files:**

- Modify: `.github/workflows/release-please.yml`

**Interfaces:**

- Produces: a workflow artifact named `release-info` containing `release-tag.txt` (a single line: the release tag, e.g. `v1.0.2`). Consumed by `resolve-release` in Task 3. The artifact is uploaded only when `steps.release.outputs.release_created` is true, so its absence signals "no release was cut".

- [ ] **Step 1: Add the artifact steps after "Upload to Release"**

In `.github/workflows/release-please.yml`, after the existing `Upload to Release` step (the last step in the `release-please` job), add:

```yaml
- name: Write release info
  if: ${{ steps.release.outputs.release_created }}
  run: echo "${{ steps.release.outputs.tag_name }}" > release-tag.txt
- name: Upload release info
  if: ${{ steps.release.outputs.release_created }}
  uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
  with:
      name: release-info
      path: release-tag.txt
      retention-days: 1
```

- [ ] **Step 2: Verify the YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release-please.yml')); print('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Format and commit**

Run:

```bash
npm run format
git add .github/workflows/release-please.yml
git commit -m "ci: emit release-info artifact when a release is cut"
```

---

## Task 3: Create the publish-stores workflow

**Files:**

- Create: `.github/workflows/publish-stores.yml`

**Interfaces:**

- Consumes: the `release-info` artifact from Task 2; the npm scripts from Task 1; repository secrets `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`.

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/publish-stores.yml` with this exact content:

```yaml
name: Publish to Stores

on:
    workflow_run:
        workflows: ['Release Please']
        types: [completed]
    workflow_dispatch:
        inputs:
            tag:
                description: 'Release tag to publish (e.g. v1.0.2)'
                required: true
                type: string

permissions:
    contents: read
    actions: read

jobs:
    resolve-release:
        runs-on: ubuntu-latest
        timeout-minutes: 5
        if: >-
            github.event_name == 'workflow_dispatch' ||
            github.event.workflow_run.conclusion == 'success'
        outputs:
            tag: ${{ steps.info.outputs.tag }}
            skip: ${{ steps.info.outputs.skip }}
        steps:
            - name: Resolve release tag
              id: info
              env:
                  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  GH_REPO: ${{ github.repository }}
                  RUN_ID: ${{ github.event.workflow_run.id }}
                  DISPATCH_TAG: ${{ github.event.inputs.tag }}
              run: |
                  if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
                      echo "tag=$DISPATCH_TAG" >> "$GITHUB_OUTPUT"
                      echo "skip=false" >> "$GITHUB_OUTPUT"
                      exit 0
                  fi
                  if gh run download "$RUN_ID" --name release-info --dir release-info; then
                      tag="$(cat release-info/release-tag.txt)"
                      echo "Publishing tag $tag"
                      echo "tag=$tag" >> "$GITHUB_OUTPUT"
                      echo "skip=false" >> "$GITHUB_OUTPUT"
                  else
                      echo "No release-info artifact found; no release was cut. Skipping."
                      echo "skip=true" >> "$GITHUB_OUTPUT"
                  fi

    publish-chrome:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        needs: resolve-release
        if: needs.resolve-release.outputs.skip != 'true'
        steps:
            - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
              with:
                  ref: ${{ needs.resolve-release.outputs.tag }}
            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
              with:
                  node-version: '24'
                  cache: 'npm'
            - run: npm ci --ignore-scripts
            - run: npm rebuild sharp
            - run: npm run build:chrome
            - name: Publish to Chrome Web Store
              run: npm run publish:chrome
              env:
                  EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
                  PUBLISHER_ID: ${{ secrets.CHROME_PUBLISHER_ID }}
                  CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
                  CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
                  REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}

    publish-firefox:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        needs: resolve-release
        if: needs.resolve-release.outputs.skip != 'true'
        steps:
            - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
              with:
                  ref: ${{ needs.resolve-release.outputs.tag }}
            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
              with:
                  node-version: '24'
                  cache: 'npm'
            - run: npm ci --ignore-scripts
            - run: npm rebuild sharp
            - run: npm run build:firefox
            - run: npm run package:source
            - name: Publish to Firefox Add-ons
              run: npm run publish:firefox
              env:
                  WEB_EXT_API_KEY: ${{ secrets.AMO_JWT_ISSUER }}
                  WEB_EXT_API_SECRET: ${{ secrets.AMO_JWT_SECRET }}
```

- [ ] **Step 2: Verify the YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish-stores.yml')); print('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Lint the workflow with actionlint**

Run:

```bash
docker run --rm -v "$(pwd):/repo" --workdir /repo rhysd/actionlint:latest -color || npx --yes @rhysd/actionlint .github/workflows/publish-stores.yml || echo "actionlint unavailable, skipping"
```

Expected: no errors reported for `publish-stores.yml` (or a clean "skipping" message if actionlint cannot run in this environment).

- [ ] **Step 4: Format and commit**

Run:

```bash
npm run format
git add .github/workflows/publish-stores.yml
git commit -m "ci: add automated Chrome and Firefox store publishing"
```

---

## Task 4: Link the publishing doc from CONTRIBUTING

**Files:**

- Modify: `CONTRIBUTING.md`

**Interfaces:**

- Consumes: `docs/STORE_PUBLISHING.md` from Task 1.

- [ ] **Step 1: Read CONTRIBUTING.md to find the right section**

Run:

```bash
grep -niE "release|publish|store|## " CONTRIBUTING.md | head -40
```

Expected: locates a releases/maintainer section (or the end of the file) to attach the link.

- [ ] **Step 2: Add a Store publishing reference**

Add a short subsection to `CONTRIBUTING.md` near the release/maintainer content (or as a new top-level section if none exists):

```markdown
## Store publishing

Releases are published automatically to the Chrome Web Store and Firefox
Add-ons by the `Publish to Stores` workflow. For the required repository
secrets and the AMO source-build instructions, see
[docs/STORE_PUBLISHING.md](docs/STORE_PUBLISHING.md).
```

- [ ] **Step 3: Format and commit**

Run:

```bash
npm run format
git add CONTRIBUTING.md
git commit -m "docs: link store publishing setup from CONTRIBUTING"
```

---

## Post-Implementation (manual, by maintainer)

These cannot be done in code and are tracked here as a handoff checklist:

- [ ] Add the seven repository secrets listed in `docs/STORE_PUBLISHING.md`.
- [ ] After the secrets exist, validate end-to-end with a manual run:
      `Actions -> Publish to Stores -> Run workflow`, supplying an existing
      release tag (e.g. the latest `vX.Y.Z`). Confirm both store jobs succeed and
      the new version appears as "in review" in each dashboard.

---

## Self-Review Notes

- **Spec coverage:** trigger handshake (Task 2 + Task 3 resolve-release), parallel jobs + tag checkout + rebuild (Task 3), Chrome auto-publish (Task 3 + Task 1 script), Firefox listed sign + source archive (Task 1 `package:source`/`publish:firefox` + Task 3), credential docs (Task 1 doc + Task 4 link), failure isolation (independent jobs, re-runnable via `workflow_dispatch`). The two spec "verification items" are resolved: `web-ext` exposes `--upload-source-code`, and `gecko.id` is already set so no manifest task is needed.
- **Deviation from spec:** the Chrome CLI requires a `PUBLISHER_ID`, so this plan adds a fifth Chrome secret (`CHROME_PUBLISHER_ID`) beyond the spec's four. Documented in `docs/STORE_PUBLISHING.md`.
- **Type/name consistency:** the `release-info` artifact name, `release-tag.txt` filename, the `skip`/`tag` job outputs, the env-var names (`EXTENSION_ID`, `WEB_EXT_API_KEY`, etc.), and the npm script names are identical across Tasks 1, 2, and 3.
