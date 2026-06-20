# Automated Store Publishing: Design

**Date:** 2026-06-20
**Status:** Approved, pending implementation
**Branch:** `ci/publish-to-stores`

## Goal

Publish a selected FlixMonkey release to the **Chrome Web Store** and
**Firefox Add-ons (AMO)**, extending the existing release pipeline. Both store
listings already exist, so this automates **version updates**, not first-time
submissions. Publishing is a **manual deployment**: a maintainer triggers the
workflow for a specific release tag, CI uploads that version and submits it for
review. Reviews are then handled by each store on its own schedule. Decoupling
publishing from the release cut means a release can land on GitHub without
immediately going to the stores, and a store push is a deliberate, re-runnable
action.

## Scope

In scope:

- A new `publish-stores.yml` GitHub Actions workflow that publishes a selected
  release tag to both stores, triggered manually.
- Pinned dev dependencies for the two store CLIs, invoked directly from the
  publish workflow.
- An auto-generated source archive, attached to the GitHub Release and submitted
  to AMO alongside the build.
- Documentation for obtaining and storing the required credentials.

Out of scope:

- First-time store submissions (already done manually).
- Userscript distribution (already attached to the GitHub Release; not a store).
- Auto-rollback (stores do not support it; fix forward with a new patch release).

## Trigger Mechanism

Publishing is triggered **manually** via `workflow_dispatch` with a required
`tag` input (e.g. `v1.0.2`). A maintainer cuts a release with release-please as
usual, then deliberately deploys a chosen tag to the stores when ready. There is
no automatic trigger tied to the release cut.

Benefits:

- Publishing to the stores is an intentional, auditable deployment, not a side
  effect of merging a release PR.
- The publish run is independently re-runnable from the Actions UI for any tag.
- A store failure never affects the release-please job, and any historical tag
  can be (re)published without re-running release-please.
- No extra secrets or cross-workflow artifact handshake beyond the store
  credentials.

## Workflow Structure (`publish-stores.yml`)

Permissions: `contents: read`.

```
job: publish-chrome         (uses inputs.tag)
job: publish-firefox        (uses inputs.tag)
```

`publish-chrome` and `publish-firefox` run in **parallel**, so a Chrome
rejection does not block Firefox and each is re-runnable on its own.

Both publish jobs share a prelude:

1. `actions/checkout` at the release **tag** from the `workflow_dispatch` input
   (for `package.json` and the pinned CLI devDependencies; not for building).
2. `actions/setup-node` with Node 24.
3. `npm ci --ignore-scripts` (installs the `web-ext` / `chrome-webstore-upload`
   CLIs only; no native build deps).
4. `gh release download <tag>` to fetch the artifacts already attached to the
   GitHub Release into `dist/`.

The publish jobs **do not rebuild**. release-please is the single place artifacts
are produced (see below); publishing only downloads those artifacts and uploads
them to the stores. This guarantees the published Chrome package is byte-for-byte
the artifact that was released, tested, and inspected, with no rebuild drift. For
Firefox the _submitted_ package content is byte-for-byte the released `.xpi` (AMO
re-signs server-side, so the final signed `.xpi` is never byte-identical to any
input regardless of how it is produced). All third-party actions are pinned to
commit SHAs, matching the existing workflows.

A successful release-please run is therefore a **hard prerequisite**: only tags
whose Release carries the expected artifacts can be published. Tags cut before
this change (without the source archive attached) require re-attaching artifacts
before they can be published.

## Release Artifacts (produced by `release-please.yml`)

When release-please cuts a release, the existing build step already produces and
uploads the Chrome `.zip`, Firefox `.xpi`, and userscript `.user.js` to the
GitHub Release. This design adds one step: after the build, run
`npm run package:source` to produce `dist/FlixMonkey-source.zip` and include it
in the same `gh release upload`. The Release then carries all four artifacts, and
the source archive is generated once, from the exact released tag.

`package:source` stays an npm script: it needs no credentials and is genuinely
useful to run locally (inspect what is submitted to AMO).

## Chrome Job

- Download the Chrome zip from the Release:
  `gh release download <tag> --pattern 'FlixMonkey-*-chrome.zip' --dir dist`.
