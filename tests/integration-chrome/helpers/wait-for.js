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
import { CONTAINER_SELECTOR } from './netflix.js';

/**
 * Wait for Netflix page to reach a ready state with visible surface containers.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function waitForNetflixReady(page, env) {
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator(CONTAINER_SELECTOR).first()).toBeVisible({ timeout: env.timeoutMs });
}

/**
 * Wait for a rating overlay to appear on a specific surface.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string} slug - The title slug (used in data-fm-key attribute)
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function waitForOverlayOnSurface(page, slug, env) {
    await expect(page.locator(`[data-fm-key="${slug}"] .fm-rating-overlay`)).toBeVisible({ timeout: env.timeoutMs });
}

/**
 * Wait for options to sync from options page to Netflix page.
 * Uses initScript pattern to detect page reload.
 * @param {import('@playwright/test').Page} netflixPage - Netflix tab
 * @param {string} marker - Unique marker string for this sync operation
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function waitForOptionsSync(netflixPage, marker, env) {
    await Promise.race([
        netflixPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: env.timeoutMs }),
        netflixPage.waitForFunction(m => window[m] === 'new-document', marker, {
            timeout: env.timeoutMs,
        }),
    ]);
    await netflixPage.waitForLoadState('domcontentloaded');
}

/**
 * Poll for a condition to become true.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {Object} [options] - Polling options
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @param {number} [options.interval=200] - Polling interval in milliseconds
 * @returns {Promise<boolean>}
 */
export async function pollFor(page, condition, options = {}) {
    const { timeout = 5000, interval = 200 } = options;
    return expect.poll(async () => condition(page), { timeout, interval }).toBeTruthy();
}
