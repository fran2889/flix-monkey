/**
 * Options UI E2E tests
 *
 * These tests run against a real Chrome browser (connected via CDP) that has
 * the FlixMonkey Chrome extension loaded.  They verify that the options page
 * renders correctly and that changes made through the UI are persisted to
 * chrome.storage.local.
 *
 * Prerequisites
 * -------------
 * 1. Build the extension:       npm run build:chrome
 * 2. Launch Chrome with CDP:    chrome --remote-debugging-port=9222
 *                                      --load-extension=dist/chrome
 * 3. Set FLIXMONKEY_EXT_ID env var to the extension's ID, OR leave it unset
 *    and the adapter will attempt to auto-detect it from open pages.
 * 4. Run:                       npm run test:e2e
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
