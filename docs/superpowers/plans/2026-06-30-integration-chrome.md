# Integration Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only Playwright Test suite that verifies the built Chrome extension against a live, pre-authenticated Netflix browser profile.

**Architecture:** Playwright Test launches one persistent Chrome or Chromium context with the unpacked `dist/chrome` extension loaded. Test fixtures expose the Netflix page, extension service worker, extension storage helpers, cache seeding helpers, options-page helpers, and overlay assertions. The suite uses deterministic seeded cache data, not live rating API responses.

**Tech Stack:** Node.js >= 24, ES modules, Playwright Test, dotenv, Chrome MV3 extension APIs, existing Rollup Chrome build.

## Global Constraints

- Suite name and paths: `integration-chrome`, `tests/integration-chrome/`, `playwright.integration-chrome.config.js`, and `npm run test:integration-chrome`.
- This suite must not be included in `npm test` or regular PR CI.
- The Netflix browse URL is a code constant, not an environment variable.
- Local settings in `.env`: `CHROME_EXECUTABLE_PATH`, `CHROME_USER_DATA_DIR`, `CHROME_PROFILE_DIRECTORY`, `NETFLIX_PROFILE_NAME`, `CHROME_INTEGRATION_HEADLESS`, `CHROME_INTEGRATION_KEEP_OPEN`, and `CHROME_INTEGRATION_TIMEOUT_MS`.
- The Chrome profile is dedicated to FlixMonkey integration testing and must already be logged into Netflix.
- At suite start and cleanup: preserve `omdbApiKey` and `xmdbApiKey`; remove all other option/config keys; remove all `fmc:*` cache entries; remove all `fm-fade:*` overrides.
- Tests seed known cache entries for visible Netflix titles. Assertions compare rendered overlays to seeded cache data.
- Any direct settings storage change requires Netflix reload before assertions.
- Any settings UI save is expected to reload Netflix tabs before assertions.
- Fade override clicks must update the live DOM immediately and persist after reload.
- Files in `tests/` must include the GPL-3.0 license header matching `LICENSE_HEADER.template`.

---

## File Structure

- `package.json`: add Playwright Test dependency and `test:integration-chrome` script.
- `.env.example`: document local Chrome/Netflix variables.
- `playwright.integration-chrome.config.js`: Playwright Test config for this suite only.
- `tests/integration-chrome/env.js`: load and validate `.env` settings.
- `tests/integration-chrome/global-setup.js`: run `npm run build:chrome` and validate local prerequisites before browser launch.
- `tests/integration-chrome/fixtures.js`: Playwright fixtures for persistent context, Netflix page, extension service worker, storage helper, and options page helper.
- `tests/integration-chrome/helpers/storage.js`: extension storage reset, redaction, cache seeding, and disabled-client seeding.
- `tests/integration-chrome/helpers/netflix.js`: Netflix URL constant, profile chooser handling, browse readiness, visible title discovery, surface targeting, and reload waits.
- `tests/integration-chrome/helpers/options-page.js`: options-page field interactions and save/reload coordination.
- `tests/integration-chrome/helpers/overlays.js`: overlay, badge, corner, fade, and fade-toggle assertions.
- `tests/integration-chrome/ratings.chrome.test.js`: ratings display, RT/MC settings, and overlay position tests.
- `tests/integration-chrome/fade.chrome.test.js`: fade threshold and fade override tests.
- `tests/integration-chrome/settings-maintenance.chrome.test.js`: Clear Cache and Reset Disabled Clients tests.
- `README.md`: local setup and execution documentation.

---

### Task 1: Add Playwright Configuration And Environment Guard

**Files:**

- Modify: `package.json`
- Modify: `.env.example`
- Create: `playwright.integration-chrome.config.js`
- Create: `tests/integration-chrome/env.js`
- Create: `tests/integration-chrome/global-setup.js`

**Interfaces:**

- Produces: `loadChromeIntegrationEnv(): ChromeIntegrationEnv`
- Produces: `redactEnv(env: ChromeIntegrationEnv): Record<string, string|boolean|number|null>`
- Produces: Playwright config with `testDir: './tests/integration-chrome'`
- Consumes later: every fixture and helper imports `loadChromeIntegrationEnv()`

`ChromeIntegrationEnv` shape:

```js
{
    chromeExecutablePath: string,
    chromeUserDataDir: string,
    chromeProfileDirectory: string,
    netflixProfileName: string,
    headless: boolean,
    keepOpen: boolean,
    timeoutMs: number,
}
```

- [ ] **Step 1: Install Playwright Test**

Run:

```bash
npm install -D @playwright/test
```

