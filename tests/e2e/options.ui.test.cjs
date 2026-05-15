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
const SettingsUIAdapter = require('./adapters/settings-ui-adapter.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a SettingsUIAdapter for the current test.
 * Reads the extension ID from the environment if available.
 */
function makeAdapter(page) {
    const extensionId = process.env.FLIXMONKEY_EXT_ID ?? null;
    return new SettingsUIAdapter(page, extensionId);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('FlixMonkey Options Page', () => {
    test.beforeEach(async ({ page }) => {
        const adapter = makeAdapter(page);
        await adapter.openOptionsPage();
    });

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    test('renders the page title', async ({ page }) => {
        await expect(page).toHaveTitle('FlixMonkey Settings');
    });

    test('renders all expected config fields', async ({ page }) => {
        // Spot-check a representative set of field IDs that options.js renders
        const expectedIds = [
            'field_xmdbApiKey',
            'field_omdbApiKey',
            'field_apiClients',
            'field_overlayCorner',
            'field_showRtRating',
            'field_showMcRating',
            'field_cacheTtlRatedOldYear',
            'field_cacheTtlRatedNewYear',
            'field_cacheTtlNoRating',
            'field_enableFadeUnderRating',
            'field_fadeRatingThreshold',
        ];
        for (const id of expectedIds) {
            await expect(page.locator(`#${id}`)).toBeVisible();
        }
    });

    test('renders the Save, Clear Cache, and Reset Disabled Clients buttons', async ({ page }) => {
        await expect(page.locator('#saveBtn')).toBeVisible();
        await expect(page.locator('#clearCacheBtn')).toBeVisible();
        await expect(page.locator('#resetClientsBtn')).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // Config persistence — text field
    // -----------------------------------------------------------------------

    test('persists a changed text field after save', async ({ page }) => {
        const adapter = makeAdapter(page);
        const key = 'cacheTtlNoRating';
        const newValue = '7';

        await adapter.setField(key, newValue);
        await adapter.save();

        const stored = await adapter.readStorage([key]);
        expect(String(stored[key])).toBe(newValue);
    });

    // -----------------------------------------------------------------------
    // Config persistence — select field
    // -----------------------------------------------------------------------

    test('persists a changed select (overlayCorner) after save', async ({ page }) => {
        const adapter = makeAdapter(page);
        const key = 'overlayCorner';
        const newValue = 'bottom-right';

        await adapter.setField(key, newValue);

        // Verify the UI reflects the change before saving
        const uiValue = await adapter.getField(key);
        expect(uiValue).toBe(newValue);

        await adapter.save();

        const stored = await adapter.readStorage([key]);
        expect(stored[key]).toBe(newValue);
    });

    // -----------------------------------------------------------------------
    // Config persistence — checkbox field
    // -----------------------------------------------------------------------

    test('persists a toggled checkbox (showRtRating) after save', async ({ page }) => {
        const adapter = makeAdapter(page);
        const key = 'showRtRating';

        // Read the current UI value, then toggle it
        const before = await adapter.getField(key);
        await adapter.setField(key, !before);

        const uiAfterToggle = await adapter.getField(key);
        expect(uiAfterToggle).toBe(!before);

        await adapter.save();

        const stored = await adapter.readStorage([key]);
        // Storage saves the boolean directly (checkbox path in options.js)
        expect(stored[key]).toBe(!before);
    });

    // -----------------------------------------------------------------------
    // Save status message
    // -----------------------------------------------------------------------

    test('shows "Saved!" status message after clicking Save', async ({ page }) => {
        const adapter = makeAdapter(page);
        await adapter.save();

        const statusText = await page.locator('#status').textContent();
        expect(statusText?.trim()).toBe('Saved!');
    });

    // -----------------------------------------------------------------------
    // Storage pre-seeding (round-trip)
    // -----------------------------------------------------------------------

    test('loads stored values into the form on open', async ({ page }) => {
        const adapter = makeAdapter(page);

        // Write a known value directly to storage
        const key = 'fadeRatingThreshold';
        const expected = '5.5';
        await adapter.writeStorage({ [key]: expected });

        // Reload the page so options.js picks up the new value
        await adapter.openOptionsPage();

        const uiValue = await adapter.getField(key);
        expect(String(uiValue)).toBe(expected);
    });
});
