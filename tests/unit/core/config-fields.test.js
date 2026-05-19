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
import { CONFIG_FIELDS } from '../../../src/core/config-fields.js';

describe('core/config-fields', () => {
    it('should have a valid structure for all fields', () => {
        CONFIG_FIELDS.forEach(field => {
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

    it('should return null on valid input and error message on invalid input for validate functions', () => {
        CONFIG_FIELDS.forEach(field => {
            if (field.validate) {
                if (field.key === 'xmdbApiKey' || field.key === 'omdbApiKey') {
                    expect(field.validate('valid-key')).toBeNull();
                    expect(typeof field.validate('')).toBe('string');
                } else if (field.key === 'fadeRatingThreshold') {
                    expect(field.validate('5.0')).toBeNull();
                    expect(field.validate('10.0')).toBeNull();
                    expect(field.validate('0.0')).toBeNull();
                    expect(typeof field.validate('-1.0')).toBe('string');
                    expect(typeof field.validate('11.0')).toBe('string');
                    expect(typeof field.validate('not-a-number')).toBe('string');
                } else if (
                    field.key === 'cacheTtlRatedOldYear' ||
                    field.key === 'cacheTtlRatedNewYear' ||
                    field.key === 'cacheTtlNoRating'
                ) {
                    expect(field.validate('0')).toBeNull();
                    expect(field.validate('30')).toBeNull();
                    expect(field.validate('-1')).toBeNull();
                    expect(typeof field.validate('-2')).toBe('string');
                    expect(typeof field.validate('not-a-number')).toBe('string');
                    expect(typeof field.validate('5.5')).toBe('string');
                    expect(typeof field.validate(' ')).toBe('string');
                }
            }
        });
    });

    it('should not have duplicate keys', () => {
        const keys = CONFIG_FIELDS.map(f => f.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should have defaults matching the field type', () => {
        CONFIG_FIELDS.forEach(field => {
            if (field.type === 'checkbox') {
                expect(typeof field.default).toBe('boolean');
            } else if (field.type === 'text' || field.type === 'select') {
                expect(typeof field.default).toBe('string');
            }
        });
    });
});
