# Greasy Fork Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a one-shot Greasy Fork verification job to the manual store publishing workflow and document the one-time release-sync setup.

**Architecture:** Greasy Fork has no publish API. A GitHub `release` webhook makes Greasy Fork pull `FlixMonkey.user.js` from the release asset. The new `publish-greasyfork` job fetches the Greasy Fork metadata once and compares its `@version` to the tag. It does not download the release asset. It never triggers the sync and never retries.

**Tech Stack:** GitHub Actions, `curl`, Bash, Markdown.

**Spec:** [`docs/superpowers/specs/2026-10-29-greasyfork-publishing-design.md`](../specs/2026-10-29-greasyfork-publishing-design.md)

## Global Constraints

- Greasy Fork has no upload or publish API. Use release webhook sync only.
- The Greasy Fork sync URL must be `https://github.com/fran2889/flix-monkey/releases/latest/download/FlixMonkey.user.js`.
- The release asset name must stay `FlixMonkey.user.js`.
- `GREASYFORK_SCRIPT_ID` is a repository variable, not a secret.
- The new job is read-only and uses only the preinstalled `curl`. It needs no checkout, GitHub token, Node, or `npm ci`.
- Check Greasy Fork once. No polling, no retries.
- Keep all actions SHA-pinned and make the workflow pass `actionlint`.
- Do not change `src/targets/userscript/metadata.ts`, the README, or the existing Chrome and Firefox jobs.
- Docs prose: no em-dashes, use a colon, a semicolon, or two sentences. Use the Oxford comma. ASCII only.
- Conventional Commits: `ci(github): ...` for the workflow, `docs: ...` for documentation.

## Review Focus

- Unset `GREASYFORK_SCRIPT_ID`: the job must fail with the variable name before contacting Greasy Fork.
- `@version` with tabs, extra spaces, or CRLF in the Greasy Fork metadata: the parser must still return the bare version.
- Greasy Fork unreachable or returning non-2xx: the job must fail with curl's error, not a misleading version mismatch.
- Stale Greasy Fork version after a missed webhook: the job must print both versions and tell the maintainer what to check.
- The job checks the listing only. A missing or renamed release asset is outside
  its scope and appears as a version mismatch.

## File Structure

- Modify: `.github/workflows/publish-to-stores.yml` (append one job after `publish-firefox`)
- Modify: `docs/STORE_PUBLISHING.md` (intro, overview, variables, setup, publishing steps, failure handling)
- Modify: `CONTRIBUTING.md` (store-publishing pointer)
- Modify: `AGENTS.md` (Releases section)

---

### Task 1: Add the `publish-greasyfork` job

**Files:**

- Modify: `.github/workflows/publish-to-stores.yml` (append after the last line of the `publish-firefox` job)

**Interfaces:**

- Consumes: the `tag` workflow input and the repository variable `GREASYFORK_SCRIPT_ID`.
- Produces: a job named `publish-greasyfork` that exits 0 only when the Greasy Fork listing matches the tag version.

- [x] **Step 1: Append the job to the workflow**

Add this block at the end of `.github/workflows/publish-to-stores.yml`, after the `publish-firefox` job:

<!-- prettier-ignore -->
```yaml
    publish-greasyfork:
        runs-on: ubuntu-latest
        timeout-minutes: 5
        steps:
            - name: Validate release tag format
              env:
                  TAG: ${{ inputs.tag }}
              run: |
                  if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                      echo "Invalid tag: '$TAG'." >&2
                      echo "Expected vMAJOR.MINOR.PATCH, for example v1.7.0." >&2
                      exit 1
                  fi
            - name: Verify Greasy Fork serves the released version
              env:
                  TAG: ${{ inputs.tag }}
                  SCRIPT_ID: ${{ vars.GREASYFORK_SCRIPT_ID }}
              run: |
                  set -euo pipefail
                  expected="${TAG#v}"
                  if [[ -z "$SCRIPT_ID" ]]; then
                      echo "GREASYFORK_SCRIPT_ID is not set. See docs/STORE_PUBLISHING.md." >&2
                      exit 1
                  fi
                  meta_url="https://update.greasyfork.org/scripts/$SCRIPT_ID.meta.js"
                  if ! meta="$(curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-time 30 -H 'Cache-Control: no-cache' "$meta_url")"; then
                      echo "Could not fetch $meta_url." >&2
                      exit 1
                  fi
                  greasyfork_version="$(printf '%s\n' "$meta" | sed -n 's|^[[:space:]]*//[[:space:]]*@version[[:space:]]*||p' | head -n 1 | tr -d '\r')"
                  if [[ -z "$greasyfork_version" ]]; then
                      echo "Greasy Fork returned no @version from $meta_url." >&2
                      exit 1
                  fi
                  if [[ "$greasyfork_version" != "$expected" ]]; then
                      echo "Greasy Fork serves version '$greasyfork_version', expected '$expected'." >&2
                      echo "Check the release asset, the webhook delivery, and the listing sync URL, then re-run this job." >&2
                      exit 1
                  fi
                  echo "Greasy Fork serves version $expected."
```

