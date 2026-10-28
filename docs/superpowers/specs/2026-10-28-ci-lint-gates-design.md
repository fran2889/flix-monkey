# CI lint gates: actionlint and web-ext lint

**Date:** 2026-10-28

**Status:** accepted

**Size:** small change

## Intent

Catch broken workflow YAML, unsafe shell in workflows, and an invalid Firefox
manifest before code reaches `main`. Both checks must block merge without adding
new status check contexts or ruleset changes.

## Goals

- Run `actionlint` 1.7.12 in the existing `lint-and-audit` job, pinned by Docker
  image digest.
- Run `web-ext lint` 10.7.0 against `dist/firefox` in the existing `build` job
  with `--warnings-as-errors`.
- Clear the current web-ext warning by declaring Firefox for Android 142 as the
  minimum in the Firefox manifest. Desktop stays at 140.
- Cover both through the existing `merge-gate` job, leaving the `Protect main`
  ruleset unchanged.

## Non-goals

- PR title validation. Dropped from scope.
- New `actionlint` or `webext-lint` jobs, workflows, or required check contexts.
- Bumping `web-ext` in the store publish workflow.
- Chrome manifest linting.
- Prettier coverage for workflow YAML, or any other item from the CI/CD review.

## Constraints

- `web-ext` must stay out of `devDependencies`; its advisories would keep
  `npm run audit` red. Install it ad hoc, as the publish workflow already does.
- GitHub Actions are SHA-pinned. The actionlint Docker image is pinned by digest
  instead, which is the equivalent supply-chain control.
- `merge-gate` runs on pushes to `main` and on pull requests. Do not add
  PR-only jobs to `ci.yml`.
- Preserve the untracked review documents and the current branch state.

## Approaches considered

1. **Fold into existing jobs (chosen).** actionlint joins `lint-and-audit`;
   web-ext lint joins `build` after `npm run build`. One build, one install,
   no new jobs, and `merge-gate` already covers both.
2. **Dedicated jobs.** Clearer check names and more parallelism, but a second
   `npm ci` and a second Firefox build for no additional gate coverage.
3. **Separate workflows.** More files, duplicate setup, and no benefit because
   both must run on every PR anyway.

Option 1 is chosen for speed and the smallest surface change.

## Decisions

- **actionlint step.** Place it in `lint-and-audit` after checkout and before
  `npm ci`, so broken workflows fail fast. Command:
  `docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`.
- **web-ext lint step.** Place it in `build` after `npm run build`. Install with
  `npm install --prefix "$RUNNER_TEMP/web-ext" --no-save --no-package-lock --no-audit --no-fund --ignore-scripts web-ext@10.7.0`,
  then run
  `"$RUNNER_TEMP/web-ext/node_modules/.bin/web-ext" lint --source-dir dist/firefox --warnings-as-errors`.
  The isolated prefix keeps the install from touching the project dependency
  tree.
- **Manifest fix.** Add `browser_specific_settings.gecko_android.strict_min_version`
  as `"142.0"` in `src/targets/firefox/manifest.json`. The
  `data_collection_permissions` key needs 142 on Android; desktop remains at 140.
- **No new npm scripts.** Keep the Docker dependency and the ad hoc web-ext
  install out of `package.json`. Document the local commands instead.
- **Documentation.** Update `AGENTS.md` and `CONTRIBUTING.md` so the described
  CI gates and local equivalents match the workflows.

## Verification

- `docker run` actionlint command passes on the repository.
- `npm run build:firefox` followed by the web-ext lint command passes with
  `--warnings-as-errors`.
- `npm run format:check` and `npm run lint` pass after the manifest edit.
- A PR run shows `lint-and-audit` and `build` green, and `merge-gate` green.
- `gh api repos/fran2889/flix-monkey/rulesets/17680934` is unchanged.

## Risks and maintenance

- Android 140 and 141 are no longer declared as supported. Those versions cannot
  honor `data_collection_permissions` anyway, so the declaration matches reality.
- Dependabot does not update Docker references inside workflow `run` steps.
  Actionlint image updates are manual.
- The web-ext version now appears in four places: the CI workflow, the store
  publish workflow, `AGENTS.md`, and `CONTRIBUTING.md`. Bump them together.
