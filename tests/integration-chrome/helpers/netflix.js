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
import { slugifyTitle } from './storage.js';
import { SURFACE_DEFS } from '../../../src/core/surfaces.js';

export const NETFLIX_BROWSE_URL = 'https://www.netflix.com/browse';

export async function ensureNetflixBrowseReady(page, env) {
    await page.goto(NETFLIX_BROWSE_URL, { waitUntil: 'domcontentloaded' });
    await selectNetflixProfileIfNeeded(page, env.netflixProfileName);

    const loggedOut = page.getByRole('link', { name: /sign in/i });
    if (await loggedOut.isVisible().catch(() => false)) {
        throw new Error('Netflix is not logged in for the configured Chrome profile');
    }

    await expect(page.locator('.title-card, [data-uia="standard-card"]').first()).toBeVisible({
        timeout: env.timeoutMs,
    });
}

export async function selectNetflixProfileIfNeeded(page, profileName) {
    const profileLink = page.getByText(profileName, { exact: true }).first();
    if (await profileLink.isVisible().catch(() => false)) {
        await profileLink.click();
        await page.waitForLoadState('domcontentloaded');
    }
}

export async function discoverVisibleTitles(page, minimumCount = 2) {
    const titles = await page.evaluate(surfaceDefs => {
        const seenTitles = new Set();
        const seenContainers = new WeakSet();
        const results = [];

        // getTitle function using titleAttribute from surface definitions
        const getTitle = (el, surface) => {
            return el.getAttribute(surface.titleAttribute)?.trim() ?? null;
        };

        surfaceDefs.forEach(surface => {
            let titleEls;
            try {
                titleEls = document.querySelectorAll(surface.titleSelectors);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const title = getTitle(titleEl, surface);
                if (!title) return;
                let container = titleEl.closest(surface.containerSel);
                if (!container) {
                    container = titleEl.parentElement;
                }
                if (!container || seenContainers.has(container)) return;
                seenContainers.add(container);
                if (seenTitles.has(title)) return;
                seenTitles.add(title);
                results.push({
                    title,
                });
            });
        });
        return results;
    }, SURFACE_DEFS);

    if (titles.length < minimumCount) {
        throw new Error(`Expected at least ${minimumCount} visible Netflix titles, found ${titles.length}`);
    }

    return titles.map(title => ({
        ...title,
        slug: slugifyTitle(title.title),
    }));
}

export async function reloadNetflixAndWait(page, env) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await selectNetflixProfileIfNeeded(page, env.netflixProfileName);
    await expect(page.locator('.fm-rating-overlay').first()).toBeVisible({ timeout: env.timeoutMs });
}

export async function openHoverSurfaceForTitle(page, seededTitle, env) {
    const surface = findSurfaceByTitle(page, seededTitle.title);
    await surface.hover();
    await expect(page.locator('.fm-fade-toggle').first()).toBeVisible({ timeout: env.timeoutMs });
}

/**
 * Finds a surface element by its title text.
 */
export function findSurfaceByTitle(page, titleText) {
    // Create a locator that finds surfaces containing the title text
    // Uses the same container selectors as surfaces.js
    // Use .first() to avoid strict mode violation when multiple elements match
    return page.locator('.title-card, [data-uia="standard-card"]').filter({ hasText: titleText }).first();
}
