/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { Title, type TitleOptions } from '../../../src/core/title';

describe('Title', () => {
    describe('imdbUrl generation', () => {
        it.each([
            {
                props: { displayTitle: 'Movie Name', imdbId: 'tt123' },
                expected: 'https://www.imdb.com/title/tt123/',
                description: 'imdbId is provided',
            },
            {
                props: { displayTitle: 'Movie Name' },
                expected: 'https://www.imdb.com/find/?q=Movie%20Name',
                description: 'imdbId is not provided',
            },
        ])('generates the IMDb URL when $description', ({ props, expected }) => {
            const title = new Title(props);
            expect(title.imdbUrl).toBe(expected);
        });
    });

    it('creates a notFound title with an undefined source by default', () => {
        const title = Title.notFound('Missing Movie');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.imdbRating).toBeUndefined();
        expect(title.source).toBeUndefined();
    });

    it('creates a notFound title with the provided source', () => {
        const title = Title.notFound('Missing Movie', 'omdb');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.source).toBe('omdb');
        expect(title.imdbRating).toBeUndefined();
    });

    it('returns an immutable copy with only its source changed', () => {
        const original = new Title({
            displayTitle: 'Original',
            apiTitle: 'Canonical',
            imdbId: 'tt123',
            year: 2024,
            imdbRating: 7.5,
            imdbVotes: 1000,
            rtRating: 80,
            mcRating: 70,
            source: 'omdb',
            type: 'movie',
        });

        const updated = original.withSource('xmdb');

        expect(updated).not.toBe(original);
        expect(updated).toMatchObject({ ...original, source: 'xmdb' });
        expect(Object.isFrozen(updated)).toBe(true);
        expect(original.source).toBe('omdb');
    });

    describe('hasRating', () => {
        it.each(['imdbRating', 'rtRating', 'mcRating'] as const)('reports a rating when %s is 0', field => {
            expect(new Title({ displayTitle: 'Test', [field]: 0 }).hasRating).toBe(true);
        });
        it('reports no rating when all ratings are undefined', () => {
            expect(new Title({ displayTitle: 'Test' }).hasRating).toBe(false);
        });
    });

    describe('rating normalization', () => {
        // Ratings arrive as numbers: each API client owns its provider's wire format
        // and converts it before constructing a Title. Anything that is not a finite
        // number carries no rating, including raw wire strings reaching an untyped caller.
        it.each([
            { description: 'an undefined', input: undefined },
            { description: 'a null', input: null },
            { description: 'a NaN', input: Number.NaN },
            { description: 'an infinite', input: Number.POSITIVE_INFINITY },
            { description: 'a numeric string', input: '8.5' },
            { description: 'a percentage string', input: '90%' },
            { description: 'an N/A string', input: 'N/A' },
            { description: 'an empty string', input: '' },
        ])('treats $description rating as no rating', ({ input }: { description: string; input: unknown }) => {
            const options = {
                displayTitle: 'Test',
                imdbRating: input,
                imdbVotes: input,
                rtRating: input,
                mcRating: input,
            };
            const title = new Title(options as unknown as TitleOptions);
            expect(title.imdbRating).toBeUndefined();
            expect(title.imdbVotes).toBeUndefined();
            expect(title.rtRating).toBeUndefined();
            expect(title.mcRating).toBeUndefined();
            expect(title.hasRating).toBe(false);
        });

        it.each([
            [0, 0],
            [8.5, 8.5],
            [90, 90],
        ])('keeps the numeric rating %s', (input, expected) => {
            const title = new Title({
                displayTitle: 'Test',
                imdbRating: input,
                rtRating: input,
                mcRating: input,
                imdbVotes: input,
            });
            expect(title.imdbRating).toBe(expected);
            expect(title.rtRating).toBe(expected);
            expect(title.mcRating).toBe(expected);
            expect(title.imdbVotes).toBe(expected);
        });

        it('keeps a numeric year', () => {
            expect(new Title({ displayTitle: 'Test', year: 2020 }).year).toBe(2020);
        });

        // Providers report years as partial strings such as "2020-"; extracting the
        // digits is the client's job, so Title rejects the raw wire value.
        it.each([
            { description: 'an undefined', input: undefined },
            { description: 'a null', input: null },
            { description: 'a NaN', input: Number.NaN },
            { description: 'an infinite', input: Number.POSITIVE_INFINITY },
            { description: 'a partial string', input: '2020-' },
            { description: 'a numeric string', input: '2020' },
        ])('treats $description year as no year', ({ input }: { description: string; input: unknown }) => {
            expect(new Title({ displayTitle: 'Test', year: input } as unknown as TitleOptions).year).toBeUndefined();
        });

        it('normalizes untyped null inputs to undefined', () => {
            const title = new Title({
                displayTitle: 'Test',
                year: null,
                imdbRating: null,
                imdbVotes: null,
                rtRating: null,
                mcRating: null,
            } as unknown as TitleOptions);
            expect(title.year).toBeUndefined();
            expect(title.imdbRating).toBeUndefined();
            expect(title.imdbVotes).toBeUndefined();
            expect(title.rtRating).toBeUndefined();
            expect(title.mcRating).toBeUndefined();
        });

        it('normalizes untyped null identity fields to undefined', () => {
            const title = new Title({
                displayTitle: 'Test',
                apiTitle: null,
                imdbId: null,
                source: null,
                type: null,
            } as unknown as TitleOptions);
            expect(title.apiTitle).toBeUndefined();
            expect(title.imdbId).toBeUndefined();
            expect(title.source).toBeUndefined();
            expect(title.type).toBeUndefined();
        });
    });

    describe('type field', () => {
        it('defaults the type to undefined', () => {
            expect(new Title({ displayTitle: 'Test' }).type).toBeUndefined();
        });

        it('stores a provided type value', () => {
            expect(new Title({ displayTitle: 'Test', type: 'movie' }).type).toBe('movie');
        });

        it('leaves the type undefined on notFound titles', () => {
            expect(Title.notFound('Missing').type).toBeUndefined();
        });
    });

    describe('imdbVotes normalization', () => {
        it.each([
            [undefined, undefined],
            [0, 0],
            [1, 1],
            [999, 999],
            [1000, 1000],
            [2500000, 2500000],
        ])('keeps numeric imdbVotes %s', (input, expected) => {
            expect(new Title({ displayTitle: 'Test', imdbVotes: input }).imdbVotes).toBe(expected);
        });
    });

    it('does not allow mutation of fields after construction', () => {
        const title = new Title({ displayTitle: 'Original', imdbRating: 7.5 });
        const mutableTitle = title as {
            displayTitle: string;
            imdbRating: number | undefined;
        };
        try {
            mutableTitle.displayTitle = 'Mutated';
        } catch {
            /* frozen in strict mode */
        }
        try {
            mutableTitle.imdbRating = 0;
        } catch {
            /* frozen in strict mode */
        }
        expect(title.displayTitle).toBe('Original');
        expect(title.imdbRating).toBe(7.5);
    });

    it('omits displayTitle from the serialized cache object', () => {
        const title = new Title({
            displayTitle: 'Test Movie',
            apiTitle: 'Test Movie',
            imdbId: 'tt1234567',
            year: 2024,
            imdbRating: 8.5,
        });
        const cacheObj = title.toCacheJSON();
        expect(cacheObj).not.toHaveProperty('displayTitle');
        expect(cacheObj.apiTitle).toBe('Test Movie');
        expect(cacheObj.imdbId).toBe('tt1234567');
        expect(cacheObj.year).toBe(2024);
        expect(cacheObj.imdbRating).toBe(8.5);
    });
});
