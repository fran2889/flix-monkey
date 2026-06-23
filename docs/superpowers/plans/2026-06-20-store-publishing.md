# Store Publishing (Manual, Artifact-Reuse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a chosen FlixMonkey release to the Chrome Web Store and Firefox Add-ons (AMO) as a manual deployment that reuses the exact artifacts already attached to that GitHub Release, with no rebuild.

**Architecture:** release-please is the single place artifacts are produced: when it cuts a release it builds the Chrome `.zip`, Firefox `.xpi`, userscript `.user.js`, and a `git archive` source `.zip`, and attaches all four to the GitHub Release. The `publish-stores.yml` workflow is `workflow_dispatch`-only: a maintainer supplies a release tag, and two parallel jobs `gh release download` the relevant artifacts and push them to each store with version-pinned CLIs invoked inline. Chrome serves the uploaded zip byte-for-byte; Firefox resubmits the released `.xpi` content unchanged (AMO re-signs server-side).

**Tech Stack:** GitHub Actions, Node.js 24, npm, `chrome-webstore-upload-cli`, Mozilla `web-ext`, `gh` CLI, `git archive`, `unzip`.

## Starting State (already in the repo)

These were implemented under the previous (automatic) design and are reused as-is:

- `chrome-webstore-upload-cli@^4.0.1` and `web-ext@^10.4.0` are in `devDependencies`.
- `package.json` has `package:source` (`git archive --format=zip --output dist/FlixMonkey-source.zip HEAD`; Task 1 versions this output filename). It also still has `publish:chrome` and `publish:firefox` scripts, which this plan removes.
- `.gitignore` ignores `web-ext-artifacts/`.
- `src/targets/firefox/manifest.json` sets `browser_specific_settings.gecko.id` (`flixmonkey@fran`); no manifest change needed.
- `docs/STORE_PUBLISHING.md` and a `## Store publishing` section in `CONTRIBUTING.md` exist but describe automatic publishing; this plan updates their wording.
- `publish-stores.yml` is already `workflow_dispatch`-only but still rebuilds from the tag; this plan converts it to download-and-publish.
- `release-please.yml` already builds and uploads `dist/*.zip dist/*.xpi dist/*.user.js`; this plan adds the source archive.

## Global Constraints

- **Node.js:** `>= 24`. Workflows pin `node-version: '24'`.
- **Pinned actions:** every third-party GitHub Action is pinned to a commit SHA with a trailing `# vN` comment. Reuse the SHAs already in the repo:
    - `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6`
    - `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6`
- **Artifact names:** the build writes `dist/FlixMonkey-v<version>-chrome.zip` and `dist/FlixMonkey-v<version>-firefox.xpi`; the release tag is `v<version>`, so the filename for a tag `$TAG` is `FlixMonkey-$TAG-chrome.zip` / `FlixMonkey-$TAG-firefox.xpi`. The source archive is versioned to match: `package:source` writes `dist/FlixMonkey-v<version>-source.zip` (= `FlixMonkey-$TAG-source.zip`).
- **Chrome CLI:** `chrome-webstore-upload` with **no subcommand** both uploads and publishes; `--source` accepts a zip file. Required env: `EXTENSION_ID`, `PUBLISHER_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.
- **Firefox CLI:** `web-ext sign` takes `--source-dir` (a directory, not a prebuilt package), `--channel listed`, `--upload-source-code <zip>`, `--approval-timeout 0` (do not block on human approval). Required env: `WEB_EXT_API_KEY` (from `AMO_JWT_ISSUER`), `WEB_EXT_API_SECRET` (from `AMO_JWT_SECRET`).
- **Conventional Commits:** `type(scope)?: description`, imperative mood, lowercase, no trailing period. Allowed types include `ci`, `build`, `docs`, `chore`.
- **Prose style:** no em-dashes (use a colon, a semicolon, or two sentences); use the Oxford comma.
- **Formatting:** Prettier formats `*.{json,md,yml,html}`. Run `npm run format` before committing; the Husky pre-commit hook also runs `lint-staged`.
- **License headers:** required only for files under `src/` and `tests/`. No file in this plan is under those paths, so no GPL header is needed.

---

## File Structure

- `package.json` (modify): remove `publish:chrome` and `publish:firefox` scripts; keep `package:source` and version its output filename (`FlixMonkey-v<version>-source.zip`); keep the two devDependencies.
- `.github/workflows/release-please.yml` (modify): build and attach the source archive to the Release.
- `.github/workflows/publish-stores.yml` (modify): download the released artifacts and push to the stores; no rebuild; CLIs inlined.
- `docs/STORE_PUBLISHING.md` (modify): describe manual, artifact-reuse publishing.
- `CONTRIBUTING.md` (modify): update the `## Store publishing` wording.

