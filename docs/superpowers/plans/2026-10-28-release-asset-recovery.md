# Re-runnable Release Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Release Please workflow rebuild release assets from the tag and repair a failed draft when the workflow is re-run.

**Architecture:** Add one state step after release-please that resolves the tag and decides whether to build from `release_created` or `github.run_attempt`. The build path checks out the tag, verifies the version and the four expected artifacts, uploads with `--clobber`, and publishes only a draft release. The main working tree has unrelated staged docs, so all work happens in an isolated worktree.

**Tech Stack:** GitHub Actions YAML, `gh` CLI, npm scripts, actionlint, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md`

## Global Constraints

- Keep one job in `.github/workflows/release-please.yml`; add no workflow and no dispatch input.
- Every action stays pinned to its current commit SHA.
- Pass `tag` through `env` as `TAG`; never interpolate it directly into a `run` script.
- Build from the release tag, not from the branch head.
- Upload the four existing assets: `chrome.zip`, `firefox.xpi`, `source.zip`, and `FlixMonkey.user.js`.
- Repair happens only on a manual re-run. Do not add draft detection on normal pushes.
- Do not delete a release tag or change the tag ruleset. Abandoned releases roll forward.
- Finding 1 is out of scope. The release-please step keeps its current App token permissions.
- Prose is ASCII, uses no em-dashes, and uses the Oxford comma.
- Node 24 and the repo's existing npm scripts are the build environment.

## Review Focus

- A re-run of a failed release with a draft: rebuilds from the tag and replaces partial assets.
- A normal push that created no release: no build work.
- A re-run of an already published release: rebuilds and uploads, but does not republish.
- A re-run with no `tag_name`: falls back to `package.json`; if the tag does not exist, checkout fails loudly.
- A tag that disagrees with `package.json`, or a build missing any expected asset: fail before upload.

---

### Task 1: Add the re-runnable release path

**Files:**

- Modify: `.github/workflows/release-please.yml`
- Modify: `release-please-config.json`

**Interfaces:**

- Consumes: `steps.release.outputs.release_created`, `steps.release.outputs.tag_name`, `github.run_attempt`, and `steps.app-token.outputs.token`.
- Produces: `steps.release-state.outputs.tag` (a string such as `v1.8.0`) and `steps.release-state.outputs.should_build` (`'true'` or `'false'`). Every build, upload, and publish step consumes both.

- [x] **Step 1: Create the isolated worktree**

Run from `/Users/fran/fran-Repositories/flix-monkey`:

```bash
git worktree add ../flix-monkey-release-asset-recovery -b ci/release-asset-recovery main
cd ../flix-monkey-release-asset-recovery
cp ../flix-monkey/docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md docs/superpowers/specs/
cp ../flix-monkey/docs/superpowers/plans/2026-10-28-release-asset-recovery.md docs/superpowers/plans/
git status --short
```

Expected: the new worktree is on `ci/release-asset-recovery`, and the only untracked files are the copied spec and plan. The staged files in the original worktree are untouched.

- [x] **Step 2: Insert the state step after the release-please step**

Add this step immediately after the `googleapis/release-please-action` step:

```yaml
- name: Resolve release tag and state
  id: release-state
  env:
      GITHUB_SHA: ${{ github.sha }}
      RELEASE_CREATED: ${{ steps.release.outputs.release_created }}
      RELEASE_TAG: ${{ steps.release.outputs.tag_name }}
      RUN_ATTEMPT: ${{ github.run_attempt }}
  run: |
      version="v$(node -p "require('./package.json').version")"
      tag="$RELEASE_TAG"
      if [[ -z "$tag" ]]; then
          tag="$version"
      fi
      if [[ "$tag" != "$version" ]]; then
          echo "Release tag '$tag' does not match package.json version '$version'." >&2
          exit 1
      fi
      should_build=false
      if [[ "$RELEASE_CREATED" == "true" || "$RUN_ATTEMPT" -gt 1 ]]; then
          if ! git fetch --no-tags origin "+refs/tags/$tag:refs/tags/$tag"; then
              echo "Release tag '$tag' does not exist on origin." >&2
              exit 1
          fi
          tag_sha="$(git rev-list -n 1 "refs/tags/$tag")"
          if [[ "$tag_sha" != "$GITHUB_SHA" ]]; then
              echo "Release tag '$tag' points to commit $tag_sha, not this run's commit $GITHUB_SHA." >&2
              exit 1
          fi
          should_build=true
      fi
      {
          echo "tag=$tag"
          echo "should_build=$should_build"
      } >> "$GITHUB_OUTPUT"
      echo "Release tag: $tag"
      echo "Build release assets: $should_build"
