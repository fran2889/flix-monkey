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
import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG_FIELDS } from '../../../src/core/config-fields.js';

describe('core/config-fields', () => {
    describe('field structures', () => {
        it.each(CONFIG_FIELDS)('should have a valid structure for field "$key"', field => {
            expect(field).toHaveProperty('key');
            expect(field).toHaveProperty('label');
            expect(field).toHaveProperty('type');
            expect(field).toHaveProperty('default');

            if (field.type === 'select') {
                expect(field).toHaveProperty('options');
                expect(Array.isArray(field.options)).toBe(true);

                field.options.forEach(option => {
                    const isValidString = typeof option === 'string';
                    const isValidArray =
                        Array.isArray(option) &&
                        option.length === 2 &&
                        typeof option[0] === 'string' &&
                        typeof option[1] === 'string';

                    expect(
                        isValidString || isValidArray,
                        `Field "${field.key}" has invalid option format: ${JSON.stringify(option)}. ` +
                            `Options must be strings or [value, label] arrays.`
                    ).toBe(true);
                });
            }
        });
    });

    describe('validate functions', () => {
        describe.each([
            ['xmdbApiKey', 'xmdb'],
            ['omdbApiKey', 'omdb'],
        ])('%s validation', (key, provider) => {
            let field;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === key);
            });

            it('should accept valid key when provider is selected', () => {
                expect(field.validate('valid-key', { apiClient: provider })).toBeNull();
            });

            it('should reject empty key when provider is selected', () => {
                expect(typeof field.validate('', { apiClient: provider })).toBe('string');
            });

            it('should accept empty key when provider is not selected', () => {
                expect(field.validate('', { apiClient: 'imdbapi' })).toBeNull();
            });
        });

        describe('fadeRatingThreshold validation', () => {
            let field;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === 'fadeRatingThreshold');
            });

            it.each(['5.0', '10.0', '0.0'])('should accept valid threshold %s', val => {
                expect(field.validate(val)).toBeNull();
            });

            it.each(['-1.0', '11.0', 'not-a-number'])('should reject invalid threshold %s', val => {
                expect(typeof field.validate(val)).toBe('string');
            });
        });

        describe.each(['cacheTtlRatedOldYear', 'cacheTtlRatedNewYear', 'cacheTtlNoRating'])('%s validation', key => {
            let field;
            beforeEach(() => {
                field = CONFIG_FIELDS.find(f => f.key === key);
            });

            it.each(['0', '30', '-1'])('should accept valid TTL value %s', val => {
                expect(field.validate(val)).toBeNull();
            });

            it.each(['-2', 'not-a-number', '5.5', ' '])('should reject invalid TTL value %s', val => {
                expect(typeof field.validate(val)).toBe('string');
            });
        });
    });

    it('should not have duplicate keys', () => {
        const keys = CONFIG_FIELDS.map(f => f.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });

    describe('field defaults alignment with types', () => {
        it.each(CONFIG_FIELDS)('should have default value matching type for field "$key"', field => {
            if (field.type === 'checkbox') {
                expect(typeof field.default).toBe('boolean');
            } else if (field.type === 'text' || field.type === 'select') {
                expect(typeof field.default).toBe('string');
            }
        });
    });
});