Expected: `package.json` and `package-lock.json` update with `@playwright/test`.

- [ ] **Step 2: Add the npm script**

Modify `package.json` `scripts` to include:

```json
"test:integration-chrome": "playwright test -c playwright.integration-chrome.config.js"
```

Expected: `npm run test:integration-chrome -- --list` invokes Playwright after the config exists.

- [ ] **Step 3: Extend `.env.example`**

Append this section to `.env.example`:

```dotenv

# Chrome integration tests
# Use a dedicated Chrome/Chromium profile that is already logged into Netflix.
CHROME_EXECUTABLE_PATH=/path/to/chrome-or-chromium
CHROME_USER_DATA_DIR=/path/to/flixmonkey-chrome-profile
CHROME_PROFILE_DIRECTORY=
NETFLIX_PROFILE_NAME=Your Netflix Profile
CHROME_INTEGRATION_HEADLESS=false
CHROME_INTEGRATION_KEEP_OPEN=false
CHROME_INTEGRATION_TIMEOUT_MS=30000
```

- [ ] **Step 4: Create `tests/integration-chrome/env.js`**

Create `tests/integration-chrome/env.js` with:

```js
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
import { existsSync } from 'node:fs';
import { config } from 'dotenv';

config();

function parseBoolean(name, defaultValue) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return defaultValue;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`${name} must be "true" or "false"; received "${raw}"`);
}

function parseTimeout() {
    const raw = process.env.CHROME_INTEGRATION_TIMEOUT_MS ?? '30000';
    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`CHROME_INTEGRATION_TIMEOUT_MS must be a positive integer; received "${raw}"`);
    }
    return value;
}

function requirePath(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for npm run test:integration-chrome`);
    if (!existsSync(value)) throw new Error(`${name} does not exist: ${value}`);
    return value;
}

export function loadChromeIntegrationEnv() {
    const netflixProfileName = process.env.NETFLIX_PROFILE_NAME;
    if (!netflixProfileName) {
        throw new Error('NETFLIX_PROFILE_NAME is required for npm run test:integration-chrome');
    }

    return {
        chromeExecutablePath: requirePath('CHROME_EXECUTABLE_PATH'),
        chromeUserDataDir: requirePath('CHROME_USER_DATA_DIR'),
        chromeProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY ?? '',
        netflixProfileName,
        headless: parseBoolean('CHROME_INTEGRATION_HEADLESS', false),
        keepOpen: parseBoolean('CHROME_INTEGRATION_KEEP_OPEN', false),
        timeoutMs: parseTimeout(),
    };
}

export function redactEnv(env) {
    return {
        ...env,
        chromeExecutablePath: env.chromeExecutablePath ? '<configured>' : null,
        chromeUserDataDir: env.chromeUserDataDir ? '<configured>' : null,
    };
}
```

- [ ] **Step 5: Create `tests/integration-chrome/global-setup.js`**

Create `tests/integration-chrome/global-setup.js` with:

```js
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
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadChromeIntegrationEnv, redactEnv } from './env.js';

export default async function globalSetup() {
    const env = loadChromeIntegrationEnv();
    console.info('Chrome integration environment:', redactEnv(env));

    execFileSync('npm', ['run', 'build:chrome'], {
        cwd: process.cwd(),
        stdio: 'inherit',
    });

    const extensionPath = resolve(process.cwd(), 'dist/chrome');
    if (!existsSync(extensionPath)) {
        throw new Error(`Chrome extension build output missing: ${extensionPath}`);
    }
}
```

- [ ] **Step 6: Create `playwright.integration-chrome.config.js`**

Create `playwright.integration-chrome.config.js` with:

```js
import { defineConfig } from '@playwright/test';
import { loadChromeIntegrationEnv } from './tests/integration-chrome/env.js';

const env = loadChromeIntegrationEnv();