```

Add `"force-tag-creation": true` to `release-please-config.json` before this step, because GitHub does not create a tag for a draft release until it is published.

- [x] **Step 3: Check out the tag before building**

Add this step immediately after the state step:

```yaml
- name: Check out release tag
  uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  if: ${{ steps.release-state.outputs.should_build == 'true' }}
  with:
      ref: ${{ steps.release-state.outputs.tag }}
```

The first checkout stays where it is because release-please reads its config from the workspace.

- [x] **Step 4: Gate the existing build steps on the new output**

Change the `if` condition on all four existing build steps from `steps.release.outputs.release_created` to:

```yaml
if: ${{ steps.release-state.outputs.should_build == 'true' }}
```

The steps are `Install dependencies`, `Rebuild native dependencies`, `Build artifacts`, and `Build source archive`.

- [x] **Step 5: Add the asset verification step**

Add this step after `Build source archive` and before the upload:

```yaml
- name: Verify release assets
  if: ${{ steps.release-state.outputs.should_build == 'true' }}
  env:
      TAG: ${{ steps.release-state.outputs.tag }}
  run: |
      for file in \
          "dist/FlixMonkey-$TAG-chrome.zip" \
          "dist/FlixMonkey-$TAG-firefox.xpi" \
          "dist/FlixMonkey-$TAG-source.zip" \
          "dist/FlixMonkey.user.js"; do
          if [[ ! -s "$file" ]]; then
              echo "Missing or empty release asset: $file" >&2
              exit 1
          fi
          if [[ "$file" == *.zip || "$file" == *.xpi ]]; then
              if ! unzip -tq "$file" >/dev/null; then
                  echo "Corrupt release asset: $file" >&2
                  exit 1
              fi
          fi
      done
```

- [x] **Step 6: Replace the upload step**

Replace the existing `Upload to Release` step with:

```yaml
- name: Upload to Release
  if: ${{ steps.release-state.outputs.should_build == 'true' }}
  env:
      GH_TOKEN: ${{ steps.app-token.outputs.token }}
      TAG: ${{ steps.release-state.outputs.tag }}
  run: |
      gh release upload "$TAG" \
          "dist/FlixMonkey-$TAG-chrome.zip" \
          "dist/FlixMonkey-$TAG-firefox.xpi" \
          "dist/FlixMonkey-$TAG-source.zip" \
          "dist/FlixMonkey.user.js" \
          --clobber
```

- [x] **Step 7: Replace the publish step**

Replace the existing `Publish Release` step with:

```yaml
- name: Publish Release
  if: ${{ steps.release-state.outputs.should_build == 'true' }}
  env:
      GH_TOKEN: ${{ steps.app-token.outputs.token }}
      TAG: ${{ steps.release-state.outputs.tag }}
  run: |
      draft="$(gh release view "$TAG" --json isDraft --jq '.isDraft')"
      if [[ "$draft" == "true" ]]; then
          gh release edit "$TAG" --draft=false
      fi
```

- [x] **Step 8: Lint the workflow**

Run from the worktree root:

```bash
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release-please.yml
```

Expected: no output and exit code 0. The first run downloads actionlint.

- [x] **Step 9: Check the wiring**

Run:

```bash
grep -c "steps.release-state.outputs.should_build" .github/workflows/release-please.yml
grep -c -- "--clobber" .github/workflows/release-please.yml
grep -c "isDraft" .github/workflows/release-please.yml
grep -c 'tag="$version"' .github/workflows/release-please.yml
grep -c 'Missing or empty release asset' .github/workflows/release-please.yml
grep -c 'RUN_ATTEMPT' .github/workflows/release-please.yml
grep -c 'tag_sha' .github/workflows/release-please.yml
grep -c 'force-tag-creation' release-please-config.json
```

Expected, in order: `8`, `1`, `1`, `1`, `1`, `2`, `2`, `1`.

The first count covers the tag checkout, the four build steps, the verification step, the upload, and the publish. The second covers idempotent upload. The third covers the draft check in the publish step. The last counts cover the run attempt, the tag commit check, and the config option.

- [x] **Step 10: Review the scenarios**

Read the state step and confirm each result:

| Scenario                               | Expected path                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Initial release                        | `release_created` is true, the tag exists and points to this commit, `should_build` is true.           |
| Re-run after a failed build            | `release_created` is false, `run_attempt` is 2, the tag points to this commit, `should_build` is true. |
| Normal push with no release            | `release_created` is false, `run_attempt` is 1, `should_build` is false.                               |
| Re-run of a run from another commit    | The tag points to a different commit, so the state step exits 1.                                       |
| Re-run with no tag                     | `git fetch` fails, so the state step exits 1 with a clear message.                                     |
| Re-run of an already published release | Build and upload repeat, `isDraft` is false, so publish does nothing.                                  |
| Tag mismatch or bad asset              | The state step fails on the version, or verification fails on missing, empty, or corrupt assets.       |

- [x] **Step 11: Commit**

Use a pathspec so only the workflow and config are committed:

```bash
git add .github/workflows/release-please.yml release-please-config.json
git commit .github/workflows/release-please.yml release-please-config.json -m "ci(github): make the release job re-runnable"
```

---

### Task 2: Document recovery and roll-forward

**Files:**

- Modify: `docs/STORE_PUBLISHING.md`
- Modify: `AGENTS.md`
- Add to the commit: `docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md` and `docs/superpowers/plans/2026-10-28-release-asset-recovery.md`

**Interfaces:**

- Consumes: the re-run behavior implemented in Task 1.
- Produces: maintainer instructions only; no code interface.

- [x] **Step 1: Add recovery and roll-forward sections**

Add this text after the "Publishing New Versions" section in `docs/STORE_PUBLISHING.md`, before "Updating Store Metadata":

```markdown
### Recovering a failed release build

