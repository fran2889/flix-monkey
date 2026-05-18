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
import { describe, it, expect } from 'vitest';
import { SurfaceManager } from '../../../src/core/surfaces.js';

describe('Surfaces', () => {
    it('should return empty array when no titles found', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = '<div>No titles here</div>';
        const results = surfaces.discover(document.body);
        expect(results).toEqual([]);
    });

    it('should discover title card surfaces', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">My Movie</div>
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('My Movie');
        expect(results[0].container.className).toBe('title-card');
        expect(results[0].fadeable).toBe(true);
    });

    it('should discover search video card surfaces', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div data-uia="search-gallery-video-card" aria-label="Search Result Title"></div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Search Result Title');
        expect(results[0].fadeable).toBe(true);
    });

    it('should discover bob container surfaces', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="bob-container">
                <div class="bob-title">Bob Movie</div>
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Bob Movie');
        expect(results[0].fadeable).toBe(false);
    });

    it('should discover preview modal surfaces (img alt)', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="previewModal">
                <div class="previewModal--player-titleTreatmentWrapper">
                    <img alt="Modal Title" src="...">
                </div>
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Modal Title');
        expect(results[0].container.className).toBe('previewModal');
        expect(results[0].fadeable).toBe(false);
    });

    it('should discover jawbone surfaces', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="jawBone">
                <img alt="Jawbone Title" src="...">
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Jawbone Title');
        expect(results[0].container.className).toBe('jawBone');
        expect(results[0].fadeable).toBe(false);
    });

    it('should handle missing title text/alt', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">  </div>
            </div>
            <div class="jawBone">
                <img alt="" src="...">
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(0);
    });

    it('should fall back to parent element if container selector not found', () => {
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="not-a-container">
                <div class="bob-title">Orphan Title</div>
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Orphan Title');
        expect(results[0].container.className).toBe('not-a-container');
    });

    it('should de-duplicate containers', () => {
        const surfaces = new SurfaceManager();
        // Construct a case where multiple selectors might find the same container
        // Though in reality they are mostly mutually exclusive, we can test the logic
        document.body.innerHTML = `
            <div class="previewModal">
                <img alt="Title 1" src="...">
                <h3 class="previewModal--boxarttitle">Title 2</h3>
            </div>
        `;
        const results = surfaces.discover(document.body);
        // Only one should be picked for the same container
        expect(results).toHaveLength(1);
    });

    it('should handle querySelectorAll errors gracefully', () => {
        const surfaces = new SurfaceManager();
        const mockRoot = {
            querySelectorAll: () => {
                throw new Error('Selection failed');
            },
        };
        const results = surfaces.discover(mockRoot);
        expect(results).toEqual([]);
    });

    it('should handle edge cases in getTitle fallbacks', () => {
        const surfaces = new SurfaceManager();

        // 1. textContent missing
        document.body.innerHTML = '<div class="title-card"><div class="fallback-text"></div></div>';
        // title will be "" which is falsy, so it should be skipped
        const r1 = surfaces.discover(document.body);
        expect(r1).toHaveLength(0);

        // 2. textContent is null
        // We can't easily set textContent to null in JSDOM, but we can mock root querySelectorAll
        const mockEl = {
            textContent: null,
            closest: () => document.body,
            parentElement: document.body,
            getAttribute: () => null,
        };
        const mockRoot = {
            querySelectorAll: () => [mockEl],
        };
        const surfacesMocked = new SurfaceManager();
        // Since getTitle uses el.textContent?.trim() ?? null, it should return null
        // and if (!title) return; will skip it.
        const rMocked = surfacesMocked.discover(mockRoot);
        expect(rMocked).toHaveLength(0);

        // 3. previewModal h3 fallback
        document.body.innerHTML = `
            <div class="previewModal">
                <h3>H3 Title</h3>
            </div>
        `;
        const r2 = surfaces.discover(document.body);
        expect(r2[0].title).toBe('H3 Title');

        // 4. jawBone text fallback
        document.body.innerHTML = `
            <div class="jawBone">
                <div class="image-fallback-text">Fallback Title</div>
            </div>
        `;
        const r3 = surfaces.discover(document.body);
        expect(r3[0].title).toBe('Fallback Title');
    });

    it('should handle missing container', () => {
        const surfaces = new SurfaceManager();
        // Mock a title element that doesn't have a closest container
        document.body.innerHTML = '<div class="bob-title">No Container</div>';
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].container).toBe(document.body); // parentElement of .bob-title is body
    });
});
