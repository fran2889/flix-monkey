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
import { SINGLE_RATING } from './helpers/test-data.js';

test('Clear Cache removes cached rating entries from options UI', async ({ storage, netflixPage, optionsPage }) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 1);
    await storage.seedRatings(visibleTitles.slice(0, 1), SINGLE_RATING);
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
