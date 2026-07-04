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
import { findSurfaceBySlug } from './netflix.js';

/**
 * Get the surface element for a seeded title.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @returns {import('@playwright/test').Locator}
 */
function surface(page, seededTitle) {
    return findSurfaceBySlug(page, seededTitle.slug);
}

/**
 * Get the overlay element for a seeded title.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @returns {import('@playwright/test').Locator}
 */
function overlay(page, seededTitle) {
    return surface(page, seededTitle).locator('.fm-rating-overlay');
}

/**
 * Assert that the overlay for a seeded title shows the expected badges.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @param {Object} badges - Expected badge configuration
 * @param {boolean} badges.rt - Whether RT badge should be visible
 * @param {boolean} badges.mc - Whether MC badge should be visible
 */
export async function expectOverlayBadges(page, seededTitle, badges) {
    const container = overlay(page, seededTitle);
    await expect(container).toBeVisible();
    await expect(container).toContainText('IMDb');
    if (badges.rt) {
        await expect(container.locator('.fm-rt')).toHaveCount(1);
    } else {
        await expect(container.locator('.fm-rt')).toHaveCount(0);
    }
    if (badges.mc) {
        await expect(container.locator('.fm-mc')).toHaveCount(1);
    } else {
        await expect(container.locator('.fm-mc')).toHaveCount(0);
    }
}

export async function expectOverlayCorner(page, seededTitle, corner) {
    const box = await overlay(page, seededTitle).boundingBox();
    const surfaceBox = await surface(page, seededTitle).boundingBox();
    expect(box).not.toBeNull();
    expect(surfaceBox).not.toBeNull();

    const nearTop = box.y - surfaceBox.y < surfaceBox.height / 2;
    const nearLeft = box.x - surfaceBox.x < surfaceBox.width / 2;
    expect(nearTop).toBe(corner.startsWith('top'));
    expect(nearLeft).toBe(corner.endsWith('left'));
}

/**
 * Assert that a surface is faded (or not) based on expected state.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} seededTitle - Title object with slug property
 * @param {boolean} expected - Whether the surface should be faded
 */
export async function expectFaded(page, seededTitle, expected) {
    const locator = surface(page, seededTitle);
    if (expected) {
        await expect(locator).toHaveClass(/fm-faded/);
    } else {
        await expect(locator).not.toHaveClass(/fm-faded/);
    }
}

/**
 * Find the fade toggle element on the page.
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {import('@playwright/test').Locator}
 */
export function findFadeToggle(page) {
    return page.locator('.fm-fade-toggle').first();
}
