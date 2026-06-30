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

function isFlixMonkeyExtensionWorker(worker) {
    const url = worker.url();

    if (!url.startsWith('chrome-extension://')) return false;

    try {
        return new URL(url).pathname.endsWith('/service-worker.js');
    } catch {
        return false;
    }
}

export async function findExtensionServiceWorker(context, timeoutMs) {
    const existingWorker = context.serviceWorkers().find(isFlixMonkeyExtensionWorker);
    if (existingWorker) return existingWorker;

    const deadline = Date.now() + timeoutMs;
    while (true) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            const workerUrls = context.serviceWorkers().map(worker => worker.url());
            throw new Error(
                `Timed out waiting for FlixMonkey Chrome extension service worker. Workers seen: ${
                    workerUrls.length > 0 ? workerUrls.join(', ') : '(none)'
                }`
            );
        }

        const worker = await context.waitForEvent('serviceworker', { timeout: remainingMs });
        if (isFlixMonkeyExtensionWorker(worker)) {
            return worker;
        }
    }
}

export const test = base.extend({
    env: [
        async ({ browserName }, use) => {
            void browserName;
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
        const page = await context.newPage();
        const consoleListener = message => {
            if (message.type() === 'error') {
                testInfo.attach(`console-error-${Date.now()}`, {
                    body: message.text(),
                    contentType: 'text/plain',
                });
            }
        };
        page.on('console', consoleListener);
        try {
            await ensureNetflixBrowseReady(page, env);
            await use(page);
        } finally {
            page.off('console', consoleListener);
            await page.close();
        }
    },

    optionsPage: async ({ context, extensionId }, use) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await use(page);
        await page.close();
    },
});
