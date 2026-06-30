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