export default defineConfig({
    testDir: './tests/integration-chrome',
    testMatch: '**/*.chrome.test.js',
    globalSetup: './tests/integration-chrome/global-setup.js',
    fullyParallel: false,
    workers: 1,
    timeout: env.timeoutMs,
    expect: {
        timeout: env.timeoutMs,
    },
    reporter: [['list'], ['html', { outputFolder: 'test-results/integration-chrome-report', open: 'never' }]],
    use: {
        actionTimeout: env.timeoutMs,
        navigationTimeout: env.timeoutMs,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
});
```

- [ ] **Step 7: Verify config listing**

Run:

```bash
npm run test:integration-chrome -- --list
```

Expected when `.env` is missing required values: FAIL with a clear error naming the missing key, such as `CHROME_EXECUTABLE_PATH is required for npm run test:integration-chrome`.

Expected when `.env` is populated and no tests exist yet: Playwright lists no tests and exits without browser test failures.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example playwright.integration-chrome.config.js tests/integration-chrome/env.js tests/integration-chrome/global-setup.js
git commit -m "test(integration-chrome): add playwright suite config"
```

---

### Task 2: Add Browser, Extension, Netflix, And Storage Fixtures

**Files:**

- Create: `tests/integration-chrome/fixtures.js`
- Create: `tests/integration-chrome/helpers/storage.js`
- Create: `tests/integration-chrome/helpers/netflix.js`

**Interfaces:**

- Consumes: `loadChromeIntegrationEnv()` from `tests/integration-chrome/env.js`
- Produces: `test` and `expect` exports from `tests/integration-chrome/fixtures.js`
- Produces: `storage.getAll(): Promise<Record<string, unknown>>`
- Produces: `storage.set(values: Record<string, unknown>): Promise<void>`
- Produces: `storage.remove(keys: string[]): Promise<void>`
- Produces: `storage.resetForCleanRun(): Promise<void>`
- Produces: `storage.seedRatings(titles: VisibleTitle[], ratings: SeedRating[]): Promise<SeededTitle[]>`
- Produces: `storage.seedDisabledClients(sources: string[]): Promise<void>`
- Produces: `ensureNetflixBrowseReady(page, env): Promise<void>`
- Produces: `discoverVisibleTitles(page): Promise<VisibleTitle[]>`

`VisibleTitle` shape:

```js
{
    title: string,
    slug: string,
    surfaceSelector: string,
}
```

`SeededTitle` shape:

```js
{
    title: string,
    slug: string,
    cacheKey: string,
    rating: number,
    rtRating: number,
    mcRating: number,
    imdbId: string,
}
```

- [ ] **Step 1: Create storage helper**

Create `tests/integration-chrome/helpers/storage.js` with:

```js
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
import { CONFIG_FIELDS } from '../../../src/core/config-fields.js';

const API_KEY_FIELDS = new Set(['omdbApiKey', 'xmdbApiKey']);
const CONFIG_FIELD_KEYS = new Set(CONFIG_FIELDS.map(field => field.key));
const CACHE_PREFIX = 'fmc:';
const FADE_PREFIX = 'fm-fade:';
const DISABLED_PREFIX = 'fm_disabled_';

export function slugifyTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

export function createStorageHelper(serviceWorker) {
    async function getAll() {
        return await serviceWorker.evaluate(() => chrome.storage.local.get(null));
    }

    async function set(values) {
        await serviceWorker.evaluate(async data => chrome.storage.local.set(data), values);
    }

    async function remove(keys) {
        if (keys.length === 0) return;
        await serviceWorker.evaluate(async keysToRemove => chrome.storage.local.remove(keysToRemove), keys);
    }

    async function resetForCleanRun() {
        const all = await getAll();
        const keysToRemove = Object.keys(all).filter(key => {
            if (API_KEY_FIELDS.has(key)) return false;
            return CONFIG_FIELD_KEYS.has(key) || key.startsWith(CACHE_PREFIX) || key.startsWith(FADE_PREFIX);
        });
        await remove(keysToRemove);
    }

    async function seedRatings(titles, ratings) {
        const seeded = titles.map((title, index) => {
            const rating = ratings[index % ratings.length];
            const slug = slugifyTitle(title.title);
            const cacheKey = `${CACHE_PREFIX}${slug}`;
            const titleData = {
                displayTitle: title.title,
                apiTitle: title.title,
                imdbId: rating.imdbId,
                year: 2001 + index,
                rating: rating.rating,
                rtRating: rating.rtRating,
                mcRating: rating.mcRating,
                source: 'agregarr',
                type: 'movie',
            };
            return {
                ...title,
                ...rating,
                slug,
                cacheKey,
                cacheEntry: JSON.stringify({
                    data: titleData,
                    expires: null,
                }),
            };
        });

        await set(Object.fromEntries(seeded.map(title => [title.cacheKey, title.cacheEntry])));
        return seeded.map(({ cacheEntry, ...title }) => title);
    }

    async function seedDisabledClients(sources) {
        const disabledUntil = Date.now() + 60 * 60 * 1000;
        await set(Object.fromEntries(sources.map(source => [`${DISABLED_PREFIX}${source}`, String(disabledUntil)])));
    }

    async function getKeysByPrefix(prefix) {
        const all = await getAll();
        return Object.keys(all).filter(key => key.startsWith(prefix));
    }

    async function redactAll() {
        const all = await getAll();
        return Object.fromEntries(
            Object.entries(all).map(([key, value]) => [
                API_KEY_FIELDS.has(key) ? key : key,
                API_KEY_FIELDS.has(key) ? '<redacted>' : value,
            ])
        );
    }

    return {
        getAll,
        set,
        remove,
        resetForCleanRun,
        seedRatings,
        seedDisabledClients,
        getKeysByPrefix,
        redactAll,
        prefixes: {
            cache: CACHE_PREFIX,
            fade: FADE_PREFIX,
            disabled: DISABLED_PREFIX,
        },
    };
}
```

- [ ] **Step 2: Create Netflix helper**

Create `tests/integration-chrome/helpers/netflix.js` with:

```js
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
import { expect } from '@playwright/test';
import { slugifyTitle } from './storage.js';

export const NETFLIX_BROWSE_URL = 'https://www.netflix.com/browse';

export async function ensureNetflixBrowseReady(page, env) {
    await page.goto(NETFLIX_BROWSE_URL, { waitUntil: 'domcontentloaded' });
    await selectNetflixProfileIfNeeded(page, env.netflixProfileName);

    const loggedOut = page.getByRole('link', { name: /sign in/i });
    if (await loggedOut.isVisible().catch(() => false)) {
        throw new Error('Netflix is not logged in for the configured Chrome profile');
    }

    await expect(
        page.locator('.title-card, [data-uia="title-card"], [data-uia="search-gallery-video-card"]').first()
    ).toBeVisible({
        timeout: env.timeoutMs,
    });
}

export async function selectNetflixProfileIfNeeded(page, profileName) {
    const profileLink = page.getByText(profileName, { exact: true }).first();
    if (await profileLink.isVisible().catch(() => false)) {
        await profileLink.click();
        await page.waitForLoadState('domcontentloaded');
    }
}

export async function discoverVisibleTitles(page, minimumCount = 2) {
    const titles = await page.evaluate(() => {
        const candidateSelectors = [
            '.title-card',
            '[data-uia="title-card"]',
            '[data-uia="search-gallery-video-card"]',
            '[aria-label][role="link"]',
            '[aria-label][role="button"]',
        ];
        const seen = new Set();
        const results = [];
        for (const selector of candidateSelectors) {
            for (const el of document.querySelectorAll(selector)) {
                const rect = el.getBoundingClientRect();
                if (rect.width < 40 || rect.height < 40) continue;
                const aria = el.getAttribute('aria-label');
                const imageAlt = el.querySelector('img[alt]')?.getAttribute('alt');
                const title = (aria || imageAlt || '').trim();
                if (!title || seen.has(title)) continue;
                el.setAttribute('data-fm-integration-surface', String(results.length));
                seen.add(title);
                results.push({
                    title,
                    surfaceSelector: `[data-fm-integration-surface="${results.length}"]`,
                });
            }
        }
        return results;
    });

    if (titles.length < minimumCount) {
        throw new Error(`Expected at least ${minimumCount} visible Netflix titles, found ${titles.length}`);
    }

    return titles.map(title => ({
        ...title,
        slug: slugifyTitle(title.title),
    }));
}

export async function reloadNetflixAndWait(page, env) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await selectNetflixProfileIfNeeded(page, env.netflixProfileName);
    await expect(page.locator('.fm-rating-overlay').first()).toBeVisible({ timeout: env.timeoutMs });
}
```

- [ ] **Step 3: Create Playwright fixtures**

Create `tests/integration-chrome/fixtures.js` with:

```js
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
import { test as base, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { loadChromeIntegrationEnv } from './env.js';
import { createStorageHelper } from './helpers/storage.js';
import { ensureNetflixBrowseReady } from './helpers/netflix.js';

export { expect };

async function findExtensionServiceWorker(context, timeoutMs) {
    let [worker] = context.serviceWorkers();
    if (!worker) {
        worker = await context.waitForEvent('serviceworker', { timeout: timeoutMs });
    }
    if (!worker.url().startsWith('chrome-extension://')) {
        throw new Error(`Expected Chrome extension service worker, received ${worker.url()}`);
    }
    return worker;
}

export const test = base.extend({
    env: [
        async ({}, use) => {
            await use(loadChromeIntegrationEnv());
        },
        { scope: 'worker' },
    ],

    context: async ({ env }, use) => {
        const extensionPath = resolve(process.cwd(), 'dist/chrome');
        const args = [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`];
        if (env.chromeProfileDirectory) args.push(`--profile-directory=${env.chromeProfileDirectory}`);

        const context = await chromium.launchPersistentContext(env.chromeUserDataDir, {
            executablePath: env.chromeExecutablePath,
            headless: env.headless,
            args,
        });

        try {
            await use(context);
        } finally {
            if (!env.keepOpen) await context.close();
        }
    },

    extensionWorker: async ({ context, env }, use) => {
        await use(await findExtensionServiceWorker(context, env.timeoutMs));
    },

    extensionId: async ({ extensionWorker }, use) => {
        await use(new URL(extensionWorker.url()).host);
    },

    storage: async ({ extensionWorker }, use) => {
        const helper = createStorageHelper(extensionWorker);
        await helper.resetForCleanRun();
        await use(helper);
        await helper.resetForCleanRun();
    },

    netflixPage: async ({ context, env, storage }, use, testInfo) => {
        const page = context.pages()[0] ?? (await context.newPage());
        page.on('console', message => {
            if (message.type() === 'error') {
                testInfo.attach(`console-error-${Date.now()}`, {
                    body: message.text(),
                    contentType: 'text/plain',
                });
            }
        });
        await ensureNetflixBrowseReady(page, env);
        await use(page);
    },

    optionsPage: async ({ context, extensionId }, use) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await use(page);
        await page.close();
    },
});
```

- [ ] **Step 4: Add fixture smoke test**

Create `tests/integration-chrome/smoke.chrome.test.js` with:

```js
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
import { test, expect } from './fixtures.js';