If the `Release Please` workflow fails after the draft release is created, the
draft can be left with missing or partial assets. Do not create a new tag or
upload assets by hand.

1. Open **Actions** > **Release Please**.
2. Open the failed run.
3. Choose **Re-run all jobs**.

The workflow detects the re-run, rebuilds the artifacts from the release tag,
replaces the attached assets with `gh release upload --clobber`, and publishes
the release if it is still a draft. It does not build from the `main` branch
head. The release-please config sets `force-tag-creation`, so the tag exists
while the release is still a draft.

A re-run only repairs the release for the commit that triggered the run. If
the tag does not point to that commit, the workflow fails instead of rebuilding
an older release.

A re-run uses the workflow file from the failed commit. If the workflow itself
is the cause, merge the fix first, then re-run the resulting `Release Please`
run.

### Abandoning a failed release

If the tagged source cannot build, rebuilding that tag will not help. Delete
only the draft GitHub Release from the Releases page, keep the `vX.Y.Z` tag,
and fix the problem on `main` so release-please can open the next release PR.
Do not delete the tag or change the tag ruleset. The tag remains the release
boundary for release-please.

The release assets are built from the tag that release-please creates, so a
successful release always matches its tag.
```

- [x] **Step 2: Extend the Releases section in `AGENTS.md`**

Append this paragraph to the existing Releases section:

```markdown
The release job is re-runnable. Re-running a failed `Release Please` run rebuilds from the release tag, replaces the assets with `gh release upload --clobber`, and publishes the release if it is still a draft. The release-please config sets `force-tag-creation`, so the tag exists while the release is a draft. A re-run only repairs the release for the commit that triggered the run; if the tag points elsewhere, it fails. A re-run uses the workflow file from the failed commit; if the workflow itself is the cause, merge the fix and re-run the resulting run. If the tagged source cannot build, delete only the draft release and roll forward with the next version; do not delete the release tag or change the tag ruleset.
```

- [x] **Step 3: Check documentation formatting**

Run:

```bash
npx --no-install prettier --check AGENTS.md docs/STORE_PUBLISHING.md docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md docs/superpowers/plans/2026-10-28-release-asset-recovery.md
```

Expected: all four files pass. If a file fails, run `npx --no-install prettier --write` on it and run the check again.

- [x] **Step 4: Commit**

Add the new docs before committing, then use a pathspec so only the documentation is included:

```bash
git add docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md
git add docs/superpowers/plans/2026-10-28-release-asset-recovery.md
git add AGENTS.md docs/STORE_PUBLISHING.md
git commit AGENTS.md docs/STORE_PUBLISHING.md docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md docs/superpowers/plans/2026-10-28-release-asset-recovery.md -m "docs: document release recovery and roll-forward"
```

---

## Final Verification

Run from the worktree root:

```bash
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/release-please.yml
npx --no-install prettier --check AGENTS.md docs/STORE_PUBLISHING.md docs/superpowers/specs/2026-10-28-release-asset-recovery-design.md docs/superpowers/plans/2026-10-28-release-asset-recovery.md
npm run type-check && npm run lint && npm run format:check
git diff main --check
git log --oneline main..HEAD
```

Expected: actionlint and Prettier pass, the local gates pass, `git diff --check` prints nothing, and the log shows the implementation commits. The state and asset/publish behavior checks were run from a scratch harness in the plan workspace during execution; the harness is not committed.

Live behavior is verified after merge. Confirm `force-tag-creation` creates the tag with the draft, then confirm the artifacts are built from the tag. On the next failed release after the draft is created, re-run the workflow and confirm it repairs and publishes.
