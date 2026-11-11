# Wire Store Publishing to the `store-publish` Environment

**Issue:** [#263](https://github.com/fran2889/flix-monkey/issues/263)

## Intent

The `store-publish` environment exists and allows only `main` and `v*` tags, but
the publishing workflows do not reference it. Wiring the jobs to it applies the
branch policy, records deployments, and moves the store credentials into
environment-scoped secrets.

## Goals

- `publish-chrome` and `publish-firefox` declare `environment: store-publish`.
- `update-firefox-description` declares the same environment, because `AMO_*`
  moves too.
- `CHROME_*` and `AMO_*` credentials live in the `store-publish` environment, not
  as repository secrets.
- A run dispatched from `main` or a `v*` tag can read the credentials; a run from
  another ref fails at the environment gate before any publish step.
- The environment keeps no required reviewers, and `Prevent self-review` stays
  disabled.
- `docs/STORE_PUBLISHING.md` names the environment and says the credentials live
  there.
- A dispatched run confirms both publish jobs resolve the secrets.

## Non-goals

- No `dry_run` workflow input and no credential preflight step. The maintainer
  chose minimal wiring over an explicit verification path.
- No change to `publish-greasyfork`. It uses the repository variable
  `GREASYFORK_SCRIPT_ID` and no store credentials.
- No change to environment protection settings. They already match the
  requirements.
- No secret creation or deletion by the agent. The token can read environment
  metadata but not secrets, so an administrator performs that part.

## Anti-goals

- Breaking `update-store-description` by moving `AMO_*` without giving that job
  the environment.
- Leaving duplicate repository secrets after the environment secrets exist.
- Documenting the migration as complete before an administrator performs it.

## Constraints

- Current environment state, confirmed through the API: branch policies `main`
  and `v*` (tag), no required reviewers, `can_admins_bypass: true`.
- The available token cannot list or write secrets (`403`).
- Actions stay SHA-pinned, and both workflows must pass `actionlint`.
- Docs prose uses no em-dashes, uses the Oxford comma, and stays ASCII.

## Approaches

- **A. Minimal wiring (chosen).** Add `environment: store-publish` to the three
  jobs and update the docs. Verify with a feature-branch dispatch for the
  negative case and a real dispatch from `main` for the positive case. A real
  dispatch publishes.
- **B. Wiring plus a credential preflight.** Add a first step that asserts the
  secrets are non-empty. Rejected: more workflow code than the maintainer wants.
- **C. Wiring plus a `dry_run` input.** Add an input that skips publishing.
  Rejected: a new input and conditionals for a workflow with two consumers.

## Decisions

- Job-level `environment: store-publish` on `publish-chrome`, `publish-firefox`,
  and `update-firefox-description`.
- `CHROME_*` and `AMO_*` become environment secrets. `GREASYFORK_SCRIPT_ID`
  stays a repository variable.
- Repository secrets are deleted only after the environment secrets are created
  and the workflows are merged.
- Verification order: dispatch from a feature branch and confirm the environment
  gate rejects it; then dispatch from `main` for a release and confirm both jobs
  read their credentials and publish.

## Rollout

1. Administrator creates the environment secrets on `store-publish`:
   `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`,
   `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`,
   `AMO_JWT_SECRET`, and `AMO_ADDON_ID`.
2. Merge the workflow and documentation changes.
3. Dispatch the workflow from a feature branch and confirm the environment gate
   fails both publish jobs before the first step.
4. Dispatch from `main` for a release and confirm both publish jobs resolve the
   credentials.
5. Administrator deletes the migrated repository secrets.

## What Is Left to the Builder

- Edit the three jobs and `docs/STORE_PUBLISHING.md`.
- Run `actionlint` and a Prettier check on the changed files.
- Leave the administrator steps in the PR description so they are not forgotten.