test('loads the Chrome extension and opens Netflix browse', async ({ extensionId, netflixPage }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    await expect(netflixPage.locator('body')).toBeVisible();
});
```

- [ ] **Step 5: Run smoke test**

Run with a populated `.env` and authenticated Netflix profile:

```bash
npm run test:integration-chrome -- tests/integration-chrome/smoke.chrome.test.js
```

Expected: PASS. If Netflix is logged out, FAIL with `Netflix is not logged in for the configured Chrome profile`.

- [ ] **Step 6: Commit**

```bash
git add tests/integration-chrome/fixtures.js tests/integration-chrome/helpers/storage.js tests/integration-chrome/helpers/netflix.js tests/integration-chrome/smoke.chrome.test.js
git commit -m "test(integration-chrome): add browser fixtures"
```

---

### Task 3: Add Options And Overlay Assertion Helpers

**Files:**

- Create: `tests/integration-chrome/helpers/options-page.js`
- Create: `tests/integration-chrome/helpers/overlays.js`

**Interfaces:**

- Consumes: Playwright `Page`
- Produces: `setCheckbox(page, key, checked): Promise<void>`
- Produces: `setText(page, key, value): Promise<void>`
- Produces: `setSelect(page, key, value): Promise<void>`
- Produces: `saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env): Promise<void>`
- Produces: `expectOverlayBadges(page, seededTitle, badges): Promise<void>`
- Produces: `expectOverlayCorner(page, seededTitle, corner): Promise<void>`
- Produces: `expectFaded(page, seededTitle, expected): Promise<void>`
- Produces: `findFadeToggle(page, seededTitle): Locator`

- [ ] **Step 1: Create options-page helper**

Create `tests/integration-chrome/helpers/options-page.js` with:

```js
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
import { expect } from '@playwright/test';

