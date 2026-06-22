# Store Publishing

FlixMonkey is published to the Chrome Web Store and Firefox Add-ons (AMO) by the
`Publish to Stores` GitHub Actions workflow
(`.github/workflows/publish-stores.yml`). Publishing is a **manual deployment**:
a maintainer runs the workflow for a chosen release tag, and it reuses the
artifacts already attached to that GitHub Release (no rebuild). A release must
therefore exist, with its artifacts attached, before it can be published.

This document covers the one-time credential setup and the AMO source-code
build instructions.

## Build instructions (for AMO reviewers)

The published add-on is the `.xpi` attached to the matching GitHub Release; the
accompanying `FlixMonkey-v<version>-source.zip` is this repository at the release tag.

The submitted code is bundled by Rollup, so AMO requires the human-readable
source. To reproduce `dist/firefox/` from the accompanying source archive:

```bash
npm ci            # Node.js >= 24
npm run build:firefox
```

The built extension is written to `dist/firefox/`.

## Required repository secrets

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
   <https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md>

### Firefox AMO

| Secret           | Where to get it                                  |
| ---------------- | ------------------------------------------------ |
| `AMO_JWT_ISSUER` | API key (JWT issuer) from addons.mozilla.org.    |
| `AMO_JWT_SECRET` | API secret (JWT secret) from addons.mozilla.org. |

Generate both at <https://addons.mozilla.org/developers/addon/api/key/>
(Manage API Keys). The add-on's stable ID is already set in
`src/targets/firefox/manifest.json` as `browser_specific_settings.gecko.id`
(`flixmonkey@fran`); AMO uses it to match version updates to the listing.