- [x] **Step 2: Lint the workflow**

Run:

```bash
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/publish-to-stores.yml
```

Expected: exit 0, no output. If Go is unavailable, use an installed `actionlint` 1.7.12 or let the CI lint gate run it.

- [x] **Step 3: Verify the parser against tabs and CRLF**

Run:

```bash
printf '// ==UserScript==\r\n//\t@version\t1.7.0\r\n// ==/UserScript==\r\n' > /tmp/greasyfork-check/crlf.meta.js
sed -n 's|^[[:space:]]*//[[:space:]]*@version[[:space:]]*||p' /tmp/greasyfork-check/crlf.meta.js | head -n 1 | tr -d '\r'
```

Expected output: `1.7.0`.

- [x] **Step 4: Verify the unset-variable failure**

Copy the `run` block from `Verify Greasy Fork serves the released version` into `/tmp/greasyfork-check/check.sh`, then run:

```bash
cd /tmp/greasyfork-check
TAG=v1.7.0 SCRIPT_ID= bash check.sh
```

Expected: exit 1 and `GREASYFORK_SCRIPT_ID is not set. See docs/STORE_PUBLISHING.md.` The command must fail before contacting Greasy Fork.

- [x] **Step 5: Verify the non-2xx failure path**

Run:

```bash
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-time 30 https://update.greasyfork.org/scripts/0.meta.js
```

Expected: non-zero exit. This confirms that `--fail` turns a Greasy Fork error
response into a failed step instead of an empty version. If the network blocks
Greasy Fork, note it and rely on the live rollout check in Task 4.

- [x] **Step 6: Commit**

```bash
git add .github/workflows/publish-to-stores.yml
git commit -m "ci(github): verify Greasy Fork in the store publish workflow"
```

---

### Task 2: Document the Greasy Fork setup and behavior

**Files:**

- Modify: `docs/STORE_PUBLISHING.md`
- Modify: `CONTRIBUTING.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Consumes: the job name `publish-greasyfork` and the variable `GREASYFORK_SCRIPT_ID` from Task 1.
- Produces: a runbook a maintainer can follow to create the listing, set the variable, and add the webhook.

- [x] **Step 1: Replace the intro and artifact list in `docs/STORE_PUBLISHING.md`**

Replace the paragraph beginning `FlixMonkey is published to the Chrome Web Store` through the artifact list with:

```markdown
FlixMonkey is published to the Chrome Web Store, Firefox Add-ons (AMO), and
Greasy Fork. Chrome and Firefox are published by the `Publish to Stores` GitHub
Actions workflow
([`.github/workflows/publish-to-stores.yml`](../.github/workflows/publish-to-stores.yml)).
Greasy Fork is synced from the GitHub Release by a repository webhook, and the
same workflow verifies that the listing serves the released version. Publishing
is a **manual deployment**: a maintainer runs the workflow for a chosen release
tag, and it reuses the artifacts already attached to that GitHub Release (no
rebuild). A release must therefore exist, with its artifacts attached, before it
can be published.

The published artifacts are:

