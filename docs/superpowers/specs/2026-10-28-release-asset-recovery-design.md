# Re-runnable Release Job Design

**Date:** 2026-10-28

**Status:** Implemented

**Scope:** Finding 4 of the 2026-10-26 CI/CD review.

## Intent

Make the existing Release Please job safe to re-run. If the build or upload fails after release-please creates the draft release, re-running the same workflow should rebuild from the tag, replace the attached assets, and publish the draft. No separate recovery workflow and no automatic repair on unrelated pushes.

## Goals

- Build every artifact from the release tag, not from the `main` branch head.
- Make uploads idempotent with `gh release upload --clobber`.
- Make a manual re-run of the workflow repair a failed release.
- Fail before uploading when the tag, `package.json` version, or expected artifact names disagree.
- Only repair the release for the commit that triggered the run.
- Reject empty or corrupt archives before upload.
- Keep the userscript attached alongside the three store artifacts.
- Document re-run recovery and the manual roll-forward path.

## Non-goals

- A separate recovery workflow or a manual dispatch input.
- Automatic draft detection on a later push.
- Finding 1, the GitHub App permission failure in release-please.
- Finding 5, store publish preflight, concurrency, and rollback.
- Finding 3, PR title validation.
- Automated cleanup, tag deletion, or changes to the tag ruleset.

## Constraints

- A GitHub Actions re-run uses the same commit and the workflow file from that commit.
- A re-run has `github.run_attempt` greater than 1.
- GitHub does not create a tag for a draft release until it is published. `release-please-config.json` sets `force-tag-creation`, so the tag exists while the release is a draft.
- The tag is created during the run, so the initial checkout cannot use it. The workflow needs a second checkout after release-please.
- The tag must point to the commit that triggered the run. A re-run of an unrelated commit must fail instead of rebuilding an older release.
- Actions stay pinned to the existing commit SHAs.
- `actionlint` must pass.
- Prose follows the repository rules: ASCII, no em-dashes, Oxford comma.

## Approaches

| Approach                                | What it does                                                                       | Trade-off                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A. Separate recovery workflow           | Add a manual workflow that repeats the build and upload steps                      | Two copies of the release build that can drift, and a second thing to maintain                                   |
| B. Reusable build workflow              | Move the build into `workflow_call` and call it from the normal and recovery paths | Extra indirection, and a reusable workflow cannot read a caller step output, so token handling gets more complex |
| C. Re-runnable job using `run_attempt`  | Build when release-please created a release or the job is a re-run                 | A manual re-run repairs a draft, and the logic stays small                                                       |
| D. Re-runnable job with draft detection | Also query the release and build whenever a draft exists                           | Auto-repairs on a later push, but adds a state query and can publish a draft from an unrelated push              |

**Chosen:** C. A manual re-run is the recovery trigger. Draft detection on every push was rejected as the weaker and less predictable option.

## Chosen Design

All workflow changes stay in `.github/workflows/release-please.yml`, in the existing single job. One config change enables tag creation.

### Creating the tag with the draft

Add `"force-tag-creation": true` at the top level of `release-please-config.json`. Without it, GitHub creates the tag only when the draft is published, so the build could not check out the tag. It also keeps release-please able to find the previous release for changelog generation.

### Resolving the tag and whether to build

After the release-please step, add a step with id `release-state` that:

1. Reads `steps.release.outputs.tag_name`. If it is empty, falls back to `v$(node -p "require('./package.json').version")`.
2. Computes `expected="v$(node -p "require('./package.json').version")"` and fails unless the tag equals it.
3. Sets `should_build=true` when `steps.release.outputs.release_created` is `true` or when `github.run_attempt` is greater than 1.
4. Before setting `should_build=true`, fetches `refs/tags/<tag>`, fails if the tag does not exist, and fails unless the tag's commit equals `github.sha`.
5. Writes `tag` and `should_build` to `$GITHUB_OUTPUT`.

A normal push that did not create a release sets `should_build=false`, so every build step is skipped. A manual re-run sets `should_build=true` and rebuilds from the tag.

The commit comparison makes a re-run of an unrelated push fail with a clear message instead of rebuilding and clobbering the previous release's assets.

### Building from the release commit

Every existing step gated on `steps.release.outputs.release_created` changes to `steps.release-state.outputs.should_build == 'true'`.

The first checkout is already at `github.sha`. The state step verifies that the release tag points to that same commit, so the build and `npm run package:source` (`git archive HEAD`) use the release commit without a second checkout.

### Packaging and uploading

`scripts/package.js` takes a target: `chrome`, `firefox`, or `all`. `all` requires both `dist/chrome` and `dist/firefox`, verifies the required files in each, and only then writes both archives. The individual targets require only their own directory. `build` passes `all`; `build:chrome` and `build:firefox` pass their target. A missing target or required file fails the build before any archive is written.

There is no separate asset preflight in the workflow. `npm run build`, `npm run package:source`, and Rollup all exit non-zero on failure. The upload uses the `dist/*.zip dist/*.xpi dist/*.user.js` glob with `--clobber`; `prebuild` cleans `dist`.

### Publishing

The final step runs `gh release edit <tag> --draft=false`. The edit is idempotent on an already published release, so a re-run does not need a draft lookup.

`TAG` is never interpolated directly into a `run` script.

### Documentation

- `docs/STORE_PUBLISHING.md`: add a "Recovering a failed release build" subsection under "Publishing New Versions". It says to open the failed `Release Please` run and choose **Re-run all jobs**. The workflow detects the re-run, rebuilds from the tag, replaces the assets, and publishes the release. It notes that `force-tag-creation` makes the tag exist while the release is a draft, and that a re-run only repairs the release for the run's commit.
- `docs/STORE_PUBLISHING.md`: note that a re-run uses the workflow file from the failed commit. If the workflow itself is the cause, merge the fix and re-run the resulting `Release Please` run.
- `docs/STORE_PUBLISHING.md`: add a short "Abandoning a failed release" note. If the tagged source cannot build, delete only the draft GitHub Release in the UI, keep the `vX.Y.Z` tag, and roll forward with the next version. Do not delete the tag or change the tag ruleset. The existing tag remains the release boundary for release-please.
- `AGENTS.md`: extend the Releases section to say the release job is re-runnable, builds from the tag, checks the tag commit, and that abandoned releases roll forward without deleting tags.

## What Is Left to the Builder

- Create a `ci/release-asset-recovery` branch and use a `ci(github): ...` commit title.
- Choose exact step names consistent with the existing workflow.
- Keep the existing `concurrency: release-please` group.
- Run `actionlint` before opening the pull request.

## Verification

- `actionlint` passes on the changed workflow.
- The state step is exercised locally with a fake `git` for an initial release, a repair re-run, a normal push, an unrelated commit, a missing tag, and a tag/version mismatch.
- `scripts/package.js` packages both targets for `all`, either target for `chrome` or `firefox`, and fails before writing any archive when a requested directory or required file is missing.
- The publish step is the single idempotent `gh release edit --draft=false` call.
- A live repair can only be verified by re-running a failed release after merge. The first re-run should target a release whose artifacts are already correct, so replacing them is harmless.
