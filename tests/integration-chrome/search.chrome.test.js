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
import { discoverVisibleTitles, reloadNetflixAndWait } from './helpers/netflix.js';
import { setCheckbox, saveOptionsAndWaitForNetflixReload } from './helpers/options-page.js';
import { expectOverlayBadges } from './helpers/overlays.js';

const SEARCH_RATINGS = [
    { rating: 8.4, rtRating: 93, mcRating: 81, imdbId: 'tt9000001' },
    { rating: 6.7, rtRating: 71, mcRating: 64, imdbId: 'tt9000002' },
];

const NETFLIX_SEARCH_URL = 'https://www.netflix.com/search?q=breaking';

async function navigateToSearch(page, env) {
    await page.goto(NETFLIX_SEARCH_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-uia="standard-card"]').first()).toBeVisible({
        timeout: env.timeoutMs,
    });
}

test('discovers and renders ratings on search page elements', async ({ env, storage, netflixPage, optionsPage }) => {
    await navigateToSearch(netflixPage, env);

    const visibleTitles = await discoverVisibleTitles(netflixPage, 2);
    expect(visibleTitles.length).toBeGreaterThanOrEqual(2);

    const seeded = await storage.seedRatings(visibleTitles.slice(0, 2), SEARCH_RATINGS);

    await setCheckbox(optionsPage, 'showRtRating', true);
    await setCheckbox(optionsPage, 'showMcRating', true);
    await saveOptionsAndWaitForNetflixReload(optionsPage, netflixPage, env);
    await reloadNetflixAndWait(netflixPage, env);

    await expectOverlayBadges(netflixPage, seeded[0], { rt: true, mc: true });
    await expectOverlayBadges(netflixPage, seeded[1], { rt: true, mc: true });
});
