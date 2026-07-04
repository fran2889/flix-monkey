# Store Description Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically update the full store description for Chrome Web Store and Firefox Add-ons when publishing a new release

**Architecture:** Store the full description in `docs/store-description.txt` as plain text, create a Node.js script that reads this file and uses existing API credentials to update both store listings, and integrate this script into the existing `publish-stores.yml` workflow. Each update function validates its own credentials. The script runs after both extensions are published, updating Chrome description first, then Firefox.

**Tech Stack:** Node.js 24+, GitHub Actions, Chrome Web Store API, Firefox Add-ons (AMO) API

## Global Constraints

- Node.js version: >= 24
- Existing secrets must be used: `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_EXTENSION_ID`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`
- Description format: Plain text (no markdown, no HTML)
- Workflow order: Publish Chrome -> Publish Firefox -> Update both descriptions
- Error handling: Description updates are blocking (fail on error)
- Single description used for both stores
- Firefox add-on ID: `flixmonkey@fran` (from `src/targets/firefox/manifest.json`)
- Chrome extension ID: From `CHROME_EXTENSION_ID` secret
- Resolves #80

## Notes on API Endpoints

- Chrome Web Store API: The update endpoint structure (`itemListings`) may need verification against current API docs
- Firefox AMO API: The PATCH endpoint and JWT authentication may need verification. The `jose` library is required for JWT signing.

---

## File Structure

| File                                   | Responsibility                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/store-description.txt`           | New file - source of truth for full store description in plain text                   |
| `scripts/update-store-descriptions.js` | New script - reads from .txt file, each update function validates its own credentials |
| `.github/workflows/publish-stores.yml` | Modified - add update-descriptions job                                                |

---

## Tasks

---

### Task 1: Create store description text file

**Files:**

- Create: `docs/store-description.txt`

**Interfaces:**

- Produces: `docs/store-description.txt` - plain text file with full store description

- [ ] **Step 1: Read current docs/DESCRIPTIONS.md full description**

    Read the full description section from `docs/DESCRIPTIONS.md` (lines 9-36)

- [ ] **Step 2: Convert markdown to plain text**

    Convert the markdown content to plain text:
    - Remove `# ` headers
    - Keep bullet points as `• ` (actual bullet character)
    - Preserve paragraph breaks as actual newlines
    - Keep the content structure intact

    Result should be:

    ```
    FlixMonkey adds IMDb, Metacritic, and Rotten Tomatoes ratings directly to Netflix, helping you decide what to watch before you press play.

    Ratings appear on title cards, hover previews, detail views, and search results. You can also filter out low-rated titles and quickly jump to IMDb for more details.

    Available as a Chrome extension, Firefox add-on, and Greasemonkey userscript.

    FEATURES
    • View IMDb ratings directly on Netflix titles, with Metacritic and Rotten Tomatoes added when available
    • Click the IMDb badge to open the title on IMDb, or search IMDb when no match is found
    • Optionally fade out titles below a chosen IMDb rating threshold

    RATING PROVIDERS
    FlixMonkey supports multiple rating sources:
    • Agregarr (default): Provides IMDb ratings only. No API key required
    • OMDb (recommended): Provides IMDb, Metacritic, and Rotten Tomatoes ratings with a free API key
    • XMDb: Provides IMDb and Metacritic ratings with a free API key
    • IMDb API (deprecated): Unreliable due to low rate limits

    CACHING
    Ratings are cached locally to keep browsing fast and reduce API usage:
    • Older titles (1+ year) are cached indefinitely
    • Recent titles refresh monthly to capture updated ratings
    • Unrated titles are retried after 24 hours
    • Failing providers are temporarily paused to prevent repeated errors

    LICENSE
    Licensed under GPLv3. Documentation and source code are available on GitHub:
    https://github.com/fran2889/flix-monkey
    ```

- [ ] **Step 3: Create docs/store-description.txt**

    Create the file with the converted plain text content. The file should have actual newlines (not JSON escape sequences).