export async function setCheckbox(page, key, checked) {
    const input = page.locator(`#fm-${key}`);
    await expect(input).toBeVisible();
    if ((await input.isChecked()) !== checked) {
        await input.setChecked(checked);
    }
}

export async function setText(page, key, value) {
    const input = page.locator(`#fm-${key}`);
    await expect(input).toBeVisible();
    await input.fill(String(value));
}

export async function setSelect(page, key, value) {
    const input = page.locator(`#fm-${key}`);
    await expect(input).toBeVisible();
    await input.selectOption(value);
}

export async function saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env) {
    const reloadPromise = netflixPage
        .waitForLoadState('domcontentloaded', { timeout: env.timeoutMs })
        .catch(() => null);
    await optionsPage.locator('#fm-saveBtn').click();
    await expect(optionsPage.locator('#fm-status')).toHaveText('Saved!');
    await reloadPromise;
    await netflixPage.waitForLoadState('domcontentloaded');
}
```

- [ ] **Step 2: Create overlay helper**

Create `tests/integration-chrome/helpers/overlays.js` with:

```js
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
import { expect } from '@playwright/test';

function surface(page, seededTitle) {
    return page.locator(seededTitle.surfaceSelector);
}

function overlay(page, seededTitle) {
    return surface(page, seededTitle).locator('.fm-rating-overlay');
}

