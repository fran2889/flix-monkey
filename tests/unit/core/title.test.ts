/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { Title, type TitleData, type TitleOptions } from '../../../src/core/title';

const emptyTitleData: TitleData = {
    apiTitle: undefined,
    imdbId: undefined,
    year: undefined,
    imdbRating: undefined,
    imdbVotes: undefined,
    rtRating: undefined,
    mcRating: undefined,
    source: undefined,
    type: undefined,
};

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
                props: { displayTitle: undefined },
                expected: 'https://www.imdb.com/find/?q=',
                description: 'displayTitle is undefined',
            },
        ])('should generate correct URL when $description', ({ props, expected }) => {
            const title = new Title(props);
            expect(title.imdbUrl).toBe(expected);
        });
    });

    describe('fromCacheJSON creation', () => {
        it('should create a Title instance with properties from a cache object', () => {
            const title = Title.fromCacheJSON({ ...emptyTitleData, apiTitle: 'Cached Movie' }, 'JSON Title');
            expect(title).not.toBeUndefined();
            expect(title!.displayTitle).toBe('JSON Title');
            expect(title!.apiTitle).toBe('Cached Movie');
        });

        it('should handle imdbVotes field from a cache object', () => {
            const title = Title.fromCacheJSON({ ...emptyTitleData, imdbVotes: 1000 }, 'Test');
            expect(title).not.toBeUndefined();
            expect(title!.imdbVotes).toBe(1000);
        });

        it('should handle missing imdbVotes field from a cache object', () => {
            const title = Title.fromCacheJSON(emptyTitleData, 'Test');
            expect(title).not.toBeUndefined();
            expect(title!.imdbVotes).toBeUndefined();
        });

        // Storage JSON is untrusted, so these payloads need no cast to be rejected.
        it.each([[null], ['string'], [42], [undefined], [[]], [true]])(
            'should return undefined for the non-title payload %o',
            (payload: unknown) => {
                expect(Title.fromCacheJSON(payload, 'JSON Title')).toBeUndefined();
            }
        );

        it('should collapse a legacy string rating in the payload to undefined', () => {
            const title = Title.fromCacheJSON({ ...emptyTitleData, imdbRating: '8.5' }, 'Legacy');
            expect(title!.imdbRating).toBeUndefined();
            expect(title!.hasRating).toBe(false);
        });
    });

    it('should create notFound title with default undefined source', () => {
        const title = Title.notFound('Missing Movie');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.imdbRating).toBeUndefined();
        expect(title.source).toBeUndefined();
    });

    it('should create notFound title with provided source', () => {
        const title = Title.notFound('Missing Movie', 'omdb');
        expect(title.displayTitle).toBe('Missing Movie');
        expect(title.source).toBe('omdb');
        expect(title.imdbRating).toBeUndefined();
    });

    it('should return an immutable copy with only its source changed', () => {
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
        it('should be true when imdbRating is 0', () => {
            expect(new Title({ imdbRating: 0 }).hasRating).toBe(true);
        });
        it('should be true when rtRating is 0', () => {
            expect(new Title({ rtRating: 0 }).hasRating).toBe(true);
        });
        it('should be true when mcRating is 0', () => {
            expect(new Title({ mcRating: 0 }).hasRating).toBe(true);
        });
        it('should be false when all ratings are undefined', () => {
            expect(new Title({}).hasRating).toBe(false);
        });
    });

    describe('rating normalization', () => {
        // Ratings arrive as numbers: each API client owns its provider's wire format
        // and converts it before constructing a Title. Anything that is not a finite
        // number carries no rating, including raw wire strings reaching an untyped caller.
        it.each([[undefined], [null], [Number.NaN], [Number.POSITIVE_INFINITY], ['8.5'], ['90%'], ['N/A'], ['']])(
            'collapses non-numeric input %s to undefined',
            (input: unknown) => {
                const options = { imdbRating: input, imdbVotes: input, rtRating: input, mcRating: input };
                const title = new Title(options as unknown as TitleOptions);
                expect(title.imdbRating).toBeUndefined();
                expect(title.imdbVotes).toBeUndefined();
                expect(title.rtRating).toBeUndefined();
                expect(title.mcRating).toBeUndefined();
                expect(title.hasRating).toBe(false);
            }
        );

        it.each([
            [0, 0],
            [8.5, 8.5],
            [90, 90],
        ])('keeps the numeric rating %s -> %s', (input, expected) => {
            const title = new Title({ imdbRating: input, rtRating: input, mcRating: input, imdbVotes: input });
            expect(title.imdbRating).toBe(expected);
            expect(title.rtRating).toBe(expected);
            expect(title.mcRating).toBe(expected);
            expect(title.imdbVotes).toBe(expected);
        });

        it('keeps a numeric year', () => {
            expect(new Title({ year: 2020 }).year).toBe(2020);
        });

        // Providers report years as partial strings such as "2020-"; extracting the
        // digits is the client's job, so Title rejects the raw wire value.
        it.each([[undefined], [null], [Number.NaN], [Number.POSITIVE_INFINITY], ['2020-'], ['2020']])(
            'collapses non-numeric year %s to undefined',
            (input: unknown) => {
                expect(new Title({ year: input } as unknown as TitleOptions).year).toBeUndefined();
            }
        );

        it('normalizes untyped null inputs to undefined', () => {
            const title = new Title({
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
                displayTitle: null,
                apiTitle: null,
                imdbId: null,
                source: null,
                type: null,
            } as unknown as TitleOptions);
            expect(title.displayTitle).toBeUndefined();
            expect(title.apiTitle).toBeUndefined();
            expect(title.imdbId).toBeUndefined();
            expect(title.source).toBeUndefined();
            expect(title.type).toBeUndefined();
        });
    });

    describe('type field', () => {
        it('should default to undefined', () => {
            expect(new Title({}).type).toBeUndefined();
        });

        it('should accept a type value', () => {
            expect(new Title({ type: 'movie' }).type).toBe('movie');
        });

        it('should normalize undefined to undefined', () => {
            expect(new Title({ type: undefined }).type).toBeUndefined();
        });

        it('should round-trip through fromCacheJSON', () => {
            const title = Title.fromCacheJSON({ ...emptyTitleData, type: 'series' }, 'Test');
            expect(title).not.toBeUndefined();
            expect(title!.type).toBe('series');
        });

        it('should be undefined on notFound titles', () => {
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
        ])('keeps numeric imdbVotes %s -> %s', (input, expected) => {
            expect(new Title({ imdbVotes: input }).imdbVotes).toBe(expected);
        });
    });

    describe('immutability', () => {
        it('should not allow mutation of fields after construction', () => {
            const title = new Title({ displayTitle: 'Original', imdbRating: 7.5 });
            const mutableTitle = title as {
                displayTitle: string | undefined;
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
    });

    it('should return object without displayTitle from toCacheJSON', () => {
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

    it('should reconstruct Title with displayTitle from fromCacheJSON', () => {
        const cacheObj: TitleData = {
            apiTitle: 'Test Movie',
            imdbId: 'tt1234567',
            year: 2024,
            imdbRating: 8.5,
            imdbVotes: undefined,
            rtRating: undefined,
            mcRating: undefined,
            source: undefined,
            type: undefined,
        };
        const title = Title.fromCacheJSON(cacheObj, 'Original Title');
        expect(title).not.toBeUndefined();
        expect(title!.displayTitle).toBe('Original Title');
        expect(title!.apiTitle).toBe('Test Movie');
        expect(title!.imdbId).toBe('tt1234567');
    });
});
