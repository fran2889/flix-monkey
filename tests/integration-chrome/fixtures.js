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
import { resolve } from 'node:path';
import { test as base, expect, chromium } from '@playwright/test';
import { loadChromeIntegrationEnv } from './env.js';
import { ensureNetflixBrowseReady } from './helpers/netflix.js';
import { createStorageHelper } from './helpers/storage.js';

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
        async (_args, use) => {
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

    netflixPage: async ({ context, env, storage: _storage }, use, testInfo) => {
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
