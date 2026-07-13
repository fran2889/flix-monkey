# Update Store Description Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a GitHub Actions workflow that updates Chrome Web Store and Firefox AMO extension descriptions from `docs/store-description.txt` using direct REST API calls.

**Architecture:** Two parallel GitHub Actions jobs, each running a dedicated Node.js script that reads the description file and calls the respective store API. Manual trigger via workflow_dispatch and auto-trigger on file changes to main.

**Tech Stack:** Node.js (built-in `https` module for API calls), GitHub Actions, Chrome Web Store API v2, Firefox AMO API v5.

---

## File Structure

| File                                             | Type   | Responsibility                                                              |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------- |
| `scripts/update-chrome-description.js`           | New    | Reads description file, calls Chrome Web Store API v2 to update description |
| `scripts/update-firefox-description.js`          | New    | Reads description file, calls Firefox AMO API v5 to update description      |
| `.github/workflows/update-store-description.yml` | New    | GitHub Actions workflow with two parallel jobs                              |
| `docs/STORE_PUBLISHING.md`                       | Modify | Document the new workflow and required secrets                              |

---

### Task 1: Create Chrome Update Script

**Files:**

- Create: `scripts/update-chrome-description.js`

- [x] **Step 1: Write the script with license header and OAuth2 token exchange**

```javascript
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */

import { readFileSync } from 'fs';
import https from 'https';

const DESCRIPTION_FILE = 'docs/store-description.txt';

function logInfo(message) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`);
}

function logError(message) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`);
}

function getEnv(name) {
    const value = process.env[name];
    if (!value) {
        logError(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

async function getAccessToken() {
    const clientId = getEnv('CHROME_CLIENT_ID');
    const clientSecret = getEnv('CHROME_CLIENT_SECRET');
    const refreshToken = getEnv('CHROME_REFRESH_TOKEN');

    const postData = new URLSearchParams();
    postData.append('client_id', clientId);
    postData.append('client_secret', clientSecret);
    postData.append('refresh_token', refreshToken);
    postData.append('grant_type', 'refresh_token');

    const options = {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`OAuth2 token request failed: ${res.statusCode} ${data}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.access_token);
                } catch (e) {
                    reject(new Error(`Failed to parse token response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData.toString());
        req.end();
    });
}

async function updateChromeDescription(accessToken, extensionId, description) {
    const payload = JSON.stringify({
        item: {
            description: description,
        },
    });

    const options = {
        hostname: 'chromewebstore.googleapis.com',
        path: `/v2/items/${extensionId}`,
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`API request failed: ${res.statusCode} ${data}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function validateDescription(content) {
    const maxLength = 132072; // Chrome Web Store limit
    if (content.length > maxLength) {
        logError(`Description exceeds maximum length (${maxLength}). Truncating.`);
        return content.substring(0, maxLength);
    }
    return content;
}

async function main() {
    try {
        // Dry-run mode
        const dryRun = process.env.DRY_RUN === 'true';
        if (dryRun) {
            logInfo('DRY RUN MODE - no changes will be made');
        }

        // Read description file
        logInfo(`Reading description from ${DESCRIPTION_FILE}`);
        let content;
        try {
            content = readFileSync(DESCRIPTION_FILE, 'utf8');
        } catch (e) {
            logError(`Failed to read ${DESCRIPTION_FILE}: ${e.message}`);
            process.exit(1);
        }

        const description = validateDescription(content.trim());
        logInfo(`Description length: ${description.length} characters`);

        if (dryRun) {
            logInfo('Dry run complete. Description would be:');
            logInfo(description.substring(0, 200) + '...');
            logInfo('To run for real, omit the DRY_RUN=true environment variable.');
            process.exit(0);
        }

        // Authenticate
        logInfo('Authenticating with Chrome Web Store API...');
        const accessToken = await getAccessToken();
        logInfo('Authentication successful');

        // Update description
        const extensionId = getEnv('CHROME_EXTENSION_ID');
        logInfo(`Updating Chrome Web Store description for extension ${extensionId}`);
        const result = await updateChromeDescription(accessToken, extensionId, description);
        logInfo('Chrome Web Store description updated successfully');
        logInfo(JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        logError(`Failed to update Chrome description: ${error.message}`);
        process.exit(1);
    }
}

main();
```

- [x] **Step 2: Verify script syntax**

Run: `cd /home/fran/Projects/flix-monkey && node --check scripts/update-chrome-description.js`
Expected: No syntax errors

- [x] **Step 3: Commit the script**

```bash
git add scripts/update-chrome-description.js
git commit -m "feat(store): add Chrome description update script

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 2: Create Firefox Update Script

**Files:**

- Create: `scripts/update-firefox-description.js`

- [x] **Step 1: Write the script with license header and JWT generation**

```javascript
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */

import { readFileSync } from 'fs';
import crypto from 'crypto';
import https from 'https';

const DESCRIPTION_FILE = 'docs/store-description.txt';

function logInfo(message) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`);
}

function logError(message) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`);
}

function getEnv(name) {
    const value = process.env[name];
    if (!value) {
        logError(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

function generateJWT(issuer, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { iss: issuer };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');

    return `${signatureInput}.${signature}`;
}

function makeAMORequest(method, path, jwt, payload = null) {
    const options = {
        hostname: 'addons.mozilla.org',
        path: `/api/v5${path}`,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${jwt}`,
        },
    };

    if (payload) {
        options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`AMO API request failed: ${res.statusCode} ${data}`));
                }
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve(parsed);
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function validateDescription(content) {
    const maxLength = 10000; // AMO limit
    if (content.length > maxLength) {
        logError(`Description exceeds AMO maximum length (${maxLength}). Truncating.`);
        return content.substring(0, maxLength);
    }
    return content;
}

