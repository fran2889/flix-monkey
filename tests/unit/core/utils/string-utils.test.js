/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { slugify } from '../../../src/core/utils/';

describe('core/utils/string-utils', () => {
    describe('slugify', () => {
        it('preserves legacy ASCII title keys', () => {
            expect(slugify("Schitt's Creek")).toBe('schitt_s_creek');
            expect(slugify('Test: Movie')).toBe('test_movie');
            expect(slugify('Hello World')).toBe('hello_world');
        });

        it('encodes lowercased non-ASCII letters and numbers', () => {
            expect(slugify('\u00C9lodie')).toBe('%C3%A9lodie');
            expect(slugify('\u0661\u0662\u0663')).toBe('%D9%A1%D9%A2%D9%A3');
        });

        it('keeps Unicode letters distinct across scripts', () => {
            expect(slugify('\uAE30\uC0DD\uCDA9')).not.toBe(slugify('\u5BC4\u751F\u7345'));
        });

        it('normalizes equivalent Unicode title forms', () => {
            expect(slugify('Caf\u00E9')).toBe('caf%C3%A9');
            expect(slugify('Caf\u00E9')).toBe(slugify('Cafe\u0301'));
        });

        it('applies legacy separators around encoded Unicode letters', () => {
            expect(slugify("Am\u00E9lie: Director's Cut")).toBe('am%C3%A9lie_director_s_cut');
        });

        it('should trim leading and trailing underscores', () => {
            expect(slugify('  Hello  ')).toBe('hello');
            expect(slugify('!Movie!')).toBe('movie');
        });

        it('should produce the same slug for titles differing only by punctuation', () => {
            expect(slugify('Test: Movie')).toBe(slugify('Test Movie'));
        });
    });
});