- Chrome: `FlixMonkey-v<version>-chrome.zip`
- Firefox: `FlixMonkey-v<version>-firefox.xpi` and `FlixMonkey-v<version>-source.zip`
- Userscript: `FlixMonkey.user.js`, synced to Greasy Fork from the same release
```

- [x] **Step 2: Replace the overview paragraph**

Replace the `## Overview` paragraph with:

```markdown
## Overview

The `Publish to Stores` workflow is triggered manually via `workflow_dispatch`
and requires a tag input. It downloads the pre-built artifacts from the specified
GitHub Release and publishes the Chrome and Firefox builds. It also checks that
the Greasy Fork listing serves the same version. The listing itself is updated by
the repository's GitHub `release` webhook, not by this workflow. No code is built
during this workflow; it only handles the store upload and verification process.
```

- [x] **Step 3: Add the variable and setup sections**

Insert after the Firefox Add-ons secrets table and before `## Build Instructions for Store Reviewers`:

```markdown
## Required Repository Variables

### Greasy Fork

| Variable               | Where to get it                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GREASYFORK_SCRIPT_ID` | The numeric script ID in the listing URL: `https://greasyfork.org/en/scripts/<id>-...`. Store it as a repository **variable**, not a secret. |

Greasy Fork has no publish API. The listing is created once and then synced from
the GitHub Release.

## Greasy Fork Setup

Greasy Fork is updated by a repository webhook, not by the publish workflow.

1. On Greasy Fork, open <https://greasyfork.org/en/import> and import
   `https://github.com/fran2889/flix-monkey/releases/latest/download/FlixMonkey.user.js`.
   Keep the default `Automatic` sync type. The first release webhook changes the
   listing to `Webhook` sync.
2. Copy the numeric script ID from the listing URL
   (`https://greasyfork.org/en/scripts/<id>-...`) and store it as the repository
   variable `GREASYFORK_SCRIPT_ID`.
3. Open <https://greasyfork.org/en/users/webhook-info>, note the payload URL, and
   generate the webhook secret.
4. In the GitHub repository, open **Settings** > **Webhooks** > **Add webhook**.
   Set the payload URL, the content type `application/json`, and the generated
   secret. Choose **Let me select individual events**, uncheck **Pushes**, and
   check **Releases**. Leave the webhook active.
5. Confirm the ping delivery succeeds.
```

- [x] **Step 4: Replace the publishing steps**

Replace the `## Publishing New Versions` list with:

```markdown
## Publishing New Versions

1. Merge the release-please PR (e.g., `chore(main): release 1.0.0`).
   release-please creates the `v1.0.0` tag and a draft GitHub Release, then the
   `Release Please` workflow builds and attaches the store artifacts
   (`FlixMonkey-v1.0.0-chrome.zip`, `FlixMonkey-v1.0.0-firefox.xpi`,
   `FlixMonkey-v1.0.0-source.zip`, and `FlixMonkey.user.js`) and publishes the
   release. Publishing the release triggers the Greasy Fork webhook.
2. Wait for the `Release Please` workflow to finish successfully.
3. Navigate to **Actions** > **Publish to Stores** in the GitHub repository.
4. Click **Run workflow**.
5. Select the release tag to publish.
6. Click **Run workflow**.

The workflow uploads the Chrome and Firefox artifacts in parallel and checks the
Greasy Fork version once. The Greasy Fork check does not poll or retry.
```

- [x] **Step 5: Add the failure-handling section**

Insert after the publishing steps and before `## Updating Store Metadata`:

```markdown
## Failure Handling

- The job checks the Greasy Fork listing only. It does not download or inspect
  the release asset, so a missing or wrong asset is reported as a version
  mismatch. Check the release asset if the listing is stale.
- An unset `GREASYFORK_SCRIPT_ID` fails the job with the variable name.
- If Greasy Fork is unreachable or returns an error, the job fails with the
  endpoint and curl's error.
- If Greasy Fork serves a different version, the job prints both versions. Check
  the release asset, the webhook delivery, and the listing sync URL, then re-run
  only that job.
- The job checks once. It does not poll or retry.
```

- [x] **Step 6: Update the `CONTRIBUTING.md` pointer**

Replace the store-publishing paragraph with:

