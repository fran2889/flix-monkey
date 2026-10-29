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

### Building from the tag

Every existing step gated on `steps.release.outputs.release_created` changes to `steps.release-state.outputs.should_build == 'true'`.

Immediately after the state step and before installing dependencies, add a second checkout:

```yaml
- name: Check out release tag
  uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  if: ${{ steps.release-state.outputs.should_build == 'true' }}
  with:
      ref: ${{ steps.release-state.outputs.tag }}
```

The first checkout stays because release-please reads its config from the workspace. The second one makes `HEAD` the tag, so `npm run package:source` (`git archive HEAD`) produces the source archive for that tag.

### Verifying and uploading

After `npm run build` and `npm run package:source`, add a verification step that fails unless all four files exist and are non-empty:

- `dist/FlixMonkey-<tag>-chrome.zip`
- `dist/FlixMonkey-<tag>-firefox.xpi`
- `dist/FlixMonkey-<tag>-source.zip`
- `dist/FlixMonkey.user.js`

The three archives are also checked with `unzip -tq`, so a truncated or corrupt archive fails before it can replace a good asset. The upload names those four files explicitly instead of using globs, passes `TAG` through `env`, and adds `--clobber`. This replaces the current `dist/*.zip dist/*.xpi dist/*.user.js` glob.

### Publishing

The final step reads `isDraft` for the tag and runs `gh release edit <tag> --draft=false` only when the release is still a draft. The lookup is assigned to a variable before the comparison, so a failed `gh release view` fails the step instead of silently reporting success. On a re-run of an already published release, the rebuild and upload repeat but the publish step does nothing.

`TAG` is never interpolated directly into a `run` script.

### Documentation

- `docs/STORE_PUBLISHING.md`: add a "Recovering a failed release build" subsection under "Publishing New Versions". It says to open the failed `Release Please` run and choose **Re-run all jobs**. The workflow detects the re-run, rebuilds from the tag, replaces the assets, and publishes the release if it is still a draft. It notes that `force-tag-creation` makes the tag exist while the release is a draft, and that a re-run only repairs the release for the run's commit.
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
- The asset check is exercised locally for missing, empty, corrupt, and valid artifacts.
- The publish step is exercised locally for a draft, a published release, and a failed `gh release view`.
- A live repair can only be verified by re-running a failed release after merge. The first re-run should target a release whose artifacts are already correct, so replacing them is harmless.
