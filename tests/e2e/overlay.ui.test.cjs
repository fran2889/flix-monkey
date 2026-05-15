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

const { test, expect } = require('@playwright/test');
const UserscriptAdapter = require('./adapters/userscript-adapter.cjs');
const BrowseSurface = require('./surfaces/browse-surface.cjs');
const SearchSurface = require('./surfaces/search-surface.cjs');
const BobSurface = require('./surfaces/bob-surface.cjs');
const PreviewModalSurface = require('./surfaces/preview-modal-surface.cjs');

test.describe('Netflix UI Overlays', () => {
    let adapter;
    let browseSurface;
    let searchSurface;
    let bobSurface;
    let previewModalSurface;

    test.beforeEach(async ({ page }) => {
        adapter = new UserscriptAdapter(page);
        browseSurface = new BrowseSurface(adapter);
        searchSurface = new SearchSurface(adapter);
        bobSurface = new BobSurface(adapter);
        previewModalSurface = new PreviewModalSurface(adapter);

        // Pre-seed some ratings to avoid real API calls and ensure deterministic behavior
        await adapter.setExtensionSettings({
            cache: {
                tt0111161: { rating: 9.3, title: 'The Shawshank Redemption', year: '1994', fetchedAt: Date.now() },
                tt0068646: { rating: 9.2, title: 'The Godfather', year: '1972', fetchedAt: Date.now() },
            },
            showRtRating: false,
            showMcRating: false,
        });
    });

    test('Browse Cards: verify overlay visibility on /browse', async () => {
        // Navigate to browse page
        await adapter.navigate('https://www.netflix.com/browse');

        // Find the first title card
        const cards = browseSurface.getTitleCards();
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();

        // Get overlay and verify it loads
        const overlay = browseSurface.getOverlay(firstCard);
        await overlay.waitForLoaded();
        await expect(overlay.locator()).toBeVisible();

        // Verify we have a valid rating
        const imdbValue = await overlay.getImdbValue();
        expect(imdbValue).toBeGreaterThan(0);
    });

    test('Search Results: verify overlay visibility for "Godfather"', async () => {
        // Perform search
        await searchSurface.searchFor('Godfather');

        // Get search results
        const results = searchSurface.getResults();
        const firstResult = results.first();
        await expect(firstResult).toBeVisible();

        // Get overlay and verify it loads (should match cached tt0068646)
        const overlay = searchSurface.getOverlay(firstResult);
        await overlay.waitForLoaded();
        await expect(overlay.locator()).toBeVisible();

        const imdbValue = await overlay.getImdbValue();
        expect(imdbValue).toBe(9.2);
    });

    test('Hover (Bob): verify overlay in Bob container', async () => {
        await adapter.navigate('https://www.netflix.com/browse');

        const cards = browseSurface.getTitleCards();
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();

        // Trigger hover to open Bob container
        await bobSurface.triggerHover(firstCard);

        // Get overlay from Bob container
        const overlay = bobSurface.getOverlay();
        await overlay.waitForLoaded();
        await expect(overlay.locator()).toBeVisible();

        const imdbValue = await overlay.getImdbValue();
        expect(imdbValue).toBeGreaterThan(0);
    });

    test('Preview Modal: verify overlay in modal', async () => {
        await adapter.navigate('https://www.netflix.com/browse');

        const cards = browseSurface.getTitleCards();
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();

        // Open preview modal
        await previewModalSurface.open(firstCard);

        // Get overlay from modal
        const overlay = previewModalSurface.getOverlay();
        await overlay.waitForLoaded();
        await expect(overlay.locator()).toBeVisible();

        const imdbValue = await overlay.getImdbValue();
        expect(imdbValue).toBeGreaterThan(0);
    });
});
