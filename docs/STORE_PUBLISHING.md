# Store Publishing

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

## Overview

The `Publish to Stores` workflow is triggered manually via `workflow_dispatch`
and requires a tag input. It downloads the pre-built artifacts from the specified
GitHub Release and publishes the Chrome and Firefox builds. It also checks that
the Greasy Fork listing serves the same version. The listing itself is updated by
the repository's GitHub `release` webhook, not by this workflow. No code is built
during this workflow; it only handles the store upload and verification process.

## Publishing Environment

The Chrome upload, Firefox upload, and Firefox description jobs run in the
`store-publish` GitHub environment. Deployments to that environment are allowed
only from `main` and `v*` tags, and it has no required reviewers. A workflow
dispatched from any other branch or tag fails at the environment gate before it
can read the credentials.

The store credentials belong on the `store-publish` environment, not on the
repository. OAuth2 credentials and API keys are environment secrets. Public
identifiers, which are the two Chrome IDs and the AMO add-on ID, are environment
variables instead.

## Required Environment Secrets

Store these as secrets on the `store-publish` environment.

### Chrome Web Store

| Secret                 | Where to get it                   |
| ---------------------- | --------------------------------- |
| `CHROME_CLIENT_ID`     | OAuth2 client ID (see below).     |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret (see below). |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token (see below). |

To obtain the OAuth2 credentials:

1. In the Google Cloud Console, create or reuse a project and enable the
   **Chrome Web Store API**.
2. Configure the OAuth consent screen, then create an OAuth2 client of type
   **Desktop app**. Record the client ID and secret.
3. Mint a refresh token by completing the consent flow once. The simplest
   path is the helper documented by `chrome-webstore-upload`:
   <https://github.com/fregante/chrome-webstore-upload-keys>

Run this CLI tool to generate the required refresh token:

```bash
npx chrome-webstore-upload-keys
```

**Note:** The refresh token must be updated periodically as it expires.

### Firefox Add-ons (AMO)

| Secret           | Where to get it                                  |
| ---------------- | ------------------------------------------------ |
| `AMO_JWT_ISSUER` | API key (JWT issuer) from addons.mozilla.org.    |
| `AMO_JWT_SECRET` | API secret (JWT secret) from addons.mozilla.org. |

Generate `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` at
<https://addons.mozilla.org/developers/addon/api/key/> (Manage API Keys).
The add-on's stable ID is set in
[`src/targets/firefox/manifest.json`](../src/targets/firefox/manifest.json) as
`browser_specific_settings.gecko.id` (`flixmonkey@fran`); AMO uses it to
match version updates to the listing.

## Required Environment Variables

Store these as variables, not secrets, on the `store-publish` environment.

| Variable              | Where to get it                                          |
| --------------------- | -------------------------------------------------------- |
| `CHROME_EXTENSION_ID` | The item ID on the Chrome Web Store Developer Dashboard. |
| `CHROME_PUBLISHER_ID` | The publisher ID in the dashboard account settings.      |
| `AMO_ADDON_ID`        | Add-on ID on AMO (e.g., `flixmonkey@fran`).              |

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

## Build Instructions for Store Reviewers

Store reviewers can reproduce the published artifacts from the source code.

### Firefox Add-ons (AMO)

The published add-on is the `.xpi` attached to the matching GitHub Release; the
accompanying `FlixMonkey-v<version>-source.zip` is this repository at the release tag.

The submitted code is bundled by Rollup, so AMO requires the human-readable
source. To reproduce `dist/firefox/` from the accompanying source archive:

```bash
npm ci            # Node.js >= 24
npm run build:firefox
```

The built extension is written to `dist/firefox/`.

### Chrome Web Store

To reproduce the Chrome extension from the source archive:

```bash
npm ci            # Node.js >= 24
npm run build:chrome
```

The built extension is written to `dist/chrome/`.

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

The run deploys to the `store-publish` environment. There are no required
reviewers, so it starts as soon as it is dispatched.

### Recovering a failed release build

A failed `Release Please` run is not retried. The build steps only run when
release-please creates a release in that run, so a re-run after the draft
already exists does not rebuild its assets or repair the draft. If the first run
failed before release-please created the draft, a re-run can still create it and
build the assets.

If the run fails before the release is published, the draft can be left with
missing or partial assets. Roll forward instead:

1. Delete only the draft GitHub Release:
   `gh release delete vX.Y.Z --yes`. Do not pass `--cleanup-tag`.
2. Fix the problem on `main` with a commit that increments the release-please
   version; a commit that does not bump it will not open the next release PR.
   See [release-please: releasable
   units](https://github.com/googleapis/release-please#release-please-bot-does-not-create-a-release-pr-why).
3. Merge the next release PR when it appears. It bumps to the next version.

The release-please config sets `force-tag-creation`, so the tag exists while the
release is a draft. The `Protect release tags` ruleset makes every `v*` tag
immutable: it cannot be deleted or moved. release-please uses the tag to find
the previous release ([how release-please determines the previous
release](https://github.com/googleapis/release-please/blob/main/docs/troubleshooting.md#how-does-release-please-determine-the-previous-release)),
so the next release covers only newer commits. Do not change the tag ruleset.

If the build and asset upload succeeded and only the final publish failed, the
assets are already attached. Publish the draft from the Releases page, or run
`gh release edit vX.Y.Z --draft=false`, instead of rolling forward.

## Failure Handling

- A job that fails before its first step with an environment protection error
  was not dispatched from `main` or a `v*` tag. Dispatch it from `main`.
- An empty store credential fails the store command. Confirm the secret exists
  on the `store-publish` environment and not only at repository level.
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

## Updating Store Metadata

### Firefox Add-ons (AMO)

The Firefox AMO store listing description can be updated automatically using the
`Update Store Description` GitHub Actions workflow
([`update-store-description.yml`](../.github/workflows/update-store-description.yml)).

**Description File:** Store descriptions are maintained in
[`docs/store-description.txt`](store-description.txt). This file contains the
rich, formatted text that appears in the Firefox AMO listing.

**Automatic Updates:** The workflow runs automatically whenever
[`docs/store-description.txt`](store-description.txt) is modified and merged to
the `main` branch. This ensures store listings stay in sync with the repository.

**Manual Updates:** To manually trigger a description update:

1. Navigate to **Actions** > **Update Store Description** in the GitHub repository
2. Click **Run workflow**

Uses the AMO credentials documented in
[Required Environment Secrets](#required-environment-secrets).

### Chrome Web Store

Chrome Web Store metadata (including description) must be updated manually via
the Chrome Web Store Developer Dashboard. There is no programmatic API for
updating store listing metadata at this time.
