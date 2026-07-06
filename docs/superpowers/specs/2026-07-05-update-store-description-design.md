---
title: Update Store Description Workflow Design
created: 2026-07-05
author: Mistral Vibe
status: approved
resolves: '#80'
---

# Update Store Description Workflow Design

## Overview

This design specifies a GitHub Actions workflow to automatically update the description of FlixMonkey in the Chrome Web Store and Firefox Add-ons (AMO) using the content from `docs/store-description.txt`. The workflow supports both manual triggering and automatic triggering when the description file is updated in the `main` branch.

## Background

The store description for FlixMonkey is maintained in `docs/store-description.txt` as a rich, formatted text (30 lines). Currently, this content is not automatically synchronized with the Chrome Web Store and Firefox AMO listings. The existing `publish-stores.yml` workflow handles publishing new versions but does not update the store listing descriptions separately.

The `package.json` description field contains a short description and is used for manifest injection during builds. The store description file is independent and intended solely for store listing updates via API.

## Goals

1. Automatically update Chrome Web Store extension description from `docs/store-description.txt`
2. Automatically update Firefox AMO add-on description from `docs/store-description.txt`
3. Support manual triggering via GitHub Actions UI
4. Support automatic triggering when `docs/store-description.txt` is modified in `main`
5. Keep Chrome and Firefox updates independent (failure in one does not block the other)
6. Use direct REST API calls (no additional npm dependencies)

## Non-Goals

- Updating `package.json` description
- Rebuilding or republishing extension artifacts
- Updating other store metadata (icons, screenshots, etc.)
- Adding unit tests for the update scripts

## Architecture

### Components

| Component                                        | Type                    | Responsibility                                        |
| ------------------------------------------------ | ----------------------- | ----------------------------------------------------- |
| `scripts/update-chrome-description.js`           | Node.js script          | Reads description file, calls Chrome Web Store API v2 |
| `scripts/update-firefox-description.js`          | Node.js script          | Reads description file, calls Firefox AMO API v5      |
| `.github/workflows/update-store-description.yml` | GitHub Actions workflow | Orchestrates both update jobs                         |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Workflow                        │
│  ┌─────────────────────────┐    ┌─────────────────────────┐   │
│  │  update-chrome-description│    │update-firefox-description│   │
│  │  (parallel job)          │    │  (parallel job)          │   │
│  └──────────┬──────────────┘    └──────────┬──────────────┘   │
│             │                                │                           │
│  ┌──────────▼──────────────┐    ┌──────────▼──────────────┐   │
│  │ scripts/update-chrome-  │    │ scripts/update-firefox- │   │
│  │    description.js        │    │    description.js        │   │
│  └──────────┬──────────────┘    └──────────┬──────────────┘   │
│             │                                │                           │
│  ┌──────────▼──────────────┐    ┌──────────▼──────────────┐   │
│  │ docs/store-description   │    │ docs/store-description   │   │
│  │    .txt                  │    │    .txt                  │   │
│  └──────────┬──────────────┘    └──────────┬──────────────┘   │
│             │                                │                           │
│  ┌──────────▼──────────────┐    ┌──────────▼──────────────┐   │
│  │ Chrome Web Store API v2  │    │ Firefox AMO API v5        │   │
│  │   PATCH /items/{id}       │    │   PATCH /addons/addon/    │   │
│  └──────────────────────────┘    └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Specification

### Trigger

```yaml
on:
    workflow_dispatch:
        inputs:
            dry-run:
                description: 'Test without actually updating (true/false)'
                required: false
                default: 'false'
                type: string
    push:
        branches: [main]
        paths: ['docs/store-description.txt']
```

The workflow triggers:

1. **Manually**: Via GitHub Actions UI with optional dry-run mode
2. **Automatically**: When `docs/store-description.txt` is modified and merged to `main`

### Jobs

#### Job: `update-chrome-description`

**Runs on**: `ubuntu-latest`
**Timeout**: 5 minutes
**Secrets required**:

- `CHROME_CLIENT_ID` - OAuth2 client ID
- `CHROME_CLIENT_SECRET` - OAuth2 client secret
- `CHROME_REFRESH_TOKEN` - OAuth2 refresh token
- `CHROME_EXTENSION_ID` - Extension ID in Chrome Web Store

**Steps**:

1. Checkout repository
2. Setup Node.js (v24)
3. Run `node scripts/update-chrome-description.js`

#### Job: `update-firefox-description`

**Runs on**: `ubuntu-latest`
**Timeout**: 5 minutes
**Secrets required**:

