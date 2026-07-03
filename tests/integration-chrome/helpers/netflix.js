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
import { slugifyTitle } from './utils.js';
import { SURFACE_DEFS } from '../../../src/core/surfaces.js';

/**
 * Combined CSS selector for all Netflix surface containers.
 * Built from all surface definitions in surfaces.js.
 */
export const CONTAINER_SELECTOR = [...new Set(SURFACE_DEFS.map(s => s.containerSelector))].join(', ');

export const NETFLIX_BROWSE_URL = 'https://www.netflix.com/browse';

export async function ensureNetflixBrowseReady(page, env) {
    await page.goto(NETFLIX_BROWSE_URL, { waitUntil: 'domcontentloaded' });
    await selectNetflixProfileIfNeeded(page, env.netflixProfileName);

    const loggedOut = page.getByRole('link', { name: /sign in/i });
    if (await loggedOut.isVisible().catch(() => false)) {
        throw new Error('Netflix is not logged in for the configured Chrome profile');
    }

    await expect(page.locator(CONTAINER_SELECTOR).first()).toBeVisible({
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
                titleEls = document.querySelectorAll(surface.titleSelector);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const title = getTitle(titleEl, surface);
                if (!title) return;
                let container = titleEl.closest(surface.containerSelector);
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
    const surface = findSurfaceBySlug(page, seededTitle.slug);
    // Move mouse to surface center to ensure proper hover behavior
    const box = await surface.boundingBox();
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
    // Hover with force: true to ensure event is dispatched
    await surface.hover({ force: true });
    // Wait for fade toggle to appear in mini-modal
    await expect(page.locator('.fm-fade-toggle').first()).toBeVisible({ timeout: env.timeoutMs });
}

/**
 * Finds a surface element by its title text.
 * Uses the combined container selector from all surface definitions.
 * Note: This searches by text content. For more reliable matching, use findSurfaceBySlug.
 */
export function findSurfaceByTitle(page, titleText) {
    // Create a locator that finds surfaces containing the title text
    // Uses the same container selectors as surfaces.js
    // Use .first() to avoid strict mode violation when multiple elements match
    return page.locator(CONTAINER_SELECTOR).filter({ hasText: titleText }).first();
}

/**
 * Finds a surface element by its slug.
 * Uses the data-fm-key attribute that FlixMonkey adds to containers.
 * This is more reliable than findSurfaceByTitle as it uses exact attribute matching.
 */
export function findSurfaceBySlug(page, slug) {
    // Use the data-fm-key attribute that FlixMonkey sets on containers
    // Apply the data-fm-key filter to each container selector individually
    const slugSelector = `[data-fm-key="${slug}"]`;
    const surfaceSelectors = [...new Set(SURFACE_DEFS.map(s => s.containerSelector))]
        .map(selector => `${selector}${slugSelector}`)
        .join(', ');
    // Use .first() to avoid strict mode violation when multiple elements match
    return page.locator(surfaceSelectors).first();
}
