# Store Publishing

FlixMonkey is published to the Chrome Web Store and Firefox Add-ons (AMO) by the
`Publish to Stores` GitHub Actions workflow
(`.github/workflows/publish-stores.yml`). Publishing is a **manual deployment**:
a maintainer runs the workflow for a chosen release tag, and it reuses the
artifacts already attached to that GitHub Release (no rebuild). A release must
therefore exist, with its artifacts attached, before it can be published.

The published artifacts are:

- Chrome: `FlixMonkey-v<version>-chrome.zip`
- Firefox: `FlixMonkey-v<version>-firefox.xpi` and `FlixMonkey-v<version>-source.zip`

## Overview

The `Publish to Stores` workflow is triggered manually via `workflow_dispatch`
and requires a tag input. It downloads the pre-built artifacts from the specified
GitHub Release and publishes them to their respective stores. No code is built
during this workflow; it only handles the store upload process.

## Required Repository Secrets

### Chrome Web Store

| Secret                 | Where to get it                                          |
| ---------------------- | -------------------------------------------------------- |
| `CHROME_EXTENSION_ID`  | The item ID on the Chrome Web Store Developer Dashboard. |
| `CHROME_PUBLISHER_ID`  | The publisher ID in the dashboard account settings.      |
| `CHROME_CLIENT_ID`     | OAuth2 client ID (see below).                            |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret (see below).                        |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token (see below).                        |

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
| `AMO_ADDON_ID`   | Add-on ID on AMO (e.g., `flixmonkey@fran`).      |

Generate `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` at
<https://addons.mozilla.org/developers/addon/api/key/> (Manage API Keys).
The add-on's stable ID is set in `src/targets/firefox/manifest.json` as
`browser_specific_settings.gecko.id` (`flixmonkey@fran`); AMO uses it to
match version updates to the listing.

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

1. Create and push a tagged release (e.g., `v1.0.0`) with attached artifacts
   (`FlixMonkey-v1.0.0-chrome.zip`, `FlixMonkey-v1.0.0-firefox.xpi`,
   `FlixMonkey-v1.0.0-source.zip`)
2. Navigate to **Actions** > **Publish to Stores** in the GitHub repository
3. Click **Run workflow**
4. Select the release tag to publish
5. Click **Run workflow**

The workflow will upload both Chrome and Firefox artifacts to their respective
stores. Both uploads run in parallel.

## Updating Store Metadata

### Firefox Add-ons (AMO)

The Firefox AMO store listing description can be updated automatically using the
`Update Store Description` GitHub Actions workflow (`update-store-description.yml`).

**Description File:** Store descriptions are maintained in
`docs/store-description.txt`. This file contains the rich, formatted text
that appears in the Firefox AMO listing.

**Automatic Updates:** The workflow runs automatically whenever
`docs/store-description.txt` is modified and merged to the `main` branch.
This ensures store listings stay in sync with the repository.

**Manual Updates:** To manually trigger a description update:

1. Navigate to **Actions** > **Update Store Description** in the GitHub repository
2. Click **Run workflow**
3. Optionally enable **Dry run** to test without making actual changes
4. Click **Run workflow**

Uses the AMO credentials documented in
[Required Repository Secrets](#required-repository-secrets).

### Chrome Web Store

Chrome Web Store metadata (including description) must be updated manually via
the Chrome Web Store Developer Dashboard. There is no programmatic API for
updating store listing metadata at this time.