export async function expectOverlayBadges(page, seededTitle, badges) {
    const container = overlay(page, seededTitle);
    await expect(container).toBeVisible();
    await expect(container).toContainText(`IMDb ${seededTitle.rating.toFixed(1)}`);
    if (badges.rt) await expect(container).toContainText(`RT ${seededTitle.rtRating}%`);
    else await expect(container).not.toContainText('RT ');
    if (badges.mc) await expect(container).toContainText(`MC ${seededTitle.mcRating}%`);
    else await expect(container).not.toContainText('MC ');
}

export async function expectOverlayCorner(page, seededTitle, corner) {
    const box = await overlay(page, seededTitle).boundingBox();
    const surfaceBox = await surface(page, seededTitle).boundingBox();
    expect(box).not.toBeNull();
    expect(surfaceBox).not.toBeNull();

    const nearTop = box.y - surfaceBox.y < surfaceBox.height / 2;
    const nearLeft = box.x - surfaceBox.x < surfaceBox.width / 2;
    expect(nearTop).toBe(corner.startsWith('top'));
    expect(nearLeft).toBe(corner.endsWith('left'));
}

export async function expectFaded(page, seededTitle, expected) {
    await expect(surface(page, seededTitle)).toHaveClass(expected ? /fm-faded/ : /^(?!.*fm-faded).*$/);
}

export function findFadeToggle(page, seededTitle) {
    return overlay(page, seededTitle).locator('.fm-fade-toggle');
}
```

- [ ] **Step 3: Run lint for helper files**

Run:

```bash
npx eslint tests/integration-chrome/helpers/options-page.js tests/integration-chrome/helpers/overlays.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration-chrome/helpers/options-page.js tests/integration-chrome/helpers/overlays.js
git commit -m "test(integration-chrome): add ui assertion helpers"
```

---

### Task 4: Add Ratings Visibility And Overlay Position Tests

**Files:**

- Create: `tests/integration-chrome/ratings.chrome.test.js`

**Interfaces:**

- Consumes: `test`, `expect`, `storage`, `netflixPage`, `optionsPage`, and `env` fixtures
- Consumes: `discoverVisibleTitles()` and `reloadNetflixAndWait()`
- Consumes: `setCheckbox()`, `setSelect()`, and `saveOptionsAndWaitForNetflixReload()`
- Consumes: `expectOverlayBadges()` and `expectOverlayCorner()`

- [ ] **Step 1: Create ratings test file**

Create `tests/integration-chrome/ratings.chrome.test.js` with:

```js
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
import { test } from './fixtures.js';
import { discoverVisibleTitles, reloadNetflixAndWait } from './helpers/netflix.js';
import { setCheckbox, setSelect, saveOptionsAndWaitForNetflixReload } from './helpers/options-page.js';
import { expectOverlayBadges, expectOverlayCorner } from './helpers/overlays.js';

const SEED_RATINGS = [
    { rating: 8.4, rtRating: 93, mcRating: 81, imdbId: 'tt9000001' },
    { rating: 6.7, rtRating: 71, mcRating: 64, imdbId: 'tt9000002' },
];

test('shows IMDb, RT, and MC according to options UI visibility settings', async ({
    env,
    storage,
    netflixPage,
    optionsPage,
}) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 2);
    const seeded = await storage.seedRatings(visibleTitles.slice(0, 2), SEED_RATINGS);

    await setCheckbox(optionsPage, 'showRtRating', true);
    await setCheckbox(optionsPage, 'showMcRating', true);
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);

    await expectOverlayBadges(netflixPage, seeded[0], { rt: true, mc: true });

    await optionsPage.reload({ waitUntil: 'domcontentloaded' });
    await setCheckbox(optionsPage, 'showRtRating', false);
    await setCheckbox(optionsPage, 'showMcRating', false);
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);

    await expectOverlayBadges(netflixPage, seeded[0], { rt: false, mc: false });
});