- Upload it directly (the CLI's `--source` accepts a zip file):
  `npx chrome-webstore-upload --source dist/FlixMonkey-<tag>-chrome.zip`. With no
  subcommand the CLI both uploads and publishes (the `upload` subcommand uploads
  only; there is no `--auto-publish` flag).
- Credentials passed as environment variables from the `CHROME_*` secrets.
- `chrome-webstore-upload-cli` is pinned as a devDependency; the command is
  inlined in the workflow (CI-only, runs next to its env/secrets) rather than
  wrapped in an npm script.

## Firefox Job

- Download the Firefox `.xpi` and the source archive from the Release:
  `gh release download <tag> --pattern 'FlixMonkey-*-firefox.xpi' --pattern 'FlixMonkey-source.zip' --dir dist`.
- Unzip the released `.xpi` into `dist/firefox/` so its content can be resubmitted
  unchanged (`web-ext sign` takes a `--source-dir`, not a prebuilt package; it
  re-zips for upload but the submitted content is byte-for-byte the released
  `.xpi`). AMO requires source for listed add-ons that ship a build step, hence
  the attached `FlixMonkey-source.zip`.
- Submit to AMO's **listed** channel, inlined in the workflow:
  `npx web-ext sign --source-dir dist/firefox --channel listed --upload-source-code dist/FlixMonkey-source.zip --approval-timeout 0`,
  using `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` (mapped to `WEB_EXT_API_KEY` /
  `WEB_EXT_API_SECRET`).

The `--upload-source-code` flag is how the pinned `web-ext` (v10) attaches the
source archive to the AMO submission (confirmed against `web-ext sign --help`).

**Add-on ID:** AMO requires a stable add-on ID for version updates. Verify
`src/targets/firefox/manifest.json` sets
`browser_specific_settings.gecko.id`; if missing, it must be added (this is a
prerequisite for automated updates).

## Secrets and Credential Setup

Documented in the spec/docs so a maintainer can configure them.

### Chrome Web Store

Repository secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`,
`CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.

1. Create (or reuse) a Google Cloud project and enable the **Chrome Web Store
   API**.
2. Create an OAuth2 **Desktop app** client; record the client ID and secret.
3. Run the one-time consent flow to mint a **refresh token** (documented commands
   to be included in the implementation docs).
4. `CHROME_EXTENSION_ID` is the existing item's ID from the Web Store dashboard.

### Firefox AMO

Repository secrets: `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`.

1. Generate API credentials at `addons.mozilla.org` -> Manage API Keys.
2. The add-on ID/GUID comes from the Firefox manifest's
   `browser_specific_settings.gecko.id`.

## Failure Handling and Idempotency

- Each store job is independent and re-runnable; failures surface per-job.
- **Duplicate version:** store APIs reject re-uploading an existing version. The
  jobs do not add a guard for this: a re-run after a store already has the version
  fails loudly. Because the two jobs are independent and individually re-runnable,
  the fix is to re-run only the job that did not complete; a genuine duplicate
  surfaces as a clear failure.
- **No auto-rollback:** stores do not support it. A bad release is fixed by
  cutting a new patch version.

## Testing and Validation

- CI cannot end-to-end test real store uploads.
- Validation consists of:
    - Workflow YAML lints and parses.
    - `gh release download` against a real tag fetches the expected artifacts;
      the publish CLIs run locally in a `--dry-run` / no-publish mode where they
      support it.
    - A manual `workflow_dispatch` run against a real tag validates against the
      live stores once secrets are configured.

## Changes Summary

- `.github/workflows/publish-stores.yml` (new, `workflow_dispatch` only):
  download Release artifacts and upload to the stores; no rebuild. Store-publish
  commands inlined (no `publish:*` npm scripts).
- `.github/workflows/release-please.yml`: add `npm run package:source` after the
  build and include `dist/FlixMonkey-source.zip` in the `gh release upload`, so
  the Release carries all four artifacts.
- `package.json`: keep `package:source`; pin `chrome-webstore-upload-cli` and
  `web-ext` as devDependencies. No `publish:chrome` / `publish:firefox` scripts.
- `src/targets/firefox/manifest.json`: ensure `gecko.id` is set (if missing).
- Documentation: credential setup section (CONTRIBUTING.md or a dedicated doc).
