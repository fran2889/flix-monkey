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
import { describe, expect, it } from 'vitest';

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

        it('should return null when JSON is null', () => {
            const title = Title.fromJSON(null);
            expect(title).toBeNull();
        });

        it('should return null for non-object input', () => {
            expect(Title.fromJSON(null)).toBeNull();
            expect(Title.fromJSON('string')).toBeNull();
            expect(Title.fromJSON(42)).toBeNull();
        });
    });

    it('should create notFound title with default null source', () => {
        const title = Title.notFound('Missing Movie');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.rating).toBeNull();
        expect(title.source).toBeNull();
    });

    it('should create notFound title with provided source', () => {
        const title = Title.notFound('Missing Movie', 'omdb');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.source).toBe('omdb');
        expect(title.rating).toBeNull();
    });

    describe('hasRating', () => {
        it('should be true when rating is 0', () => {
            expect(new Title({ rating: 0 }).hasRating).toBe(true);
        });
        it('should be true when rtRating is "0%"', () => {
            expect(new Title({ rtRating: '0%' }).hasRating).toBe(true);
        });
        it('should be true when mcRating is "0/100"', () => {
            expect(new Title({ mcRating: '0/100' }).hasRating).toBe(true);
        });
        it('should be false when all ratings are null', () => {
            expect(new Title({}).hasRating).toBe(false);
        });
    });

    describe('rating normalization', () => {
        it.each([
            ['N/A', null],
            ['', null],
            [null, null],
            [undefined, null],
            ['8.5', 8.5],
            [0, 0],
        ])('normalizes rating %s → %s', (input, expected) => {
            expect(new Title({ rating: input }).rating).toBe(expected);
        });

        it.each([
            ['90%', 90],
            ['0%', 0],
            ['N/A', null],
            ['', null],
            [null, null],
            ['8.5/10', 8], // parseInt stops at non-digit
        ])('normalizes rtRating %s → %s', (input, expected) => {
            expect(new Title({ rtRating: input }).rtRating).toBe(expected);
        });

        it.each([
            ['85/100', 85],
            ['0/100', 0],
            ['N/A', null],
            ['', null],
            [null, null],
            ['abc', null],
        ])('normalizes mcRating %s → %s', (input, expected) => {
            expect(new Title({ mcRating: input }).mcRating).toBe(expected);
        });

        it('parses year from open-ended range string', () => {
            expect(new Title({ year: '2020–' }).year).toBe(2020);
        });
    });

    describe('type field', () => {
        it('should default to null', () => {
            expect(new Title({}).type).toBeNull();
        });

        it('should accept a type value', () => {
            expect(new Title({ type: 'movie' }).type).toBe('movie');
        });

        it('should normalize undefined to null', () => {
            expect(new Title({ type: undefined }).type).toBeNull();
        });

        it('should round-trip through fromJSON', () => {
            const title = Title.fromJSON({ displayTitle: 'Test', type: 'series' });
            expect(title.type).toBe('series');
        });

        it('should be null on notFound titles', () => {
            expect(Title.notFound('Missing').type).toBeNull();
        });
    });

    describe('immutability', () => {
        it('should not allow mutation of fields after construction', () => {
            const title = new Title({ displayTitle: 'Original', rating: 7.5 });
            try {
                title.displayTitle = 'Mutated';
            } catch {
                /* frozen in strict mode */
            }
            try {
                title.rating = 0;
            } catch {
                /* frozen in strict mode */
            }
            expect(title.displayTitle).toBe('Original');
            expect(title.rating).toBe(7.5);
        });
    });
});
