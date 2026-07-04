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

const TEST_USER_DATA_DIR = resolve(process.cwd(), '.playwright-chrome-profile');

/**
 * Attach diagnostic context to test failure.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info
 * @param {import('@playwright/test').Page} page - Page at time of failure
 * @param {string[]} consoleErrors - Collected console errors
 * @param {Array<{type: string, text: string, time: number}>} consoleLogs - Collected console logs
 * @param {Error} _err - The error that caused the failure
 */
async function attachErrorContext(testInfo, page, consoleErrors, consoleLogs, _err) {
    if (consoleErrors.length > 0) {
        testInfo.attach('browser-errors', {
            body: consoleErrors.join('\n'),
            contentType: 'text/plain',
        });
    }
    if (consoleLogs.length > 0) {
        testInfo.attach('browser-console', {
            body: consoleLogs.map(l => `[${l.type}] ${l.text}`).join('\n'),
            contentType: 'text/plain',
        });
    }
    try {
        testInfo.attach('page-screenshot', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });
    } catch {
        /* ignore screenshot failures */
    }
}

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

        const context = await chromium.launchPersistentContext(TEST_USER_DATA_DIR, {
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
        await helper.resetAllForCleanRun();

        await use(helper);

        await helper.resetAllForCleanRun().catch(() => {});
    },

    netflixPage: async ({ context, env, storage: _storage }, use, testInfo) => {
        const page = await context.newPage();
        const consoleErrors = [];
        const consoleLogs = [];

        const consoleListener = message => {
            consoleLogs.push({ type: message.type(), text: message.text(), time: Date.now() });
            if (message.type() === 'error') {
                consoleErrors.push(message.text());
            }
        };
        page.on('console', consoleListener);
        page.on('pageerror', err => consoleErrors.push(err.message));
        page.on('crash', () => consoleErrors.push('Page crashed'));

        try {
            await ensureNetflixBrowseReady(page, env);
            await use(page);
        } catch (err) {
            if (testInfo) {
                await attachErrorContext(testInfo, page, consoleErrors, consoleLogs, err);
            }
            throw err;
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
