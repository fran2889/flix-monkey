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