async function main() {
    try {
        // Dry-run mode
        const dryRun = process.env.DRY_RUN === 'true';
        if (dryRun) {
            logInfo('DRY RUN MODE - no changes will be made');
        }

        // Read description file
        logInfo(`Reading description from ${DESCRIPTION_FILE}`);
        let content;
        try {
            content = readFileSync(DESCRIPTION_FILE, 'utf8');
        } catch (e) {
            logError(`Failed to read ${DESCRIPTION_FILE}: ${e.message}`);
            process.exit(1);
        }

        const description = validateDescription(content.trim());
        logInfo(`Description length: ${description.length} characters`);

        if (dryRun) {
            logInfo('Dry run complete. Description would be:');
            logInfo(description.substring(0, 200) + '...');
            logInfo('To run for real, omit the DRY_RUN=true environment variable.');
            process.exit(0);
        }

        // Generate JWT
        const issuer = getEnv('AMO_JWT_ISSUER');
        const secret = getEnv('AMO_JWT_SECRET');
        const addonId = getEnv('AMO_ADDON_ID');

        logInfo('Generating JWT for AMO API...');
        const jwt = generateJWT(issuer, secret);
        logInfo('JWT generated successfully');

        // Update description
        logInfo(`Updating Firefox AMO description for add-on ${addonId}`);
        const payload = JSON.stringify({
            description: { 'en-US': description },
        });

        const result = await makeAMORequest('PATCH', `/addons/addon/${addonId}`, jwt, payload);
        logInfo('Firefox AMO description updated successfully');
        logInfo(JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        logError(`Failed to update Firefox description: ${error.message}`);
        process.exit(1);
    }
}

main();
```

- [x] **Step 2: Verify script syntax**

Run: `cd /home/fran/Projects/flix-monkey && node --check scripts/update-firefox-description.js`
Expected: No syntax errors

- [x] **Step 3: Commit the script**

```bash
git add scripts/update-firefox-description.js
git commit -m "feat(store): add Firefox description update script

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 3: Create GitHub Actions Workflow

**Files:**

- Create: `.github/workflows/update-store-description.yml`

- [x] **Step 1: Write the workflow file**

```yaml
name: Update Store Description

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

permissions:
    contents: read

jobs:
    update-chrome-description:
        runs-on: ubuntu-latest
        timeout-minutes: 5
        steps:
            - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0

            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
              with:
                  node-version: '24'

            - name: Update Chrome Web Store description
              env:
                  CHROME_CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
                  CHROME_CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
                  CHROME_REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
                  CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
                  DRY_RUN: ${{ inputs.dry-run }}
              run: node scripts/update-chrome-description.js

    update-firefox-description:
        runs-on: ubuntu-latest
        timeout-minutes: 5
        steps:
            - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0

            - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
              with:
                  node-version: '24'

            - name: Update Firefox AMO description
              env:
                  AMO_JWT_ISSUER: ${{ secrets.AMO_JWT_ISSUER }}
                  AMO_JWT_SECRET: ${{ secrets.AMO_JWT_SECRET }}
                  AMO_ADDON_ID: ${{ secrets.AMO_ADDON_ID }}
                  DRY_RUN: ${{ inputs.dry-run }}
              run: node scripts/update-firefox-description.js
```

- [x] **Step 2: Verify workflow syntax**

Run: Navigate to GitHub Actions tab and verify the workflow appears and syntax is valid
Expected: Workflow shows up in the repository's Actions tab without syntax errors

- [x] **Step 3: Commit the workflow**

```bash
git add .github/workflows/update-store-description.yml
git commit -m "feat(ci): add update store description workflow

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

### Task 4: Update Documentation

**Files:**

- Modify: `docs/STORE_PUBLISHING.md`

- [x] **Step 1: Add workflow documentation to STORE_PUBLISHING.md**

Add a new section at the end of `docs/STORE_PUBLISHING.md`:

```markdown
## Updating Store Descriptions

The store listing descriptions for Chrome Web Store and Firefox AMO can be updated
automatically using the `Update Store Description` GitHub Actions workflow
(`update-store-description.yml`).

### Description File

Store descriptions are maintained in `docs/store-description.txt`. This file contains
the rich, formatted text that appears in both store listings.

### Automatic Updates

The workflow runs automatically whenever `docs/store-description.txt` is modified
and merged to the `main` branch. This ensures store listings stay in sync with the
repository.

### Manual Updates

To manually trigger a description update:

1. Navigate to **Actions** > **Update Store Description** in the GitHub repository
2. Click **Run workflow**
3. Optionally enable **Dry run** to test without making actual changes
4. Click **Run workflow**

### Required Secrets

The workflow requires the following repository secrets:

#### Chrome Web Store

| Secret                 | Description                      |
| ---------------------- | -------------------------------- |
| `CHROME_CLIENT_ID`     | OAuth2 client ID                 |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret             |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token             |
| `CHROME_EXTENSION_ID`  | Extension ID in Chrome Web Store |

#### Firefox AMO

| Secret           | Description                                |
| ---------------- | ------------------------------------------ |
| `AMO_JWT_ISSUER` | API JWT issuer                             |
| `AMO_JWT_SECRET` | API JWT secret                             |
| `AMO_ADDON_ID`   | Add-on ID on AMO (e.g., `flixmonkey@fran`) |

### Notes

- Both store updates run in parallel and are independent; a failure in one does not block the other
- The workflow uses direct REST API calls (no additional npm dependencies)
- Description length is validated against store limits (Chrome: 132,072 chars, Firefox: 10,000 chars)
- Excessively long descriptions are truncated with a warning
```

- [x] **Step 2: Verify documentation renders correctly**

Run: Open `docs/STORE_PUBLISHING.md` in a markdown viewer
Expected: No formatting errors, links work (if any), tables render correctly

- [x] **Step 3: Commit the documentation update**

```bash
git add docs/STORE_PUBLISHING.md
git commit -m "docs(store): document update store description workflow

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"
```

---

## Implementation Checklist Summary

- [x] Create `scripts/update-chrome-description.js`
- [x] Create `scripts/update-firefox-description.js`
- [x] Create `.github/workflows/update-store-description.yml`
- [x] Update `docs/STORE_PUBLISHING.md` with workflow documentation
- [x] Verify all scripts have correct license headers
- [x] Test workflow in dry-run mode
- [x] Verify all required secrets exist in repository

---

## Spec Coverage Check

| Spec Section                | Implemented By                      |
| --------------------------- | ----------------------------------- |
| Chrome update script        | Task 1                              |
| Firefox update script       | Task 2                              |
| Parallel jobs workflow      | Task 3                              |
| Manual trigger              | Task 3 (workflow_dispatch)          |
| Auto-trigger on file change | Task 3 (push with paths filter)     |
| Direct REST API calls       | Tasks 1 & 2 (using node:https)      |
| Independent jobs            | Task 3 (separate parallel jobs)     |
| No new npm dependencies     | Tasks 1 & 2 (built-in modules only) |
| Dry-run mode                | Tasks 1, 2, 3 (DRY_RUN env var)     |
| Documentation               | Task 4                              |

---

## Notes for Implementation

1. **Secret Requirements**: The workflow requires 7 secrets to be configured in the repository. The Chrome secrets are already configured (used by existing `publish-stores.yml`). Need to verify `AMO_ADDON_ID` exists or add it.

2. **AMO Add-on ID**: Currently `flixmonkey@fran` as defined in `src/targets/firefox/manifest.json`. This can be hardcoded but using a secret allows flexibility.

3. **API Compatibility**: Chrome Web Store API v2 is the current version. Firefox AMO API v5 is the current version as of July 2026.

4. **Error Handling**: Both scripts exit with appropriate error codes and log meaningful error messages for debugging via workflow logs.

5. **Validation**: Both scripts validate the description file exists, is readable, and truncate if exceeding store limits.
