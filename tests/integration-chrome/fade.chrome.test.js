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
import { setCheckbox, setText, saveOptionsAndWaitForNetflixReload, openOptionsPage } from './helpers/options-page.js';
import { expectFaded, findFadeToggle } from './helpers/overlays.js';
import { LOW_RATING, MID_RATING } from './helpers/test-data.js';

test('applies fade threshold settings saved from options UI', async ({
    env,
    context,
    extensionId,
    storage,
    netflixPage,
    optionsPage,
}) => {
    const visibleTitles = await discoverVisibleTitles(netflixPage, 1);
    const [seeded] = await storage.seedRatings(visibleTitles.slice(0, 1), LOW_RATING);

    await setCheckbox(optionsPage, 'enableFadeUnderRating', true);
    await setText(optionsPage, 'fadeRatingThreshold', '6.0');
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, true);

    optionsPage = await openOptionsPage(context, extensionId);
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
    const toggle = findFadeToggle(netflixPage);
    await expect(toggle).toHaveAttribute('data-state', 'auto');

    await toggle.click();
    await expectFaded(netflixPage, seeded, true);
    await expect.poll(async () => (await storage.getAll())[`fm-fade:${seeded.slug}`]).toBe('always');
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, true);

    await openHoverSurfaceForTitle(netflixPage, seeded, env);
    await findFadeToggle(netflixPage).click();
    await expectFaded(netflixPage, seeded, false);
    await expect.poll(async () => (await storage.getAll())[`fm-fade:${seeded.slug}`]).toBe('never');
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, false);

    await openHoverSurfaceForTitle(netflixPage, seeded, env);
    await findFadeToggle(netflixPage).click();
    await expect.poll(async () => (await storage.getAll())[`fm-fade:${seeded.slug}`]).toBeUndefined();
    await expectFaded(netflixPage, seeded, false);
    await reloadNetflixAndWait(netflixPage, env);
    await expectFaded(netflixPage, seeded, false);
});