```markdown
Store publishing is a separate manual deployment from the GitHub release. See
[docs/STORE_PUBLISHING.md](docs/STORE_PUBLISHING.md) for the workflow, required
secrets, Greasy Fork webhook setup, and AMO source-build instructions.
```

- [x] **Step 7: Update the `AGENTS.md` Releases paragraph**

In the `### Releases` section, replace the final sentence about store publishing with:

```markdown
Publishing to the Chrome Web Store and Firefox Add-ons is a separate manual step:
`.github/workflows/publish-to-stores.yml` is `workflow_dispatch` only and
downloads the attached assets for the chosen tag. Greasy Fork is updated by the
repository's GitHub `release` webhook, and the workflow's `publish-greasyfork`
job verifies that the listing serves the released version.
```

- [x] **Step 8: Check the Markdown formatting**

Run:

```bash
npx prettier --check CONTRIBUTING.md AGENTS.md docs/STORE_PUBLISHING.md
```

Expected: all three files pass. If a file is reported, run
`npx prettier --write CONTRIBUTING.md AGENTS.md docs/STORE_PUBLISHING.md` and
re-run the check.

- [x] **Step 9: Commit**

```bash
git add docs/STORE_PUBLISHING.md CONTRIBUTING.md AGENTS.md
git commit -m "docs: document Greasy Fork publishing"
```

---

### Task 3: Final verification

**Files:** none.

- [x] **Step 1: Lint the workflow**

Run:

```bash
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/publish-to-stores.yml
```

Expected: exit 0.

- [x] **Step 2: Check formatting and whitespace**

Run:

```bash
npx prettier --check CONTRIBUTING.md AGENTS.md docs/STORE_PUBLISHING.md
git diff --check
```

Expected: Prettier passes, and `git diff --check` prints nothing.

- [x] **Step 3: Confirm the existing store jobs are unchanged**

Run:

```bash
git diff HEAD~2 -- .github/workflows/publish-to-stores.yml
```

Expected: the only change is the appended `publish-greasyfork` job. The
`publish-chrome` and `publish-firefox` jobs are untouched.

- [x] **Step 4: Confirm the tree is clean and the commits are present**

Run:

```bash
git status --short
git log --oneline -3
```

Expected: `git status --short` prints nothing. The log shows the workflow commit
and the docs commit.

---

### Task 4: Manual rollout (maintainer)

**Files:** none. This task needs GitHub and Greasy Fork access.

- [ ] **Step 1: Create the Greasy Fork listing**

Import
`https://github.com/fran2889/flix-monkey/releases/latest/download/FlixMonkey.user.js`
at <https://greasyfork.org/en/import>. Keep the default `Automatic` sync type.

- [ ] **Step 2: Set the repository variable**

Copy the numeric script ID from the listing URL and set `GREASYFORK_SCRIPT_ID` as
a repository variable.

- [ ] **Step 3: Add the GitHub webhook**

On <https://greasyfork.org/en/users/webhook-info>, generate the secret and note
the payload URL. Add a repository webhook with content type `application/json`,
that secret, and only the `Releases` event. Confirm the ping delivery succeeds.

- [ ] **Step 4: Verify the current listing version**

Open `https://update.greasyfork.org/scripts/<id>.meta.js` and confirm it shows
the `@version` of the latest release. The first release after the webhook is
configured will move the listing to `Webhook` sync.

- [ ] **Step 5: Verify the stale-version path without touching the stores**

Run the check script from Task 1 against an older tag and the real script ID:

```bash
cd /tmp/greasyfork-check
TAG=v1.6.0 SCRIPT_ID=<real-id> bash check.sh
```

Expected: exit 1 with `Greasy Fork serves version '1.7.0', expected '1.6.0'.`
Adjust the versions if the listing is not at `1.7.0` when this runs. Do not run
the full publish workflow for an old tag, because it would also try to publish
the old Chrome and Firefox builds.

- [ ] **Step 6: Confirm on the next release**

After the next release and `Publish to Stores` run, confirm the
`publish-greasyfork` job passes. If it fails, check the release asset, the webhook
delivery, and the listing sync URL before changing the endpoint.
