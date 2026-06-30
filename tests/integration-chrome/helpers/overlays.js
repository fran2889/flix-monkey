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

function surface(page, seededTitle) {
    return page.locator(seededTitle.surfaceSelector);
}

function overlay(page, seededTitle) {
    return surface(page, seededTitle).locator('.fm-rating-overlay');
}

export async function expectOverlayBadges(page, seededTitle, badges) {
    const container = overlay(page, seededTitle);
    await expect(container).toBeVisible();
    await expect(container).toContainText(`IMDb ${seededTitle.rating.toFixed(1)}`);
    if (badges.rt) await expect(container).toContainText(`RT ${seededTitle.rtRating}%`);
    else await expect(container).not.toContainText('RT ');
    if (badges.mc) await expect(container).toContainText(`MC ${seededTitle.mcRating}%`);
    else await expect(container).not.toContainText('MC ');
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

export async function expectFaded(page, seededTitle, expected) {
    await expect(surface(page, seededTitle)).toHaveClass(expected ? /fm-faded/ : /^(?!.*fm-faded).*$/);
}

export function findFadeToggle(page, seededTitle) {
    return overlay(page, seededTitle).locator('.fm-fade-toggle');
}
