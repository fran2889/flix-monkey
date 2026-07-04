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

/**
 * Open the extension options page.
 * @param {import('@playwright/test').BrowserContext} context - Playwright browser context
 * @param {string} extensionId - Chrome extension ID
 * @returns {Promise<import('@playwright/test').Page>} Options page
 */
export async function openOptionsPage(context, extensionId) {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
    return page;
}

/**
 * Set a checkbox option on the options page.
 * @param {import('@playwright/test').Page} page - Options page
 * @param {string} key - Option key (without fm- prefix)
 * @param {boolean} checked - Desired checked state
 */
export async function setCheckbox(page, key, checked) {
    const input = page.locator(`#fm-${key}`);
    await expect(input).toBeVisible();
    if ((await input.isChecked()) !== checked) {
        await input.setChecked(checked);
    }
}

/**
 * Set a text option on the options page.
 * @param {import('@playwright/test').Page} page - Options page
 * @param {string} key - Option key (without fm- prefix)
 * @param {string|number} value - Value to set
 */
export async function setText(page, key, value) {
    const input = page.locator(`#fm-${key}`);
    await expect(input).toBeVisible();
    await input.fill(String(value));
}

/**
 * Set a select option on the options page.
 * @param {import('@playwright/test').Page} page - Options page
 * @param {string} key - Option key (without fm- prefix)
 * @param {string} value - Value to select
 */
export async function setSelect(page, key, value) {
    const input = page.locator(`#fm-${key}`);
    await expect(input).toBeVisible();
    await input.selectOption(value);
}

/**
 * Save options and wait for Netflix page to reload.
 * @param {import('@playwright/test').Page} optionsPage - Options page
 * @param {import('@playwright/test').Page} netflixPage - Netflix tab
 * @param {Object} env - Environment configuration with timeoutMs
 */
export async function saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env) {
    const reloadMarker = `__fmReloadMarker_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

    await netflixPage.addInitScript(marker => {
        window[marker] = 'new-document';
    }, reloadMarker);
    await netflixPage.evaluate(marker => {
        window[marker] = 'before-save';
    }, reloadMarker);

    const reloadPromise = Promise.race([
        netflixPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: env.timeoutMs }),
        netflixPage.waitForFunction(marker => window[marker] === 'new-document', reloadMarker, {
            timeout: env.timeoutMs,
        }),
    ]);

    await optionsPage.locator('#fm-saveBtn').click();
    await expect(optionsPage.locator('#fm-status')).toHaveText('Saved!');
    await reloadPromise;
    await netflixPage.waitForLoadState('domcontentloaded');
    await optionsPage.close();
}