---

## Task 1: Remove the publish npm scripts and version the source archive

**Files:**

- Modify: `package.json` (`scripts`)

**Interfaces:**

- Produces: a `package.json` whose `scripts` no longer contains `publish:chrome` or `publish:firefox`. `package:source` remains and now writes `dist/FlixMonkey-v<version>-source.zip` (the version in the filename matches the extension archives); it is consumed by `release-please.yml` (Task 2). The `chrome-webstore-upload` and `web-ext` binaries remain available via `devDependencies` for `npx` calls in `publish-stores.yml` (Task 3).

- [x] **Step 1: Remove the two publish scripts**

In `package.json`, delete these two lines from the `"scripts"` object (leave `package:source` and everything else intact):

```json
"publish:chrome": "chrome-webstore-upload --source dist/chrome",
"publish:firefox": "web-ext sign --source-dir dist/firefox --channel listed --upload-source-code dist/FlixMonkey-source.zip --approval-timeout 0",
```

- [x] **Step 2: Version the source-archive filename**

In `package.json`, update the `package:source` script so its output carries the version, matching the extension archives (`FlixMonkey-v<version>-chrome.zip` / `-firefox.xpi`):

```json
"package:source": "git archive --format=zip --output dist/FlixMonkey-v$npm_package_version-source.zip HEAD",
```

npm exposes the package version to scripts as `$npm_package_version`; since the release tag is `v<version>`, the output filename equals `FlixMonkey-$TAG-source.zip`.

- [x] **Step 3: Verify the scripts are correct and the source archive is versioned**

Run:

```bash
node -e "const s=require('./package.json').scripts; if(s['publish:chrome']||s['publish:firefox']){console.error('still present');process.exit(1)}; if(!s['package:source']){console.error('package:source missing');process.exit(1)}; console.log('ok')"
npx --no-install chrome-webstore-upload --version
npx --no-install web-ext --version
rm -f dist/FlixMonkey-*source.zip && npm run package:source && ls dist/FlixMonkey-v*-source.zip
```

Expected: prints `ok`, then a version number from each CLI, then the listing shows `dist/FlixMonkey-v<version>-source.zip` (the version is in the filename).

- [x] **Step 4: Format and commit**

Run:

```bash
npm run format
git add package.json
git commit -m "build: drop publish npm scripts and version the source archive"
```

---

## Task 2: Attach the source archive to the GitHub Release

**Files:**

- Modify: `.github/workflows/release-please.yml`

**Interfaces:**

- Produces: when release-please cuts a release, `dist/FlixMonkey-v<version>-source.zip` is built and uploaded to the Release alongside the existing `dist/*.zip dist/*.xpi dist/*.user.js`. Consumed by the Firefox job in Task 3.

The current job ends with the `Upload to Release` step:

```yaml
- name: Upload to Release
  if: ${{ steps.release.outputs.release_created }}
  run: gh release upload "${{ steps.release.outputs.tag_name }}" dist/*.zip dist/*.xpi dist/*.user.js
  env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [x] **Step 1: Build the source archive before the upload**

In `.github/workflows/release-please.yml`, insert a new step **immediately before** the `Upload to Release` step (after `Build artifacts`):

```yaml
- name: Build source archive
  if: ${{ steps.release.outputs.release_created }}
  run: npm run package:source