test('moves the overlay when overlayCorner is changed through options UI', async ({
    env,
    storage,
    netflixPage,
    optionsPage,
}) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 1);
    const [seeded] = await storage.seedRatings(visibleTitles.slice(0, 1), SEED_RATINGS);

    await setSelect(optionsPage, 'overlayCorner', 'bottom-right');
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);

    await expectOverlayCorner(netflixPage, seeded, 'bottom-right');
});
```

- [ ] **Step 2: Run ratings tests**

Run with a populated `.env` and authenticated Netflix profile:

```bash
npm run test:integration-chrome -- tests/integration-chrome/ratings.chrome.test.js
```

Expected: PASS. If a selector fails because Netflix changed its DOM, the failing assertion must include Playwright trace and screenshot artifacts.

- [ ] **Step 3: Commit**

```bash
git add tests/integration-chrome/ratings.chrome.test.js
git commit -m "test(integration-chrome): verify rating overlays"
```

---

### Task 5: Add Fade Threshold And Fade Override Tests

**Files:**

- Create: `tests/integration-chrome/fade.chrome.test.js`
- Modify: `tests/integration-chrome/helpers/netflix.js`

**Interfaces:**

- Produces: `openHoverSurfaceForTitle(page, seededTitle, env): Promise<void>`
- Consumes: `findFadeToggle()` and `expectFaded()`

- [ ] **Step 1: Add hover helper**

Append this function to `tests/integration-chrome/helpers/netflix.js`:

```js
export async function openHoverSurfaceForTitle(page, seededTitle, env) {
    await page.locator(seededTitle.surfaceSelector).hover();
    await expect(page.locator('.fm-fade-toggle').first()).toBeVisible({ timeout: env.timeoutMs });
}
```

- [ ] **Step 2: Create fade test file**

Create `tests/integration-chrome/fade.chrome.test.js` with:

```js
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
import { test, expect } from './fixtures.js';
import { discoverVisibleTitles, openHoverSurfaceForTitle, reloadNetflixAndWait } from './helpers/netflix.js';
import { setCheckbox, setText, saveOptionsAndWaitForNetflixReload } from './helpers/options-page.js';
import { expectFaded, findFadeToggle } from './helpers/overlays.js';

const LOW_RATING = [{ rating: 4.2, rtRating: 35, mcRating: 41, imdbId: 'tt9000101' }];
const MID_RATING = [{ rating: 6.5, rtRating: 69, mcRating: 62, imdbId: 'tt9000102' }];

test('applies fade threshold settings saved from options UI', async ({ env, storage, netflixPage, optionsPage }) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 1);
    const [seeded] = await storage.seedRatings(visibleTitles.slice(0, 1), LOW_RATING);

    await setCheckbox(optionsPage, 'enableFadeUnderRating', true);
    await setText(optionsPage, 'fadeRatingThreshold', '6.0');
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, true);

    await optionsPage.reload({ waitUntil: 'domcontentloaded' });
    await setText(optionsPage, 'fadeRatingThreshold', '3.0');
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, false);
});

test('fade override updates immediately and persists after reload', async ({
    env,
    storage,
    netflixPage,
    optionsPage,
}) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 1);
    const [seeded] = await storage.seedRatings(visibleTitles.slice(0, 1), MID_RATING);

    await setCheckbox(optionsPage, 'enableFadeToggle', true);
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);

    await openHoverSurfaceForTitle(netflixPage, seeded, env);
    const toggle = findFadeToggle(netflixPage, seeded);
    await expect(toggle).toHaveAttribute('data-state', 'auto');

    await toggle.click();
    await expectFaded(netflixPage, seeded, true);
    await expect.poll(async () => (await storage.getAll())[`fm-fade:${seeded.slug}`]).toBe('always');
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, true);

    await openHoverSurfaceForTitle(netflixPage, seeded, env);
    await findFadeToggle(netflixPage, seeded).click();
    await expectFaded(netflixPage, seeded, false);
    await expect.poll(async () => (await storage.getAll())[`fm-fade:${seeded.slug}`]).toBe('never');
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, false);

    await openHoverSurfaceForTitle(netflixPage, seeded, env);
    await findFadeToggle(netflixPage, seeded).click();
    await expect.poll(async () => (await storage.getAll())[`fm-fade:${seeded.slug}`]).toBeUndefined();
    await expectFaded(netflixPage, seeded, false);
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, false);
});
```

- [ ] **Step 3: Run fade tests**

Run:

```bash
npm run test:integration-chrome -- tests/integration-chrome/fade.chrome.test.js
```

Expected: PASS. If the hover surface does not expose `.fm-fade-toggle`, inspect the trace and update `openHoverSurfaceForTitle()` to open the preview surface used by current Netflix DOM.

- [ ] **Step 4: Commit**

```bash
git add tests/integration-chrome/helpers/netflix.js tests/integration-chrome/fade.chrome.test.js
git commit -m "test(integration-chrome): verify fade behavior"
```

---

### Task 6: Add Settings Maintenance Button Tests

**Files:**

- Create: `tests/integration-chrome/settings-maintenance.chrome.test.js`

**Interfaces:**

- Consumes: `storage.seedRatings()`
- Consumes: `storage.seedDisabledClients()`
- Consumes: `storage.getKeysByPrefix()`

- [ ] **Step 1: Create settings maintenance test**

Create `tests/integration-chrome/settings-maintenance.chrome.test.js` with:

```js
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
import { test, expect } from './fixtures.js';
import { discoverVisibleTitles } from './helpers/netflix.js';

