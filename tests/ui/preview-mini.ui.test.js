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
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import fs from 'fs';
import path from 'path';

describe('Preview Mini-Modal UI Surface', () => {
    let surfaceManager, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/surfaces/preview-mini.html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
    });

    it('discovers exactly one surface from the mini-modal fixture', () => {
        const results = surfaceManager.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Sweet Magnolias');
        const miniResults = results.filter(r => r.container.classList.contains('previewModal--player_container'));
        expect(miniResults.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts a non-empty title from the boxart alt attribute', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.title).toBeTruthy();
            expect(typeof r.title).toBe('string');
        });
    });

    it('sets fadeable to false for the mini-modal surface', () => {
        const results = surfaceManager.discover(document.body);
        results.forEach(r => {
            expect(r.fadeable).toBe(false);
        });
    });
});
