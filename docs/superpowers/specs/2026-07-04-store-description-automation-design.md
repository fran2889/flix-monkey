---
title: Store Description Automation Design
created: 2026-07-04
targets: Chrome Web Store, Firefox Add-ons
---

# Store Description Automation Design

## Summary

Automatically update the full store description for Chrome Web Store and Firefox Add-ons when publishing a new release via the `publish-stores.yml` GitHub Actions workflow.

## Background

Currently, the full store description is maintained in `docs/DESCRIPTIONS.md` and must be manually copied to store listings. The short description in `package.json` is automatically injected into extension manifests. This design adds automation to update the full description in both stores as part of the publishing process.

## Goals

- Single source of truth for full store description in `package.json`
- Automatic description updates when publishing releases
- Maintain existing publishing workflow structure
- Clear error handling and logging

## Non-Goals

- Updating short descriptions (already handled by manifest injection)
- Updating GitHub repo description
- Supporting markdown or HTML formatting in descriptions
- Automated testing of store listings

## Design

### 1. Data Source

Add a new field `descriptionFull` to `package.json`:

```json
{
    "description": "See IMDb, Metacritic, and Rotten Tomatoes ratings while browsing Netflix.",
    "descriptionFull": "FlixMonkey adds IMDb, Metacritic, and Rotten Tomatoes ratings directly to Netflix, helping you decide what to watch before you press play.\n\nRatings appear on title cards, hover previews, detail views, and search results. You can also filter out low-rated titles and quickly jump to IMDb for more details.\n\nAvailable as a Chrome extension, Firefox add-on, and Greasemonkey userscript.\n\nFEATURES\n- View IMDb ratings directly on Netflix titles, with Metacritic and Rotten Tomatoes added when available\n- Click the IMDb badge to open the title on IMDb, or search IMDb when no match is found\n- Optionally fade out titles below a chosen IMDb rating threshold\n\nRATING PROVIDERS\nFlixMonkey supports multiple rating sources:\n- Agregarr (default): Provides IMDb ratings only. No API key required\n- OMDb (recommended): Provides IMDb, Metacritic, and Rotten Tomatoes ratings with a free API key\n- XMDb: Provides IMDb and Metacritic ratings with a free API key\n- IMDb API (deprecated): Unreliable due to low rate limits\n\nCACHING\nRatings are cached locally to keep browsing fast and reduce API usage:\n- Older titles (1+ year) are cached indefinitely\n- Recent titles refresh monthly to capture updated ratings\n- Unrated titles are retried after 24 hours\n- Failing providers are temporarily paused to prevent repeated errors\n\nLICENSE\nLicensed under GPLv3. Documentation and source code are available on GitHub:\nhttps://github.com/fran2889/flix-monkey"
}
```

- Format: Plain text (no markdown, no HTML) - the description from `docs/DESCRIPTIONS.md` converted by removing markdown formatting
- Single description used for both Chrome Web Store and Firefox Add-ons
- The existing `description` field remains the source of truth for short descriptions
- The initial `descriptionFull` value should be the full description from `docs/DESCRIPTIONS.md` with markdown formatting removed (headers, bullet points converted to plain text)

### 2. Update Script

Create `scripts/update-store-descriptions.js` that:

1. Reads `descriptionFull` from `package.json`
2. Validates that the field exists and is a non-empty string
3. Updates Chrome Web Store listing:
    - Authenticates using existing secrets: `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`
    - Obtains access token via OAuth 2.0
    - Calls `PATCH https://chromewebstore.googleapis.com/v1.1/items/{CHROME_EXTENSION_ID}`
    - Updates the listing description in the request body
4. Updates Firefox Add-ons listing:
    - Authenticates using existing secrets: `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`
    - Generates JWT and obtains access token
    - Calls `PATCH https://addons.mozilla.org/api/v4/addons/{addon_id}/`
    - Updates the add-on description in the request body
5. Logs success/failure for each store
6. Exits with error code if any description update fails

### 3. Workflow Integration

Modify `.github/workflows/publish-stores.yml` to add description update steps in this exact order:

1. Publish to Chrome Web Store (existing step)
2. Publish to Firefox Add-ons (existing step)
3. Update Chrome Web Store description (new step)
4. Update Firefox Add-ons description (new step)

Both description updates run after both extensions are successfully published. If Chrome description update fails, the workflow fails before attempting Firefox description update. If Firefox description update fails, the workflow fails.

### 4. Error Handling

- **Description updates are blocking**: If updating Chrome description fails, the workflow fails before attempting Firefox. If updating Firefox description fails, the workflow fails.
- **Clear logging**: Each step outputs its status (success/failure) with details
- **Fail fast**: The workflow stops at the first description update failure

### 5. Testing

- Manual testing in the workflow by running `publish-stores.yml` with a test tag
- Verify both store listings after workflow completion
- Script can be tested locally with valid credentials

## Implementation Notes

### Chrome Web Store API

The Chrome Web Store API requires:

- OAuth 2.0 authentication with refresh token (`CHROME_REFRESH_TOKEN`)
- Client ID and secret (`CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`)
- `https://www.googleapis.com/auth/chromewebstore` scope (should be covered by existing credentials)
- Extension ID from `CHROME_EXTENSION_ID` secret
- PATCH request to `https://chromewebstore.googleapis.com/v1.1/items/{CHROME_EXTENSION_ID}`
- Note: API endpoint and request format may need verification against current Chrome Web Store API documentation

### Firefox Add-ons API

The AMO API requires:

- JWT authentication using `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`
- Add-on ID: `flixmonkey@fran` (from `src/targets/firefox/manifest.json`, `browser_specific_settings.gecko.id`)
- PATCH request to `https://addons.mozilla.org/api/v4/addons/flixmonkey@fran/`
- Note: API endpoint and authentication method may need verification against current AMO API documentation

## File Changes

| File                                   | Change                      |
| -------------------------------------- | --------------------------- |
| `package.json`                         | Add `descriptionFull` field |
| `scripts/update-store-descriptions.js` | New file                    |
| `.github/workflows/publish-stores.yml` | Add two new steps           |

## Success Criteria

- [ ] `descriptionFull` field added to `package.json`
- [ ] `scripts/update-store-descriptions.js` created and working
- [ ] `publish-stores.yml` updated with description update steps
- [ ] Running the workflow successfully updates both store descriptions
- [ ] Workflow fails if description updates fail

## Related Issues

Resolves #80