const SEED_RATING = [{ rating: 7.4, rtRating: 82, mcRating: 73, imdbId: 'tt9000201' }];

test('Clear Cache removes cached rating entries from options UI', async ({ storage, netflixPage, optionsPage }) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 1);
    await storage.seedRatings(visibleTitles.slice(0, 1), SEED_RATING);
    await expect.poll(async () => (await storage.getKeysByPrefix(storage.prefixes.cache)).length).toBeGreaterThan(0);

    await optionsPage.locator('#fm-clearCacheBtn').click();
    await expect(optionsPage.locator('#fm-status')).toHaveText('Cache cleared.');
    await expect.poll(async () => await storage.getKeysByPrefix(storage.prefixes.cache)).toEqual([]);
});

test('Reset Disabled Clients clears disabled provider flags from options UI', async ({ storage, optionsPage }) => {
    await storage.seedDisabledClients(['agregarr', 'omdb']);
    await expect.poll(async () => (await storage.getKeysByPrefix(storage.prefixes.disabled)).length).toBeGreaterThan(0);

    await optionsPage.locator('#fm-resetClientsBtn').click();
    await expect(optionsPage.locator('#fm-status')).toHaveText(
        /Re-enabled API clients: .*agregarr.*omdb|Re-enabled API clients: .*omdb.*agregarr/
    );

    const all = await storage.getAll();
    expect(all.fm_disabled_agregarr).toBe('0');
    expect(all.fm_disabled_omdb).toBe('0');
});
```

- [ ] **Step 2: Run maintenance tests**

Run:

```bash
npm run test:integration-chrome -- tests/integration-chrome/settings-maintenance.chrome.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration-chrome/settings-maintenance.chrome.test.js
git commit -m "test(integration-chrome): verify settings maintenance actions"
```

---

### Task 7: Add Documentation And Full Verification

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: all suite commands from previous tasks
- Produces: user-facing instructions for local setup and execution

- [ ] **Step 1: Add README section**

Add this section near the existing testing documentation in `README.md`:

````md
### Chrome Integration Tests

`npm run test:integration-chrome` runs a local-only Playwright suite against the built Chrome extension and a live Netflix browser session. It is not part of `npm test` or regular CI.

Before running it:

1. Create a dedicated Chrome or Chromium profile for FlixMonkey integration testing.
2. Log into Netflix in that profile.
3. Populate `.env` with:

    ```dotenv
    CHROME_EXECUTABLE_PATH=/path/to/chrome-or-chromium
    CHROME_USER_DATA_DIR=/path/to/flixmonkey-chrome-profile
    CHROME_PROFILE_DIRECTORY=
    NETFLIX_PROFILE_NAME=Your Netflix Profile
    CHROME_INTEGRATION_HEADLESS=false
    CHROME_INTEGRATION_KEEP_OPEN=false
    CHROME_INTEGRATION_TIMEOUT_MS=30000
    ```

Run:

```bash
npm run test:integration-chrome
```
````

The suite builds `dist/chrome`, loads it as an unpacked extension, opens Netflix, selects `NETFLIX_PROFILE_NAME` if the Netflix profile chooser appears, seeds deterministic cache entries for visible titles, and verifies overlays and settings behavior. It preserves `omdbApiKey` and `xmdbApiKey`, and resets other options, `fmc:*` cache entries, and `fm-fade:*` overrides at the start and end of the run.

````

- [ ] **Step 2: Run formatting and linting**

Run:

```bash
npm run format:check
npm run lint
````

Expected: PASS.

- [ ] **Step 3: Run full local Chrome integration suite**

Run with a populated `.env` and authenticated Netflix profile:

```bash
npm run test:integration-chrome
```

Expected: PASS. Failure artifacts are written under `test-results/`.

- [ ] **Step 4: Run existing standard tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document chrome integration tests"
```

---

## Plan Self-Review

- Spec coverage: Tasks cover Playwright Test config, `integration-chrome` naming, `.env` contract, dedicated profile state reset, cache seeding, ratings display, RT/MC settings, overlay corner, fade threshold, fade override immediate and persisted behavior, Clear Cache, Reset Disabled Clients, profile/login guard, failure artifacts, and documentation.
- Placeholder scan: No task uses deferred-work markers or vague error handling language.
- Type consistency: `loadChromeIntegrationEnv`, `createStorageHelper`, `discoverVisibleTitles`, `reloadNetflixAndWait`, `setCheckbox`, `setText`, `setSelect`, `saveOptionsAndWaitForNetflixReload`, `expectOverlayBadges`, `expectOverlayCorner`, `expectFaded`, and `findFadeToggle` are defined before use.
