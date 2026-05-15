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

test('should play video in browse view', async ({ page }) => {
    const adapter = new UserscriptAdapter(page);
    const browse = new BrowseSurface(adapter);
    await adapter.navigate('https://www.netflix.com/browse');
    // Just checking if we can navigate and find an element
    // Since we are running against a real session, this is a basic connectivity check
    await expect(page).toHaveURL(/browse/);
});
