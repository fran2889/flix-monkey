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