```

`npm run package:source` writes `dist/FlixMonkey-v<version>-source.zip`, which the existing `dist/*.zip` glob in `Upload to Release` then picks up alongside the Chrome zip. No change to the upload line is required.

- [x] **Step 2: Verify the YAML parses and the source step precedes the upload**

Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release-please.yml')); print('ok')"
grep -n "package:source\|Upload to Release" .github/workflows/release-please.yml
```

Expected: prints `ok`; the `Build source archive` / `package:source` line appears at a lower line number than `Upload to Release`.

- [x] **Step 3: Verify the source archive actually builds locally**

Run:

```bash
npm run package:source
unzip -l dist/FlixMonkey-v*-source.zip | grep -E "src/|package.json" | head
```

Expected: `dist/FlixMonkey-v<version>-source.zip` is created and its listing includes `package.json` and files under `src/`.

- [x] **Step 4: Format and commit**

Run:

```bash
npm run format
git add .github/workflows/release-please.yml
git commit -m "ci: attach source archive to the github release"
```

---

## Task 3: Convert publish-stores.yml to download-and-publish

**Files:**

- Modify: `.github/workflows/publish-stores.yml`

**Interfaces:**

- Consumes: the Release artifacts from Task 2 (`FlixMonkey-$TAG-chrome.zip`, `FlixMonkey-$TAG-firefox.xpi`, `FlixMonkey-$TAG-source.zip`); the `chrome-webstore-upload` / `web-ext` devDependencies from Task 1; repository secrets `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`.

- [x] **Step 1: Replace the workflow file**

Overwrite `.github/workflows/publish-stores.yml` with this exact content:

```yaml
name: Publish to Stores

on:
    workflow_dispatch:
        inputs:
            tag:
                description: 'Release tag to publish (e.g. v1.0.2)'
                required: true
                type: string

permissions:
    contents: read

jobs:
    publish-chrome:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        steps:
            - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
              with:
                  ref: ${{ inputs.tag }}
            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
              with:
                  node-version: '24'
                  cache: 'npm'
            - run: npm ci --ignore-scripts
            - name: Download Chrome artifact from release
              env:
                  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  TAG: ${{ inputs.tag }}
              run: gh release download "$TAG" --pattern "FlixMonkey-$TAG-chrome.zip" --dir dist
            - name: Publish to Chrome Web Store
              env:
                  TAG: ${{ inputs.tag }}
                  EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
                  PUBLISHER_ID: ${{ secrets.CHROME_PUBLISHER_ID }}
                  CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
                  CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
                  REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
              run: npx --no-install chrome-webstore-upload --source "dist/FlixMonkey-$TAG-chrome.zip"

    publish-firefox:
        runs-on: ubuntu-latest
        timeout-minutes: 10
        steps:
            - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
              with:
                  ref: ${{ inputs.tag }}
            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
              with:
                  node-version: '24'
                  cache: 'npm'
            - run: npm ci --ignore-scripts
            - name: Download Firefox artifacts from release
              env:
                  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
                  TAG: ${{ inputs.tag }}
              run: gh release download "$TAG" --pattern "FlixMonkey-$TAG-firefox.xpi" --pattern "FlixMonkey-$TAG-source.zip" --dir dist
            - name: Unpack the released add-on
              env:
                  TAG: ${{ inputs.tag }}
              run: |
                  mkdir -p dist/firefox
                  unzip -o "dist/FlixMonkey-$TAG-firefox.xpi" -d dist/firefox
            - name: Publish to Firefox Add-ons
              env:
                  TAG: ${{ inputs.tag }}
                  WEB_EXT_API_KEY: ${{ secrets.AMO_JWT_ISSUER }}
                  WEB_EXT_API_SECRET: ${{ secrets.AMO_JWT_SECRET }}
              run: npx --no-install web-ext sign --source-dir dist/firefox --channel listed --upload-source-code "dist/FlixMonkey-$TAG-source.zip" --approval-timeout 0
```

- [x] **Step 2: Verify the YAML parses and the rebuild steps are gone**

Run:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish-stores.yml')); print('ok')"
grep -nE "build:chrome|build:firefox|rebuild sharp|workflow_run|resolve-release" .github/workflows/publish-stores.yml || echo "clean: no rebuild/handshake remnants"
grep -n "gh release download" .github/workflows/publish-stores.yml
```

Expected: prints `ok`; prints `clean: no rebuild/handshake remnants`; shows two `gh release download` lines.

- [x] **Step 3: Lint the workflow with actionlint (best effort)**

Run:

```bash
npx --yes @rhysd/actionlint .github/workflows/publish-stores.yml || echo "actionlint unavailable, skipping"
```

Expected: no errors reported for `publish-stores.yml` (or a clean "skipping" message if actionlint cannot run here).

- [x] **Step 4: Sanity-check the unzip+sign flow locally against a built add-on**

This rehearses the Firefox job's unpack step without contacting AMO. Run:

```bash
npm run build:firefox        # produces dist/FlixMonkey-v<version>-firefox.xpi
XPI=$(ls dist/FlixMonkey-v*-firefox.xpi | head -1)
rm -rf /tmp/ff-unpack && mkdir -p /tmp/ff-unpack
unzip -o "$XPI" -d /tmp/ff-unpack
test -f /tmp/ff-unpack/manifest.json && echo "unpack ok: manifest present"
```

Expected: `unpack ok: manifest present` (confirms the `.xpi` unzips into a valid `--source-dir` layout).

- [x] **Step 5: Format and commit**

Run:

```bash
npm run format
git add .github/workflows/publish-stores.yml
git commit -m "ci: publish stores by reusing release artifacts"
```

---

## Task 4: Update the docs to describe manual publishing

**Files:**

- Modify: `docs/STORE_PUBLISHING.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**

- Consumes: nothing. Documentation only; describes the workflow from Task 3.

- [x] **Step 1: Update the intro of `docs/STORE_PUBLISHING.md`**

Replace the opening paragraph (lines beginning "FlixMonkey is published automatically..." through "...after release-please cuts a release.") with:

```markdown
FlixMonkey is published to the Chrome Web Store and Firefox Add-ons (AMO) by the
`Publish to Stores` GitHub Actions workflow
(`.github/workflows/publish-stores.yml`). Publishing is a **manual deployment**:
a maintainer runs the workflow for a chosen release tag, and it reuses the
artifacts already attached to that GitHub Release (no rebuild). A release must
therefore exist, with its artifacts attached, before it can be published.
```

- [x] **Step 2: Update the AMO build-instructions note in `docs/STORE_PUBLISHING.md`**

The `## Build instructions (for AMO reviewers)` section stays accurate (`npm ci && npm run build:firefox` reproduces `dist/firefox/`). Immediately under its heading, add one clarifying sentence:

```markdown
The published add-on is the `.xpi` attached to the matching GitHub Release; the
accompanying `FlixMonkey-v<version>-source.zip` is this repository at the release tag.
```

- [x] **Step 3: Update the `## Store publishing` section in `CONTRIBUTING.md`**

Replace the paragraph under `## Store publishing` with:

```markdown
Releases are published to the Chrome Web Store and Firefox Add-ons by manually
running the `Publish to Stores` workflow for a chosen release tag; it reuses the
artifacts attached to that GitHub Release. For the required repository secrets
and the AMO source-build instructions, see
[docs/STORE_PUBLISHING.md](docs/STORE_PUBLISHING.md).
```

- [x] **Step 4: Verify no "automatic" wording remains**

Run:

```bash
grep -niE "automatic|after release-please cuts" docs/STORE_PUBLISHING.md CONTRIBUTING.md || echo "clean: no automatic-publishing wording"
```

Expected: prints `clean: no automatic-publishing wording`.

- [x] **Step 5: Format and commit**

Run:

```bash
npm run format
git add docs/STORE_PUBLISHING.md CONTRIBUTING.md
git commit -m "docs: describe manual store publishing and artifact reuse"
```

---

## Post-Implementation (manual, by maintainer)

These cannot be done in code and are tracked here as a handoff checklist:

- [x] Add the seven repository secrets listed in `docs/STORE_PUBLISHING.md` (`CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`).
- [x] Cut a release with release-please and confirm the Release carries all four artifacts (chrome `.zip`, firefox `.xpi`, userscript `.user.js`, `FlixMonkey-v<version>-source.zip`).
- [x] Validate end-to-end with a manual run: `Actions -> Publish to Stores -> Run workflow`, supplying that release tag. Confirm both store jobs succeed and the new version appears as "in review" in each dashboard.

---

## Self-Review Notes

- **Spec coverage:**
    - Manual `workflow_dispatch`-only trigger with a required `tag` input: Task 3.
    - Parallel, independently re-runnable Chrome/Firefox jobs; no rebuild: Task 3.
    - Reuse exact released artifacts via `gh release download`: Task 3 (download steps), enabled by Task 2 (source archive attached) and the existing release-please uploads.
    - Chrome upload+publish of the released zip; Firefox listed sign of the unpacked `.xpi` with the source archive: Task 3.
    - Inlined CLI commands, `publish:*` scripts removed, `package:source` kept: Task 1.
    - Credential/manual-process docs: Task 4 plus the existing `docs/STORE_PUBLISHING.md` secrets tables.
    - `gecko.id` prerequisite: already satisfied in the repo (no task needed).
- **Deviation from spec:** the Chrome CLI requires `PUBLISHER_ID`, so there is a fifth Chrome secret (`CHROME_PUBLISHER_ID`) beyond the spec's four; it is documented in `docs/STORE_PUBLISHING.md`. The spec's example `chrome-webstore-upload upload --auto-publish` was corrected: the CLI with no subcommand uploads and publishes, and there is no `--auto-publish` flag.
- **Type/name consistency:** the artifact filenames (`FlixMonkey-$TAG-chrome.zip`, `FlixMonkey-$TAG-firefox.xpi`, `FlixMonkey-$TAG-source.zip`), the env-var names (`EXTENSION_ID`, `PUBLISHER_ID`, `WEB_EXT_API_KEY`, etc.), the `$TAG` input, and the secret names are identical across Tasks 1 through 4 and match the spec.

```

```
