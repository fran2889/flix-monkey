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

describe('SurfaceManager', () => {
    function discover(html) {
        const sm = new SurfaceManager(createMockLogger());
        document.body.innerHTML = html;
        return sm.discover(document.body);
    }

    it('should return empty array when no matching elements exist', () => {
        expect(discover('<div>nothing</div>')).toEqual([]);
    });

    it('should discover title-card surface', () => {
        const results = discover(`
            <div class="title-card">
                <div class="fallback-text">Bones</div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Bones');
        expect(results[0].container.className).toBe('title-card');
        expect(results[0].fadeable).toBe(true);
    });

    it('should discover standard-card surface', () => {
        const results = discover(`
            <div data-uia="standard-card" aria-label="Breaking Bad"></div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Breaking Bad');
        expect(results[0].container.getAttribute('data-uia')).toBe('standard-card');
        expect(results[0].fadeable).toBe(true);
    });

    it('should discover preview mini-modal surface', () => {
        const results = discover(`
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img class="previewModal--boxart" alt="Sweet Magnolias">
                </div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Sweet Magnolias');
        expect(results[0].container.className).toBe('previewModal--player_container');
        expect(results[0].fadeable).toBe(false);

        // Without the scoped wrapper, this surface must not fire
        expect(
            discover(`
            <div class="previewModal--player_container">
                <img class="previewModal--boxart" alt="No wrapper">
            </div>
        `)
        ).toHaveLength(0);
    });

    it('should discover preview detail-modal surface', () => {
        const results = discover(`
            <div class="previewModal--wrapper detail-modal">
                <div class="previewModal--player_container">
                    <img class="previewModal--boxart" alt="Sweet Magnolias">
                </div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Sweet Magnolias');
        expect(results[0].container.className).toBe('previewModal--player_container');
        expect(results[0].fadeable).toBe(false);

        // Without the scoped wrapper, this surface must not fire
        expect(
            discover(`
            <div class="previewModal--player_container">
                <img class="previewModal--boxart" alt="No wrapper">
            </div>
        `)
        ).toHaveLength(0);
    });

    it('should skip element with empty title', () => {
        expect(discover('<div class="title-card"><div class="fallback-text">   </div></div>')).toHaveLength(0);
    });

    it('should skip element with null title', () => {
        const mockEl = {
            textContent: null,
            closest: () => document.body,
            parentElement: document.body,
            getAttribute: () => null,
        };
        const sm = new SurfaceManager(createMockLogger());
        expect(sm.discover({ querySelectorAll: () => [mockEl] })).toHaveLength(0);
    });

    it('should deduplicate when multiple title elements share the same container', () => {
        const results = discover(`
            <div class="title-card">
                <div class="fallback-text">First</div>
                <div class="fallback-text">Second</div>
            </div>
        `);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('First');
    });

    it('should fall back to parentElement when containerSel does not match', () => {
        const logger = createMockLogger();
        const sm = new SurfaceManager(logger);
        const fakeParent = document.createElement('div');
        fakeParent.className = 'orphan-parent';
        const mockTitleEl = {
            textContent: 'Orphan',
            closest: () => null,
            parentElement: fakeParent,
            getAttribute: () => null,
        };
        const results = sm.discover({ querySelectorAll: () => [mockTitleEl] });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Orphan');
        expect(results[0].container).toBe(fakeParent);
        expect(logger.warn).toHaveBeenCalledWith('Surface container selector failed, falling back to parentElement', {
            selector: '.title-card',
        });
    });

    it('should return empty array when querySelectorAll throws', () => {
        const sm = new SurfaceManager(createMockLogger());
        expect(
            sm.discover({
                querySelectorAll: () => {
                    throw new Error('fail');
                },
            })
        ).toEqual([]);
    });
});
