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
    describe('imdbUrl generation', () => {
        it.each([
            {
                props: { imdbId: 'tt123' },
                expected: 'https://www.imdb.com/title/tt123/',
                description: 'imdbId is provided',
            },
            {
                props: { displayTitle: 'Movie Name' },
                expected: 'https://www.imdb.com/find/?q=Movie%20Name',
                description: 'displayTitle is provided',
            },
            {
                props: { displayTitle: null },
                expected: 'https://www.imdb.com/find/?q=',
                description: 'displayTitle is null',
            },
        ])('should generate correct URL when $description', ({ props, expected }) => {
            const title = new Title(props);
            expect(title.imdbUrl).toBe(expected);
        });
    });

    describe('fromJSON creation', () => {
        it('should create a Title instance with properties from JSON object', () => {
            const title = Title.fromJSON({ displayTitle: 'JSON Title' });
            expect(title.displayTitle).toBe('JSON Title');
        });

        it('should create a Title instance when JSON is null', () => {
            const title = Title.fromJSON(null);
            expect(title).toBeInstanceOf(Title);
        });
    });

    it('should create notFound title', () => {
        const title = Title.notFound('Missing Movie');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.rating).toBeNull();
    });
});
