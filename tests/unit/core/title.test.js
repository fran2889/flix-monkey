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
import { Title } from '../../../src/core/title.js';

describe('Title', () => {
    it('should generate correct imdbUrl', () => {
        const t1 = new Title({ imdbId: 'tt123' });
        expect(t1.imdbUrl).toBe('https://www.imdb.com/title/tt123/');

        const t2 = new Title({ displayTitle: 'Movie Name' });
        expect(t2.imdbUrl).toBe('https://www.imdb.com/find/?q=Movie%20Name');

        const t3 = new Title({ displayTitle: null });
        expect(t3.imdbUrl).toBe('https://www.imdb.com/find/?q=');
    });

    it('should identify better title with isBetterThan', () => {
        const t1 = new Title({ rating: 8.0 });
        const t2 = new Title({ rating: null });

        expect(t1.isBetterThan(t2)).toBe(true);
        expect(t2.isBetterThan(t1)).toBe(false);
        expect(t1.isBetterThan(null)).toBe(true);

        const t3 = new Title({ rating: 7.0 });
        expect(t1.isBetterThan(t3)).toBe(false); // only better if other has NO rating
    });

    it('should create from JSON', () => {
        const title = Title.fromJSON({ displayTitle: 'JSON Title' });
        expect(title.displayTitle).toBe('JSON Title');

        const title2 = Title.fromJSON(null);
        expect(title2).toBeInstanceOf(Title);
    });

    it('should create notFound title', () => {
        const title = Title.notFound('Missing Movie');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.rating).toBeNull();
    });
});