- `AMO_JWT_ISSUER` - AMO API JWT issuer
- `AMO_JWT_SECRET` - AMO API JWT secret
- `AMO_ADDON_ID` - Add-on ID on AMO (currently `flixmonkey@fran`)

**Steps**:

1. Checkout repository
2. Setup Node.js (v24)
3. Run `node scripts/update-firefox-description.js`

### Parallel Execution

Both jobs run in parallel with no dependencies between them. The workflow succeeds if both jobs succeed. If one job fails, the other continues and the workflow result reflects the failure(s).

## Script Specifications

### `scripts/update-chrome-description.js`

**Inputs**:

- Reads `docs/store-description.txt` (UTF-8)
- Uses environment variables: `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_EXTENSION_ID`

**Process**:

1. Validate file exists and is readable
2. Read file content
3. Obtain OAuth2 access token using client credentials and refresh token
4. Call Chrome Web Store API v2 `PATCH /items/{extensionId}` with description in request body
5. Handle response and log result

**API Endpoint**: `https://chromewebstore.googleapis.com/v2/items/{extensionId}`

**Authentication**: OAuth2 with refresh token flow

- Token endpoint: `https://oauth2.googleapis.com/token`
- Scope: `https://www.googleapis.com/auth/chromewebstore`

**Request Payload**:

```json
{
    "item": {
        "description": "<file content>"
    }
}
```

**Error Handling**:

- File not found: Exit with error code 1
- Authentication failure: Exit with error code 2
- API request failure: Exit with error code 3
- API response error: Log error message, exit with error code 4

### `scripts/update-firefox-description.js`

**Inputs**:

- Reads `docs/store-description.txt` (UTF-8)
- Uses `AMO_ADDON_ID` environment variable

**Process**:

1. Validate file exists and is readable
2. Read file content
3. Generate JWT token using AMO JWT issuer and secret
4. Call AMO API v5 `PATCH /addons/addon/{addonId}` with description in request body
5. Handle response and log result

**API Endpoint**: `https://addons.mozilla.org/api/v5/addons/addon/{addonId}`

**Authentication**: JWT signed with shared secret

- Algorithm: HS256
- JWT payload includes issuer (`AMO_JWT_ISSUER`)

**Request Payload**:

```json
{
    "description": { "en-US": "<file content>" }
}
```

**Error Handling**:

- File not found: Exit with error code 1
- Authentication failure: Exit with error code 2
- API request failure: Exit with error code 3
- API response error: Log error message, exit with error code 4

## File Requirements

### `docs/store-description.txt`

- Must exist at the repository root
- UTF-8 encoded
- Maximum length: Chrome Web Store allows 132,072 characters; AMO allows 10,000 characters. Scripts should validate and truncate if needed, with a warning.

## Error Handling Strategy

### Job Level

- Each job runs independently
- Workflow continues if one job fails (parallel execution)
- Workflow overall status: succeeds only if both jobs succeed

### Script Level

- Validate input file before API calls
- Catch and log all errors with meaningful messages
- Exit with appropriate error codes for different failure types

### Logging

- Info-level logging for each step
- Error logging with context for failures
- Dry-run mode logs what would be sent without making actual API calls

## Security Considerations

### Secrets Management

All secrets are stored as GitHub Actions repository secrets:

- `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_EXTENSION_ID`
- `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`, `AMO_ADDON_ID`

### Permissions

Workflow requires no special repository permissions (default `contents: read` is sufficient).

### Token Security

- OAuth2 tokens are short-lived and not stored
- JWT tokens are generated per-run and not persisted
- No secrets are logged or exposed in workflow outputs

## Testing Strategy

### Manual Testing

1. Test with dry-run mode enabled via workflow dispatch
2. Verify scripts correctly read and parse the description file
3. Verify API payload formatting is correct
4. Test with actual API credentials against production stores

### Validation

1. Workflow file syntax validated by GitHub Actions
2. Scripts can be tested locally with appropriate credentials
3. Error paths tested by temporarily using invalid credentials/secrets

## Implementation Checklist

- [ ] Create `scripts/update-chrome-description.js`
- [ ] Create `scripts/update-firefox-description.js`
- [ ] Add license headers to both scripts (matching project template)
- [ ] Create `.github/workflows/update-store-description.yml`
- [ ] Verify all required secrets exist in repository
- [ ] Run workflow in dry-run mode
- [ ] Run workflow against production stores
- [ ] Document the workflow in `docs/STORE_PUBLISHING.md`

## Open Questions

None at this time.

## References

- Chrome Web Store API v2: https://developer.chrome.com/docs/webstore/api
- Firefox AMO API v5: https://mozilla.github.io/addons-server/topics/api/addons.html
- GitHub Actions workflow syntax: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
- Resolves: #80