- [ ] **Step 4: Verify file content**

    Run: `cat docs/store-description.txt | head -5`

    Expected: First 5 lines of the description

- [ ] **Step 5: Commit**

    ```bash
    git add docs/store-description.txt
    git commit -m "feat: add store description text file
    ```

Resolves #80"

````

---

### Task 2: Add jose dependency and create update script

**Files:**
- Modify: `package.json` (add dependency)
- Create: `scripts/update-store-descriptions.js`

**Interfaces:**
- Consumes: `docs/store-description.txt` (plain text)
- Consumes: Environment variables: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`
- Produces: stdout logs, process exit code
- Each update function validates its own credentials

- [ ] **Step 1: Add jose dependency to package.json**

Run: `npm install jose --save`

- [ ] **Step 2: Create scripts/update-store-descriptions.js**

```javascript
/*!
* FlixMonkey - Browser extension for Netflix ratings
* Copyright (C) 2024  fran
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { SignJWT } from 'jose';
import fs from 'fs';
import path from 'path';

const descriptionPath = path.resolve(process.cwd(), 'docs', 'store-description.txt');

async function updateChromeDescription(description, extensionId, clientId, clientSecret, refreshToken) {
  if (!extensionId || !clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Chrome Web Store credentials');
  }
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
});

if (!tokenResponse.ok) {
  const errorText = await tokenResponse.text();
  throw new Error(`Chrome OAuth failed: ${tokenResponse.status} ${tokenResponse.statusText}\n${errorText}`);
}

const { access_token: accessToken } = await tokenResponse.json();

const updateResponse = await fetch(`https://chromewebstore.googleapis.com/v1.1/items/${extensionId}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    itemListings: [{ description }],
  }),
});

if (!updateResponse.ok) {
  const errorText = await updateResponse.text();
  throw new Error(`Chrome description update failed: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
}

console.log('Chrome Web Store description updated successfully');
}

async function updateFirefoxDescription(description, addonId, jwtIssuer, jwtSecret) {
  if (!jwtIssuer || !jwtSecret) {
      throw new Error('Missing Firefox Add-ons credentials');
  }

  const now = Math.floor(Date.now() / 1000);
const secret = new TextEncoder().encode(jwtSecret);

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt(now)
  .setIssuer(jwtIssuer)
  .setExpirationTime(now + 60)
  .sign(secret);

const response = await fetch(`https://addons.mozilla.org/api/v4/addons/${addonId}/`, {
  method: 'PATCH',
  headers: {
    Authorization: `JWT ${jwt}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ description }),
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Firefox description update failed: ${response.status} ${response.statusText}\n${errorText}`);
}

console.log('Firefox Add-ons description updated successfully');
}

async function main() {
  const description = fs.readFileSync(descriptionPath, 'utf8').trim();

  if (!description) {
      throw new Error('Store description file is empty');
  }

  const extensionId = process.env.CHROME_EXTENSION_ID;
  const clientId = process.env.CHROME_CLIENT_ID;
  const clientSecret = process.env.CHROME_CLIENT_SECRET;
  const refreshToken = process.env.CHROME_REFRESH_TOKEN;
  const jwtIssuer = process.env.AMO_JWT_ISSUER;
  const jwtSecret = process.env.AMO_JWT_SECRET;
  const addonId = 'flixmonkey@fran';

  console.log('Updating Chrome Web Store description...');
  await updateChromeDescription(description, extensionId, clientId, clientSecret, refreshToken);

  console.log('Updating Firefox Add-ons description...');
  await updateFirefoxDescription(description, addonId, jwtIssuer, jwtSecret);

  console.log('All store descriptions updated successfully');
}

main().catch(error => {
console.error('Error updating store descriptions:', error);
process.exit(1);
});
````

- [ ] **Step 3: Verify script syntax**

    Run: `node --check scripts/update-store-descriptions.js`

    Expected: No errors

- [ ] **Step 4: Commit**

    ```bash
    git add scripts/update-store-descriptions.js package.json package-lock.json
    git commit -m "feat: add store description update script with per-function credential validation
    ```

Resolves #80"

````

**Note:** The Chrome Web Store API endpoint (`https://chromewebstore.googleapis.com/v1.1/items/{extensionId}`) and request body structure (`itemListings`) may need verification against current Google documentation. The Firefox AMO API endpoint (`https://addons.mozilla.org/api/v4/addons/{addonId}/`) and JWT authentication may also need verification.

---

### Task 3: Update publish-stores.yml workflow

**Files:**
- Modify: `.github/workflows/publish-stores.yml`

**Interfaces:**
- Consumes: `scripts/update-store-descriptions.js` (executable script)

- [ ] **Step 1: Add description update job to workflow**

Add a new job at the end of `.github/workflows/publish-stores.yml` (after the `publish-firefox` job):

```yaml
update-descriptions:
  needs: [publish-chrome, publish-firefox]
  runs-on: ubuntu-latest
  timeout-minutes: 5
  steps:
    - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
      with:
        node-version: '24'
        cache: 'npm'
    - run: npm ci --ignore-scripts
    - name: Update store descriptions
      run: node scripts/update-store-descriptions.js
      env:
        CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
        CHROME_CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
        CHROME_CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
        CHROME_REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
        AMO_JWT_ISSUER: ${{ secrets.AMO_JWT_ISSUER }}
        AMO_JWT_SECRET: ${{ secrets.AMO_JWT_SECRET }}
````

**Note:** The `needs: [publish-chrome, publish-firefox]` ensures this job only runs after both publish jobs complete successfully.

- [ ] **Step 2: Verify workflow syntax**

    Check YAML validity using a linter or manual inspection

    Expected: Valid YAML, proper indentation

    **Note:** The workflow uses `npm ci --ignore-scripts` which will install the `jose` dependency added in Task 2, as it's now in package-lock.json.

- [ ] **Step 3: Commit**

    ```bash
    git add .github/workflows/publish-stores.yml
    git commit -m "ci: add store description update job to publish workflow
    ```

Resolves #80"

````

---

### Task 4: End-to-end verification

**Files:**
- No file changes - verification only

- [ ] **Step 1: Test the script locally (optional)**

If you have API credentials, test with:
```bash
CHROME_EXTENSION_ID=your_id \
CHROME_CLIENT_ID=your_client_id \
CHROME_CLIENT_SECRET=your_secret \
CHROME_REFRESH_TOKEN=your_token \
AMO_JWT_ISSUER=your_issuer \
AMO_JWT_SECRET=your_secret \
node scripts/update-store-descriptions.js
````

- [ ] **Step 2: Push changes and create test release**

    Push the branch and create a test release to verify the workflow

- [ ] **Step 3: Run publish-stores.yml with test tag**

    Trigger the workflow manually with a test release tag

- [ ] **Step 4: Verify both store descriptions updated**

    Manually check both store listings

---

## Self-Review

1. **Spec coverage:**
    - [x] Data source: Task 1 creates `docs/store-description.txt`
    - [x] Update script: Task 2 creates `scripts/update-store-descriptions.js`
    - [x] Workflow integration: Task 3 updates `publish-stores.yml`
    - [x] Error handling: Script exits with error code 1 on failures
    - [x] Credential validation: Each update function validates its own credentials
    - [x] Workflow order: `needs: [publish-chrome, publish-firefox]` ensures correct order
    - [x] Resolves #80: Noted in all commit messages

2. **Placeholder scan:**
    - [x] No TBD, TODO, or implement later
    - [x] All code blocks are complete
    - [x] Exact file paths used
    - [x] Complete commands with expected output

3. **Type consistency:**
    - [x] Description is read as plain text from .txt file
    - [x] Environment variable names match throughout
    - [x] Function signatures are consistent
