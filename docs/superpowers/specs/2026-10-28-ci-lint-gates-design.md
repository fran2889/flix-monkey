# CI lint gates: actionlint and web-ext lint

**Date:** 2026-10-28

**Status:** accepted

**Size:** small change

## Intent

Catch broken workflow YAML, unsafe shell in workflows, and an invalid Firefox
manifest before code reaches `main`. Both checks must block merge without adding
new status check contexts or ruleset changes.

## Goals

- Run `actionlint` 1.7.12 in the existing `lint-and-audit` job through the
  SHA-pinned `raven-actions/actionlint` action, pinning the tool version with its
  `version` input.
- Run `web-ext lint` 10.7.0 against `dist/firefox` in the existing `build` job.
  Errors fail the build; warnings are reported without blocking.
- Cover both through the existing `merge-gate` job, leaving the `Protect main`
  ruleset unchanged.

## Non-goals

- PR title validation. Dropped from scope.
- Per-warning suppression in `web-ext lint`.
- New `actionlint` or `webext-lint` jobs, workflows, or required check contexts.
- Bumping `web-ext` in the store publish workflow.
- Chrome manifest linting.
- Prettier coverage for workflow YAML, or any other item from the CI/CD review.

## Constraints

- `web-ext` must stay out of `devDependencies`; its advisories would keep
  `npm run audit` red. Install it ad hoc, as the publish workflow already does.
- GitHub Actions are SHA-pinned, including `raven-actions/actionlint` v2.2.0.
  The action downloads the actionlint release named by its `version` input, so
  pinning the action SHA and the input together fixes both the runner and the
  tool.
- The action uses the preinstalled `shellcheck` for actionlint's embedded script
  checks. `pyflakes` is disabled: the workflows contain no Python, and enabling it
  installs an unpinned PyPI package on every cold run.
- `merge-gate` runs on pushes to `main` and on pull requests. Do not add
  PR-only jobs to `ci.yml`.
- CI owns the actionlint pin; local runs use a direct `actionlint` install.
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
  `npm ci`, so broken workflows fail fast. Use the Marketplace action rather than
  a container image or a hand-rolled binary download:

    ```yaml
    - name: Lint workflows
      uses: raven-actions/actionlint@3d39aea434753780c3b3d4a1a31c854b4dbf49d7 # v2.2.0
      with:
          version: '1.7.12'
    ```

    The action downloads the pinned actionlint release, caches it under
    `$RUNNER_TEMP`, and fails the step on errors. This removes the container image
    pull, the image cache, and the container runtime dependency from CI, at the
    cost of one third-party action pinned by SHA.

- **web-ext lint step.** Place it in `build` after `npm run build` and run
  `npx --yes --ignore-scripts web-ext@10.7.0 lint --source-dir dist/firefox`.
  npx installs into its own cache, so the install does not touch the project
  dependency tree, and the command matches the one documented for contributors.
- **Warnings do not gate.** `web-ext lint` exits non-zero on errors only;
  warnings are printed in the job log without failing the build.
- **No new npm scripts.** Keep the ad hoc web-ext install out of `package.json`.
  Document the local command instead.
- **Documentation.** Update `AGENTS.md` and `CONTRIBUTING.md` so the described
  CI gates and local equivalents match the workflows.

## Verification

- actionlint 1.7.12 passes on the repository when run locally.
- A PR run shows the `Lint workflows` step green on a clean tree and red on a
  deliberately broken workflow expression.
- `npm run build:firefox` followed by the web-ext lint command exits 0 with no
  errors.
- A manifest error, such as a malformed version, still exits non-zero.
- `npm run format:check` and `npm run lint` pass.
- A PR run shows `lint-and-audit` and `build` green, and `merge-gate` green.
- `gh api repos/fran2889/flix-monkey/rulesets/17680934` is unchanged.

## Risks and maintenance

- Warnings are not gating, so a new warning will not block a merge. It is still
  printed in the job log; tightening the gate again means adding a warning filter.
- `raven-actions/actionlint` is a third-party action. It runs with the workflow's
  `contents: read` token, and its SHA pin covers the composite steps and the
  internal actions it calls. Dependabot updates the action pin like any other
  `uses:` reference, but not the `version` input, so actionlint tool upgrades are
  manual.
- The action's `version` input defaults to `latest`, so an omitted input would
  float. Keep `version: '1.7.12'` explicit.
- The action installs the actionlint release from GitHub on a cold cache, so the
  first run depends on GitHub release availability and npm registry access for
  its tool-cache helper. Its internal `actions/cache` entry makes later runs
  fast.
- The web-ext version now appears in four places: the CI workflow, the store
  publish workflow, `AGENTS.md`, and `CONTRIBUTING.md`. Bump them together.
- CI installs web-ext from the repository root, so the repository `.npmrc`
  applies. `min-release-age=5` rejects a web-ext version published less than five
  days before the run; a release-day bump fails until the version ages or the
  step overrides the setting.
