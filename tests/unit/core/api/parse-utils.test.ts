/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import {
    assertRecord,
    optionalArray,
    optionalNumber,
    optionalString,
    ParseError,
    parseValidItems,
    requiredString,
} from '../../../../src/core/api/parse-utils';

function parseTitle(raw: unknown): string {
    assertRecord(raw);
    return requiredString(raw, 'title');
}

describe('ParseError', () => {
    it('is an Error named ParseError', () => {
        const error = new ParseError('expected an object');
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('ParseError');
        expect(error.message).toBe('expected an object');
    });
});

describe('assertRecord', () => {
    it('accepts a plain object', () => {
        expect(() => assertRecord({ id: 'tt1' })).not.toThrow();
    });

    it.each([
        ['null', null],
        ['an array', []],
        ['a string', 'x'],
        ['a number', 1],
    ])('throws for %s', (_label, value) => {
        expect(() => assertRecord(value)).toThrow(ParseError);
        expect(() => assertRecord(value)).toThrow('expected an object');
    });
});

describe('requiredString', () => {
    it('returns a non-empty string', () => {
        expect(requiredString({ id: 'tt1' }, 'id')).toBe('tt1');
    });

    it.each([
        ['a missing field', {}],
        ['an empty string', { id: '' }],
        ['a whitespace string', { id: '   ' }],
        ['a number', { id: 1 }],
        ['null', { id: null }],
    ])('throws for %s', (_label, record) => {
        expect(() => requiredString(record, 'id')).toThrow('expected string at "id"');
    });
});

describe('optionalString', () => {
    it('returns the string', () => expect(optionalString({ id: 'tt1' }, 'id')).toBe('tt1'));
    it('returns undefined for a missing field', () => expect(optionalString({}, 'id')).toBeUndefined());
    it('returns undefined for null', () => expect(optionalString({ id: null }, 'id')).toBeUndefined());
    it('throws for a number', () => expect(() => optionalString({ id: 1 }, 'id')).toThrow('expected string at "id"'));
});

describe('optionalNumber', () => {
    it('returns the number', () => expect(optionalNumber({ year: 2020 }, 'year')).toBe(2020));
    it('returns undefined for a missing field', () => expect(optionalNumber({}, 'year')).toBeUndefined());
    it('returns undefined for null', () => expect(optionalNumber({ year: null }, 'year')).toBeUndefined());
    it('throws for a string', () =>
        expect(() => optionalNumber({ year: '2020' }, 'year')).toThrow('expected number at "year"'));
});

describe('optionalArray', () => {
    it('returns the array', () => expect(optionalArray({ values: [1] }, 'values')).toEqual([1]));
    it('returns undefined for a missing field', () => expect(optionalArray({}, 'values')).toBeUndefined());
    it('returns undefined for null', () => expect(optionalArray({ values: null }, 'values')).toBeUndefined());
    it('throws for a string', () =>
        expect(() => optionalArray({ values: 'x' }, 'values')).toThrow('expected array at "values"'));
});

describe('parseValidItems', () => {
    it('keeps parsed items and drops items whose parser throws ParseError', () => {
        expect(parseValidItems([{ title: 'A' }, null, { title: '' }, { title: 'B' }], parseTitle)).toEqual(['A', 'B']);
    });

    it('throws when every item is invalid', () => {
        expect(() => parseValidItems([null, { title: '' }], parseTitle)).toThrow('no valid items');
    });

    it('returns an empty array for an empty input', () => {
        expect(parseValidItems([], parseTitle)).toEqual([]);
    });

    it('rethrows a non-ParseError', () => {
        const boom = new Error('boom');
        expect(() =>
            parseValidItems([1], () => {
                throw boom;
            })
        ).toThrow(boom);
    });
});
