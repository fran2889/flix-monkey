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
        const surfaceSelectors = ['[data-uia="search-gallery-video-card"]', '[data-uia="title-card"]', '.title-card'];
        const genericControlLabels = new Set([
            'play',
            'next',
            'previous',
            'back',
            'more info',
            'episodes',
            'mute',
            'unmute',
            'add to my list',
            'remove from my list',
        ]);
        const seenTitles = new Set();
        const seenSurfaces = new WeakSet();
        const results = [];

        function normalizeTitle(value) {
            const title = value?.replace(/\s+/g, ' ').trim() ?? '';
            if (!title) return '';
            if (genericControlLabels.has(title.toLowerCase())) return '';
            return title;
        }

        function getTitleFromSurface(surface) {
            const directCandidates = [
                surface.getAttribute('aria-label'),
                surface.getAttribute('title'),
                surface.querySelector('img[alt]')?.getAttribute('alt'),
                surface.querySelector('[data-uia*="title" i]')?.getAttribute('aria-label'),
                surface.querySelector('[data-uia*="title" i]')?.getAttribute('title'),
                surface.querySelector('[data-uia*="title" i]')?.textContent,
                surface.querySelector('[title]')?.getAttribute('title'),
                surface.querySelector('h1, h2, h3, h4, p, span')?.textContent,
            ];

            for (const candidate of directCandidates) {
                const title = normalizeTitle(candidate);
                if (title) return title;
            }

            return '';
        }

        for (const selector of surfaceSelectors) {
            for (const surface of document.querySelectorAll(selector)) {
                if (seenSurfaces.has(surface)) continue;

                const rect = surface.getBoundingClientRect();
                if (rect.width < 40 || rect.height < 40) continue;

                const title = getTitleFromSurface(surface);
                if (!title || seenTitles.has(title)) continue;

                surface.setAttribute('data-fm-integration-surface', String(results.length));
                seenSurfaces.add(surface);
                seenTitles.add(title);
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

export async function openHoverSurfaceForTitle(page, seededTitle, env) {
    await page.locator(seededTitle.surfaceSelector).hover();
    await expect(page.locator('.fm-fade-toggle').first()).toBeVisible({ timeout: env.timeoutMs });
}
