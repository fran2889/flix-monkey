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

export const NETFLIX_BROWSE_URL = 'https://www.netflix.com/browse';

export async function ensureNetflixBrowseReady(page, env) {
    await page.goto(NETFLIX_BROWSE_URL, { waitUntil: 'domcontentloaded' });
    await selectNetflixProfileIfNeeded(page, env.netflixProfileName);

    const loggedOut = page.getByRole('link', { name: /sign in/i });
    if (await loggedOut.isVisible().catch(() => false)) {
        throw new Error('Netflix is not logged in for the configured Chrome profile');
    }

    await expect(
        page.locator('.title-card, [data-uia="title-card"], [data-uia="search-gallery-video-card"]').first()
    ).toBeVisible({
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
    const titles = await page.evaluate(() => {
        const candidateSelectors = [
            '.title-card',
            '[data-uia="title-card"]',
            '[data-uia="search-gallery-video-card"]',
            '[aria-label][role="link"]',
            '[aria-label][role="button"]',
        ];
        const seen = new Set();
        const results = [];
        for (const selector of candidateSelectors) {
            for (const el of document.querySelectorAll(selector)) {
                const rect = el.getBoundingClientRect();
                if (rect.width < 40 || rect.height < 40) continue;
                const aria = el.getAttribute('aria-label');
                const imageAlt = el.querySelector('img[alt]')?.getAttribute('alt');
                const title = (aria || imageAlt || '').trim();
                if (!title || seen.has(title)) continue;
                el.setAttribute('data-fm-integration-surface', String(results.length));
                seen.add(title);
                results.push({
                    title,
                    surfaceSelector: `[data-fm-integration-surface="${results.length}"]`,
                });
            }
        }
        return results;
    });

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
