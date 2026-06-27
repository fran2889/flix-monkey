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
import { createMockLogger } from '../../mocks/logger.js';

describe('Surfaces', () => {
    it('should return empty array when no titles found', () => {
        const surfaces = new SurfaceManager(createMockLogger());
        document.body.innerHTML = '<div>No titles here</div>';
        const results = surfaces.discover(document.body);
        expect(results).toEqual([]);
    });

    it('should discover title card surfaces', () => {
        const surfaces = new SurfaceManager(createMockLogger());
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
        expect(results[0].showToggle).toBe(false);
    });

    it('should discover search video card surfaces', () => {
        const surfaces = new SurfaceManager(createMockLogger());
        document.body.innerHTML = `
            <div data-uia="standard-card" aria-label="Search Result Title"></div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Search Result Title');
        expect(results[0].fadeable).toBe(true);
        expect(results[0].showToggle).toBe(false);
    });

    it('should discover preview modal surfaces (img alt)', () => {
        const surfaces = new SurfaceManager(createMockLogger());
        document.body.innerHTML = `
            <div class="previewModal--player_container">
                <div class="previewModal--player-titleTreatmentWrapper">
                    <img alt="Modal Title" src="...">
                </div>
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Modal Title');
        expect(results[0].container.className).toBe('previewModal--player_container');
        expect(results[0].fadeable).toBe(false);
        expect(results[0].showToggle).toBe(true);
    });

    it('should discover jawbone surfaces', () => {
        const surfaces = new SurfaceManager(createMockLogger());
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
        const surfaces = new SurfaceManager(createMockLogger());
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
        const mockLogger = createMockLogger();
        const surfaces = new SurfaceManager(mockLogger);
        // .previewModal--player-titleTreatmentWrapper img[alt] matches without a
        // .previewModal--player_container ancestor, triggering the fallback path.
        document.body.innerHTML = `
            <div class="previewModal--player-titleTreatmentWrapper">
                <img alt="Orphan Title" src="...">
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Orphan Title');
        expect(results[0].container.className).toBe('previewModal--player-titleTreatmentWrapper');
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'Surface container selector failed, falling back to parentElement',
            {
                selector: '.previewModal--player_container',
            }
        );
    });

    it('should de-duplicate containers', () => {
        const surfaces = new SurfaceManager(createMockLogger());
        // Construct a case where multiple selectors might find the same container
        // Though in reality they are mostly mutually exclusive, we can test the logic
        document.body.innerHTML = `
            <div class="previewModal--player_container">
                <img alt="Title 1" src="...">
                <h3 class="previewModal--boxarttitle">Title 2</h3>
            </div>
        `;
        const results = surfaces.discover(document.body);
        // Only one should be picked for the same container
        expect(results).toHaveLength(1);
    });

    it('should handle querySelectorAll errors gracefully', () => {
        const surfaces = new SurfaceManager(createMockLogger());
        const mockRoot = {
            querySelectorAll: () => {
                throw new Error('Selection failed');
            },
        };
        const results = surfaces.discover(mockRoot);
        expect(results).toEqual([]);
    });

    describe('getTitle fallbacks and edge cases', () => {
        it('should skip discover when textContent is empty', () => {
            const surfaces = new SurfaceManager(createMockLogger());
            document.body.innerHTML = '<div class="title-card"><div class="fallback-text"></div></div>';
            const results = surfaces.discover(document.body);
            expect(results).toHaveLength(0);
        });

        it('should skip discover when textContent is null', () => {
            const mockEl = {
                textContent: null,
                closest: () => document.body,
                parentElement: document.body,
                getAttribute: () => null,
            };
            const mockRoot = {
                querySelectorAll: () => [mockEl],
            };
            const surfaces = new SurfaceManager(createMockLogger());
            const results = surfaces.discover(mockRoot);
            expect(results).toHaveLength(0);
        });

        it('should fallback to data-uia previewModal-title text', () => {
            const surfaces = new SurfaceManager(createMockLogger());
            document.body.innerHTML = `
                <div class="previewModal--player_container">
                    <div data-uia="previewModal-title">Data Title</div>
                </div>
            `;
            const results = surfaces.discover(document.body);
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Data Title');
        });

        it('should fallback to jawBone image-fallback-text content', () => {
            const surfaces = new SurfaceManager(createMockLogger());
            document.body.innerHTML = `
                <div class="jawBone">
                    <div class="image-fallback-text">Fallback Title</div>
                </div>
            `;
            const results = surfaces.discover(document.body);
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Fallback Title');
        });
    });

    it('should handle missing container', () => {
        const surfaces = new SurfaceManager(createMockLogger());
        // img inside titleTreatmentWrapper but no player_container ancestor → parentElement is the fallback
        document.body.innerHTML = `
            <div class="previewModal--player-titleTreatmentWrapper">
                <img alt="No Container" src="">
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].container.className).toBe('previewModal--player-titleTreatmentWrapper');
    });

    describe('previewModal fallback selectors', () => {
        it.each([
            [
                '<div class="previewModal--player_container"><img alt="Player Title" src="..."></div>',
                'Player Title',
                'previewModal--player_container',
            ],
            [
                '<div class="previewModal--player_container"><div class="previewModal--player-titleTreatmentWrapper"><img alt="Treatment Title" src="..."></div></div>',
                'Treatment Title',
                'previewModal--player_container',
            ],
            [
                '<div class="previewModal--player_container"><div data-uia="previewModal-title">Data UIA Title</div></div>',
                'Data UIA Title',
                'previewModal--player_container',
            ],
            [
                '<div class="previewModal--player_container"><h3 class="previewModal--boxarttitle">Boxart Title</h3></div>',
                'Boxart Title',
                'previewModal--player_container',
            ],
        ])('should discover previewModal with html: %s', (html, expectedTitle, expectedContainerClass) => {
            const surfaces = new SurfaceManager(createMockLogger());
            document.body.innerHTML = html;
            const results = surfaces.discover(document.body);
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe(expectedTitle);
            expect(results[0].container.className).toBe(expectedContainerClass);
            expect(results[0].fadeable).toBe(false);
            expect(results[0].showToggle).toBe(true);
        });
    });

    describe('jawBone / detail-view fallback selectors', () => {
        it.each([
            [
                '<div class="jawBoneContainer"><img alt="JawBone Container Title" src="..."></div>',
                'JawBone Container Title',
                'jawBoneContainer',
            ],
            [
                '<div class="jawBoneContainer"><div class="image-fallback-text">JawBone Container Fallback</div></div>',
                'JawBone Container Fallback',
                'jawBoneContainer',
            ],
            [
                '<div class="previewModal--detailsMetadata"><img alt="Details Metadata Title" src="..."></div>',
                'Details Metadata Title',
                'previewModal--detailsMetadata',
            ],
            [
                '<div class="previewModal--detailsMetadata"><h3>Details H3 Title</h3></div>',
                'Details H3 Title',
                'previewModal--detailsMetadata',
            ],
            [
                '<div class="previewModal--detailsMetadata"><div class="title">Details Title Class</div></div>',
                'Details Title Class',
                'previewModal--detailsMetadata',
            ],
            [
                '<div class="previewModal--detailsMetadata"><div data-uia="previewModal-title">Details Data UIA</div></div>',
                'Details Data UIA',
                'previewModal--detailsMetadata',
            ],
        ])('should discover jawBone/detail surface with html: %s', (html, expectedTitle, expectedContainerClass) => {
            const surfaces = new SurfaceManager(createMockLogger());
            document.body.innerHTML = html;
            const results = surfaces.discover(document.body);
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe(expectedTitle);
            expect(results[0].container.className).toBe(expectedContainerClass);
            expect(results[0].fadeable).toBe(false);
            expect(results[0].showToggle).toBe(false);
        });
    });
});
